package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	amqp "github.com/rabbitmq/amqp091-go"
)

func eventBody(id, appointmentID string, fee json.Number) []byte {
	var e Event
	e.EventID, e.EventName, e.Producer = id, "ConsultationCompletedEvent", "appointment-service"
	e.OccurredAt = "2026-10-12T14:30:00Z"
	e.Payload.PatientID = "a0000000-0000-0000-0000-000000000001"
	e.Payload.AppointmentID, e.Payload.ConsultationStatus = appointmentID, "COMPLETED"
	e.Payload.BillingSummary.ConsultationFee = fee
	b, err := json.Marshal(e)
	if err != nil {
		panic(err)
	}
	return b
}

func TestEventValidationAndExactDecimal(t *testing.T) {
	for _, tt := range []struct{ fee, want string }{
		{"150000.0", "150000.00"}, {"0.1", "0.10"}, {"1.5e5", "150000.00"},
		{"0", "0.00"}, {"9999999999.99", "9999999999.99"},
	} {
		t.Run(tt.fee, func(t *testing.T) {
			got, err := decimalAmount(json.Number(tt.fee))
			if err != nil || got != tt.want {
				t.Fatalf("amount=%q err=%v", got, err)
			}
		})
	}
	for _, fee := range []string{"", "-1", "0.001", "10000000000", "1e9999999999999", "1e-99999"} {
		if _, err := decimalAmount(json.Number(fee)); !errors.Is(err, ErrPermanent) {
			t.Errorf("fee %q should be rejected, got %v", fee, err)
		}
	}
	body := eventBody("evt-77a82c91-9921-4f92-b491-112233445566", "b1111111-1111-1111-1111-111111111111", "150000.0")
	_, _, hash, err := parseEvent(body)
	if err != nil {
		t.Fatal(err)
	}
	// Equivalent decimals, timestamps and JSON formatting retain the same hash.
	alternate := strings.ReplaceAll(string(body), "150000.0", "150000.00")
	alternate = strings.ReplaceAll(alternate, "2026-10-12T14:30:00Z", "2026-10-12T22:30:00+08:00")
	_, _, other, err := parseEvent([]byte(alternate))
	if err != nil || hash != other {
		t.Fatalf("canonical hash differs: %s %s %v", hash, other, err)
	}
	for _, bad := range [][]byte{
		[]byte("{"), []byte("null"), append(body, []byte(" {}")...), []byte(strings.Repeat("x", 65537)),
		[]byte(strings.ReplaceAll(string(body), "COMPLETED", "SCHEDULED")),
		[]byte(strings.ReplaceAll(string(body), "150000.0", "-1")),
		[]byte(strings.ReplaceAll(string(body), "appointment-service", "other-service")),
		[]byte(strings.ReplaceAll(string(body), "a0000000-0000-0000-0000-000000000001", "invalid")),
	} {
		if _, _, _, err := parseEvent(bad); !errors.Is(err, ErrPermanent) {
			t.Errorf("invalid payload accepted: %v", err)
		}
	}
}

type processorFunc func(context.Context, []byte) (Result, error)

func (f processorFunc) Process(c context.Context, b []byte) (Result, error) { return f(c, b) }

type ackRecorder struct{ ack, nack, requeue bool }

func (a *ackRecorder) Ack(uint64, bool) error { a.ack = true; return nil }
func (a *ackRecorder) Nack(_ uint64, _ bool, requeue bool) error {
	a.nack, a.requeue = true, requeue
	return nil
}
func (a *ackRecorder) Reject(_ uint64, requeue bool) error {
	a.nack, a.requeue = true, requeue
	return nil
}

func TestManualAcknowledgementDecisions(t *testing.T) {
	for _, tt := range []struct {
		name             string
		processErr       error
		ack, nack, retry bool
	}{
		{"committed", nil, true, false, false},
		{"poison", permanent("bad JSON"), false, true, false},
		{"database_failure", errors.New("database unavailable"), false, true, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			a := new(ackRecorder)
			processor := processorFunc(func(context.Context, []byte) (Result, error) {
				if a.ack || a.nack {
					t.Fatal("delivery acknowledged before persistence finished")
				}
				return Result{}, tt.processErr
			})
			err := HandleDelivery(context.Background(), processor, amqp.Delivery{Acknowledger: a})
			if a.ack != tt.ack || a.nack != tt.nack || a.requeue != tt.retry || (err != nil) != tt.retry {
				t.Fatalf("ack state=%+v err=%v", a, err)
			}
		})
	}
}
