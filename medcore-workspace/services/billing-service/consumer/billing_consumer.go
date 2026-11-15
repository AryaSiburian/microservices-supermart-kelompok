package consumer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

const QueueName = "billing.invoice.q"

type Result struct {
	EventID   string
	InvoiceID string
	Duplicate bool
}

type Processor interface {
	Process(context.Context, []byte) (Result, error)
}

type Service struct{ DB *sql.DB }

func (s *Service) Process(ctx context.Context, body []byte) (Result, error) {
	evt, amount, hash, err := parseEvent(body)
	result := Result{EventID: evt.EventID}
	if err != nil {
		return result, err
	}
	result.InvoiceID = uuid.NewString()
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return result, err
	}
	defer tx.Rollback()
	// The primary key serializes duplicate deliveries, including multiple workers.
	_, err = tx.ExecContext(ctx, `INSERT INTO processed_events (event_id, payload_sha256, invoice_id) VALUES (?, ?, ?)`,
		evt.EventID, hash, result.InvoiceID)
	if err != nil {
		var duplicate *mysql.MySQLError
		if !errors.As(err, &duplicate) || duplicate.Number != 1062 {
			return result, err
		}
		// Release the failed INSERT's locks before reading the committed record.
		// Upgrading concurrent duplicate-key shared locks with FOR UPDATE could
		// deadlock otherwise. Deduplication records are immutable.
		if err = tx.Rollback(); err != nil {
			return result, err
		}
		var previousHash string
		if err = s.DB.QueryRowContext(ctx, `SELECT payload_sha256, invoice_id FROM processed_events WHERE event_id=?`,
			evt.EventID).Scan(&previousHash, &result.InvoiceID); err != nil {
			return result, err
		}
		if previousHash != hash {
			return result, permanent("event_id was already used for different billing data")
		}
		result.Duplicate = true
		return result, nil
	}
	// UNPAID is the existing Billing schema's initial invoice status. No changes
	// are made to Appointment, Patient, Pharmacy or Notification databases.
	_, err = tx.ExecContext(ctx, `INSERT INTO invoices
		(invoice_id, patient_id, appointment_id, total_amount, payment_status) VALUES (?, ?, ?, ?, 'UNPAID')`,
		result.InvoiceID, evt.Payload.PatientID, evt.Payload.AppointmentID, amount)
	if err != nil {
		return result, err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO invoice_items (item_id, invoice_id, description, amount) VALUES (?, ?, ?, ?)`,
		uuid.NewString(), result.InvoiceID, "Jasa konsultasi", amount)
	if err != nil {
		return result, err
	}
	// A lost commit reply is retried with the same event_id; the PK prevents a
	// second invoice whether this commit succeeded or was rolled back.
	if err = tx.Commit(); err != nil {
		return result, err
	}
	return result, nil
}

func HandleDelivery(ctx context.Context, processor Processor, delivery amqp.Delivery) error {
	result, err := processor.Process(ctx, delivery.Body)
	if errors.Is(err, ErrPermanent) {
		log.Printf("billing rejected invalid event: %v", err)
		return delivery.Nack(false, false) // the configured DLX receives poison messages
	}
	if err != nil {
		if nackErr := delivery.Nack(false, true); nackErr != nil {
			return fmt.Errorf("billing failed (%v); requeue failed: %w", err, nackErr)
		}
		// End the session. The caller backs off before reconnecting, preventing a
		// database outage from creating a tight nack/requeue loop.
		return fmt.Errorf("billing persistence failed; delivery requeued: %w", err)
	}
	if err := delivery.Ack(false); err != nil {
		return fmt.Errorf("billing ack failed: %w", err)
	}
	log.Printf("billing acknowledged event=%s invoice=%s duplicate=%t", result.EventID, result.InvoiceID, result.Duplicate)
	return nil
}

// Consume runs a single session. Topology is provisioned by the D-owned setup
// script; a passive declaration avoids recreating an unconfigured queue.
func Consume(ctx context.Context, amqpURL string, processor Processor) error {
	conn, err := amqp.DialConfig(amqpURL, amqp.Config{Heartbeat: 10 * time.Second, Dial: amqp.DefaultDial(5 * time.Second)})
	if err != nil {
		// Do not include a URI containing credentials in logs.
		return errors.New("billing cannot connect to RabbitMQ; check broker and configuration")
	}
	defer conn.Close()
	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()
	if _, err = ch.QueueDeclarePassive(QueueName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("billing queue unavailable; run scripts/setup_rabbitmq_topology.sh: %w", err)
	}
	if err = ch.Qos(1, 0, false); err != nil {
		return err
	}
	deliveries, err := ch.Consume(QueueName, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	log.Printf("billing worker ready queue=%s manual_ack=true prefetch=1", QueueName)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case delivery, ok := <-deliveries:
			if !ok {
				return errors.New("billing delivery channel closed")
			}
			requestCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := HandleDelivery(requestCtx, processor, delivery)
			cancel()
			if err != nil {
				return err
			}
		}
	}
}
