package consumer

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

func testDatabase(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("BILLING_TEST_DSN")
	if dsn == "" {
		t.Skip("set BILLING_TEST_DSN to an isolated billing_test database")
	}
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil || !strings.HasPrefix(cfg.DBName, "billing_test") {
		t.Fatal("integration tests require an isolated database named billing_test...")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err = db.Ping(); err != nil {
		t.Fatal(err)
	}
	return db
}

func count(t *testing.T, db *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestMySQLAtomicInvoiceAndDeduplication(t *testing.T) {
	db := testDatabase(t)
	svc := &Service{DB: db}
	appointment, eventID := uuid.NewString(), "evt-"+uuid.NewString()
	body := eventBody(eventID, appointment, "150000.00")
	t.Cleanup(func() {
		db.Exec("DELETE FROM processed_events WHERE event_id=?", eventID)
		db.Exec("DELETE FROM invoices WHERE appointment_id=?", appointment)
	})
	const workers = 12
	results := make(chan Result, workers)
	errs := make(chan error, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := svc.Process(context.Background(), body)
			results <- r
			errs <- err
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	created := 0
	var invoice string
	for r := range results {
		if !r.Duplicate {
			created++
		}
		if invoice != "" && invoice != r.InvoiceID {
			t.Fatal("duplicate returned a different invoice")
		}
		invoice = r.InvoiceID
	}
	if created != 1 || count(t, db, "SELECT COUNT(*) FROM invoices WHERE appointment_id=?", appointment) != 1 ||
		count(t, db, "SELECT COUNT(*) FROM invoice_items WHERE invoice_id=? AND amount=150000.00", invoice) != 1 ||
		count(t, db, "SELECT COUNT(*) FROM processed_events WHERE event_id=?", eventID) != 1 {
		t.Fatal("concurrent duplicates must create one invoice, item and dedup record")
	}
	if _, err := svc.Process(context.Background(), eventBody(eventID, appointment, "100.00")); !errors.Is(err, ErrPermanent) {
		t.Fatalf("conflicting event_id not rejected: %v", err)
	}
	if count(t, db, "SELECT COUNT(*) FROM invoices WHERE invoice_id=? AND total_amount=150000.00", invoice) != 1 {
		t.Fatal("conflicting duplicate changed invoice")
	}
}

func TestMySQLRollbackWhenInvoiceItemFails(t *testing.T) {
	db := testDatabase(t)
	// An intentional failure after the invoice insert must also undo the invoice
	// and processed_events insert. Only the isolated integration DB is modified.
	_, err := db.Exec(`ALTER TABLE invoice_items ADD CONSTRAINT billing_test_reject_amount CHECK (amount<>123.45)`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec("ALTER TABLE invoice_items DROP CHECK billing_test_reject_amount") })
	eventID, appointment := "evt-"+uuid.NewString(), uuid.NewString()
	_, err = (&Service{DB: db}).Process(context.Background(), eventBody(eventID, appointment, "123.45"))
	if err == nil || errors.Is(err, ErrPermanent) {
		t.Fatalf("expected a persistence error, got %v", err)
	}
	if count(t, db, "SELECT COUNT(*) FROM invoices WHERE appointment_id=?", appointment) != 0 ||
		count(t, db, "SELECT COUNT(*) FROM processed_events WHERE event_id=?", eventID) != 0 {
		t.Fatal("partial invoice or dedup record survived rollback")
	}
}

func eventually(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("condition did not become true before timeout")
}

func TestRabbitMQBillingLifecycle(t *testing.T) {
	db := testDatabase(t)
	uri := os.Getenv("BILLING_TEST_AMQP_URL")
	parsed, err := amqp.ParseURI(uri)
	if uri == "" {
		t.Skip("set BILLING_TEST_AMQP_URL to an isolated billing_test vhost")
	}
	if err != nil || !strings.HasPrefix(parsed.Vhost, "billing_test") {
		t.Fatal("RabbitMQ integration tests require an isolated billing_test vhost")
	}
	conn, err := amqp.Dial(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	ch, err := conn.Channel()
	if err != nil {
		t.Fatal(err)
	}
	defer ch.Close()
	for _, queue := range []string{QueueName, "billing.dlq", "pharmacy.dlq", "pharmacy.prescription.order.q", "notification.patient.alert.q"} {
		if _, err := ch.QueuePurge(queue, false); err != nil {
			t.Fatal(err)
		}
	}
	if err := ch.Confirm(false); err != nil {
		t.Fatal(err)
	}
	publish := func(body []byte) {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		confirmation, err := ch.PublishWithDeferredConfirmWithContext(ctx, "medcore.clinical.events", "clinical.consultation.completed", true, false,
			amqp.Publishing{DeliveryMode: amqp.Persistent, ContentType: "application/json", Body: body})
		if err != nil {
			t.Fatal(err)
		}
		if ok, err := confirmation.WaitContext(ctx); err != nil || !ok {
			t.Fatalf("publisher confirmation: %t %v", ok, err)
		}
	}
	inspect := func(queue string) amqp.Queue {
		t.Helper()
		q, err := ch.QueueInspect(queue)
		if err != nil {
			t.Fatal(err)
		}
		return q
	}
	var cancel context.CancelFunc
	var done chan error
	start := func(processor Processor) {
		ctx, stop := context.WithCancel(context.Background())
		cancel, done = stop, make(chan error, 1)
		go func() { done <- Consume(ctx, uri, processor) }()
		eventually(t, func() bool { return inspect(QueueName).Consumers == 1 })
	}
	stop := func() {
		cancel()
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			t.Fatal("consumer did not stop")
		}
		eventually(t, func() bool { return inspect(QueueName).Consumers == 0 })
	}
	t.Cleanup(func() {
		if cancel != nil {
			cancel()
		}
	})
	svc := &Service{DB: db}
	appointment, id := uuid.NewString(), "evt-"+uuid.NewString()
	t.Cleanup(func() {
		db.Exec("DELETE FROM processed_events WHERE event_id=?", id)
		db.Exec("DELETE FROM invoices WHERE appointment_id=?", appointment)
	})
	body := eventBody(id, appointment, json.Number("150000"))
	// No Billing consumer: three persistent messages remain Ready.
	for i := 0; i < 3; i++ {
		publish(body)
	}
	if inspect(QueueName).Messages != 3 || count(t, db, "SELECT COUNT(*) FROM invoices WHERE appointment_id=?", appointment) != 0 {
		t.Fatal("store-and-forward failed while Billing was stopped")
	}
	// Manual ACK: block processing and observe a delivery before any commit.
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	start(processorFunc(func(ctx context.Context, b []byte) (Result, error) {
		once.Do(func() { close(entered) })
		select {
		case <-release:
		case <-ctx.Done():
			return Result{}, ctx.Err()
		}
		return svc.Process(ctx, b)
	}))
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("consumer never received a delivery")
	}
	if inspect(QueueName).Messages != 2 || count(t, db, "SELECT COUNT(*) FROM processed_events WHERE event_id=?", id) != 0 {
		t.Fatal("prefetch/manual ACK allowed processing before release")
	}
	close(release)
	eventually(t, func() bool {
		return count(t, db, "SELECT COUNT(*) FROM processed_events WHERE event_id=?", id) == 1 && inspect(QueueName).Messages == 0
	})
	stop()
	if count(t, db, "SELECT COUNT(*) FROM invoices WHERE appointment_id=?", appointment) != 1 {
		t.Fatal("buffered duplicates created multiple invoices")
	}
	t.Log("PASS store-and-forward, manual ACK, prefetch=1 and duplicate delivery")

	// Corrupt JSON and invalid Billing fee are permanently rejected to Billing DLQ.
	start(svc)
	publish([]byte("{"))
	publish(eventBody("evt-"+uuid.NewString(), uuid.NewString(), "-1"))
	eventually(t, func() bool { return inspect("billing.dlq").Messages == 2 })
	stop()
	if inspect("pharmacy.dlq").Messages != 0 {
		t.Fatal("Billing poison leaked into Pharmacy DLQ")
	}
	t.Log("PASS malformed/negative-fee poison goes to Billing DLQ only")

	// A failed database operation is requeued, not ACKed or dead-lettered.
	publish(body)
	ctx, stopSession := context.WithTimeout(context.Background(), 5*time.Second)
	err = Consume(ctx, uri, processorFunc(func(context.Context, []byte) (Result, error) { return Result{}, errors.New("injected database outage") }))
	stopSession()
	if err == nil || inspect(QueueName).Messages != 1 || inspect("billing.dlq").Messages != 2 {
		t.Fatalf("database failure did not retain delivery: %v", err)
	}
	start(svc)
	eventually(t, func() bool { return inspect(QueueName).Messages == 0 })
	stop()
	t.Log("PASS failed persistence retains message and recovery deduplicates it")

	// Real transaction commits but the processor simulates a lost commit reply.
	otherID, otherAppointment := "evt-"+uuid.NewString(), uuid.NewString()
	t.Cleanup(func() {
		db.Exec("DELETE FROM processed_events WHERE event_id=?", otherID)
		db.Exec("DELETE FROM invoices WHERE appointment_id=?", otherAppointment)
	})
	publish(eventBody(otherID, otherAppointment, "0.10"))
	ctx, stopSession = context.WithTimeout(context.Background(), 5*time.Second)
	err = Consume(ctx, uri, processorFunc(func(ctx context.Context, b []byte) (Result, error) {
		r, err := svc.Process(ctx, b)
		if err != nil {
			return r, err
		}
		return r, errors.New("injected lost commit reply")
	}))
	stopSession()
	if err == nil || inspect(QueueName).Messages != 1 {
		t.Fatalf("uncertain commit not requeued: %v", err)
	}
	start(svc)
	eventually(t, func() bool { return inspect(QueueName).Messages == 0 })
	stop()
	if count(t, db, "SELECT COUNT(*) FROM invoices WHERE appointment_id=?", otherAppointment) != 1 {
		t.Fatal("lost commit reply caused a second invoice")
	}
	t.Log("PASS committed invoice remains single after lost-reply redelivery")
}
