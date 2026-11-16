package consumer

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	exchangeName = "medcore.clinical.events"
	queueName    = "pharmacy.prescription.order.q"
	dlxName      = "medcore.deadletter.exchange"
	exhaustedKey = "clinical.pharmacy.stock.exhausted" // sepakati dengan Arya
)

type EventEnvelope struct {
	EventID string `json:"event_id"`
	Payload struct {
		AppointmentID string `json:"appointment_id"`
		PatientID     string `json:"patient_id"`
		Prescription  struct {
			PrescriptionID string `json:"prescription_id"`
			Items          []struct {
				DrugCode string `json:"drug_code"`
				Quantity int    `json:"quantity"`
			} `json:"items"`
		} `json:"prescription"`
	} `json:"payload"`
}

type ProcessedEventRecord struct {
	EventID     string    `bson:"event_id"`
	ProcessedAt time.Time `bson:"processed_at"`
	Status      string    `bson:"status"`
}

type StockExhaustedEvent struct {
	EventID    string `json:"event_id"`
	EventName  string `json:"event_name"`
	OccurredAt string `json:"occurred_at"`
	Producer   string `json:"producer"`
	Payload    struct {
		AppointmentID  string `json:"appointment_id"`
		PatientID      string `json:"patient_id"`
		PrescriptionID string `json:"prescription_id"`
		DrugCode       string `json:"drug_code"`
		RequestedQty   int    `json:"requested_quantity"`
		Reason         string `json:"reason"`
	} `json:"payload"`
}

func StartPrescriptionConsumer(amqpURI string, mongoClient *mongo.Client) {
	conn, err := amqp.Dial(amqpURI)
	if err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal koneksi broker: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal membuka channel: %v", err)
	}
	defer ch.Close()

	// Exchange dideklarasikan juga di sini agar urutan start layanan tidak masalah
	if err := ch.ExchangeDeclare(exchangeName, "topic", true, false, false, false, nil); err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal deklarasi exchange: %v", err)
	}

	// Queue durable + Dead Letter Exchange
	args := amqp.Table{"x-dead-letter-exchange": dlxName}
	q, err := ch.QueueDeclare(queueName, true, false, false, false, args)
	if err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal deklarasi queue: %v", err)
	}
	if err := ch.QueueBind(q.Name, "clinical.consultation.*", exchangeName, false, nil); err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal binding queue: %v", err)
	}
	if err := ch.Qos(1, 0, false); err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal set QoS: %v", err)
	}

	db := mongoClient.Database("medcore_pharmacy_db")

	// Unique index: pengaman terakhir terhadap duplikasi event_id
	ictx, icancel := context.WithTimeout(context.Background(), 10*time.Second)
	_, err = db.Collection("processed_events").Indexes().CreateOne(ictx, mongo.IndexModel{
		Keys:    bson.D{{Key: "event_id", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	icancel()
	if err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal membuat index processed_events: %v", err)
	}

	msgs, err := ch.Consume(q.Name, "pharmacy-worker", false, false, false, false, nil) // autoAck = false
	if err != nil {
		log.Fatalf("[Pharmacy Consumer] Gagal subscribe: %v", err)
	}
	log.Printf("[Pharmacy Consumer] Menunggu pesan resep pada antrean: %s", q.Name)

	for d := range msgs {
		handleDelivery(ch, db, d)
	}
	log.Println("[Pharmacy Consumer] Channel ditutup, consumer berhenti.")
}

func handleDelivery(ch *amqp.Channel, db *mongo.Database, d amqp.Delivery) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Validasi format -> poison message langsung ke DLQ
	var evt EventEnvelope
	if err := json.Unmarshal(d.Body, &evt); err != nil {
		log.Printf("[Pharmacy Consumer] Format pesan tidak valid, NACK tanpa requeue: %v", err)
		d.Nack(false, false)
		return
	}
	items := evt.Payload.Prescription.Items
	if evt.EventID == "" || len(items) == 0 {
		log.Printf("[Pharmacy Consumer] Event tanpa event_id/items, NACK ke DLQ.")
		d.Nack(false, false)
		return
	}
	for _, it := range items {
		if it.Quantity <= 0 {
			log.Printf("[Pharmacy Consumer] Terdeteksi Poison Message! Kuantitas tidak valid: %d. Mengirim NACK ke DLQ.", it.Quantity)
			d.Nack(false, false) // requeue=false -> DLX -> pharmacy.dlq
			return
		}
	}

	events := db.Collection("processed_events")
	drugs := db.Collection("drugs")

	// 2. Cek idempotensi
	err := events.FindOne(ctx, bson.M{"event_id": evt.EventID}).Err()
	if err == nil {
		log.Printf("[Deduplication Guard] Event %s terdeteksi duplikat! Melewati eksekusi bisnis dan langsung mengirim ACK.", evt.EventID)
		d.Ack(false)
		return
	}
	if err != mongo.ErrNoDocuments {
		log.Printf("[Error] Gagal cek deduplikasi: %v. Requeue.", err)
		requeueLater(d)
		return
	}

	// 3. Logika bisnis: potong stok per item
	log.Println("---------------------------------------------------------")
	log.Printf("[Pharmacy Consumer] Menerima Resep Baru!")
	log.Printf(" Event ID        : %s", evt.EventID)
	log.Printf(" Appointment ID  : %s", evt.Payload.AppointmentID)
	log.Printf(" Prescription ID : %s", evt.Payload.Prescription.PrescriptionID)

	type deducted struct {
		code string
		qty  int
	}
	var done []deducted
	rollback := func() {
		for _, x := range done {
			drugs.UpdateOne(ctx, bson.M{"drug_code": x.code}, bson.M{"$inc": bson.M{"total_stock": x.qty}})
		}
	}

	for _, it := range items {
		log.Printf(" -> Item: %s | Qty: %d", it.DrugCode, it.Quantity)
		res, err := drugs.UpdateOne(ctx,
			bson.M{"drug_code": it.DrugCode, "total_stock": bson.M{"$gte": it.Quantity}},
			bson.M{"$inc": bson.M{"total_stock": -it.Quantity}},
		)
		if err != nil {
			rollback()
			log.Printf("[Error] Gagal update stok: %v. Requeue.", err)
			requeueLater(d)
			return
		}
		if res.MatchedCount == 0 {
			// Stok kosong/kurang atau obat tidak ada -> Compensation Event
			rollback()
			log.Printf("[Business Logic] Stok %s tidak mencukupi. Menerbitkan compensation event.", it.DrugCode)
			if err := publishStockExhausted(ctx, ch, evt, it.DrugCode, it.Quantity); err != nil {
				log.Printf("[Error] Gagal publish compensation event: %v. Requeue.", err)
				requeueLater(d)
				return
			}
			recordAndAck(ctx, events, evt.EventID, "STOCK_EXHAUSTED", d)
			return
		}
		done = append(done, deducted{it.DrugCode, it.Quantity})
	}

	// 4. Catat event_id, lalu ACK
	recordAndAck(ctx, events, evt.EventID, "SUCCESS", d)
	log.Printf("[Pharmacy Consumer] Transaksi selesai sempurna dan Event %s dicatat.", evt.EventID)
	log.Println("---------------------------------------------------------")
}

func recordAndAck(ctx context.Context, events *mongo.Collection, eventID, status string, d amqp.Delivery) {
	_, err := events.InsertOne(ctx, ProcessedEventRecord{EventID: eventID, ProcessedAt: time.Now(), Status: status})
	if err != nil && !mongo.IsDuplicateKeyError(err) {
		log.Printf("[Error] Gagal mencatat deduplikasi: %v. Requeue pesan.", err)
		requeueLater(d)
		return
	}
	d.Ack(false)
	log.Printf("[Pharmacy Consumer] Pesan berhasil di-ACK (status %s).", status)
}

func requeueLater(d amqp.Delivery) {
	time.Sleep(2 * time.Second) // cegah loop requeue super cepat
	d.Nack(false, true)
}

func publishStockExhausted(ctx context.Context, ch *amqp.Channel, in EventEnvelope, drugCode string, qty int) error {
	var out StockExhaustedEvent
	out.EventID = "evt-" + uuid.New().String()
	out.EventName = "medcore.event.pharmacy.stock.exhausted"
	out.OccurredAt = time.Now().UTC().Format(time.RFC3339)
	out.Producer = "pharmacy-service"
	out.Payload.AppointmentID = in.Payload.AppointmentID
	out.Payload.PatientID = in.Payload.PatientID
	out.Payload.PrescriptionID = in.Payload.Prescription.PrescriptionID
	out.Payload.DrugCode = drugCode
	out.Payload.RequestedQty = qty
	out.Payload.Reason = "OUT_OF_STOCK"

	body, err := json.Marshal(out)
	if err != nil {
		return err
	}
	return ch.PublishWithContext(ctx, exchangeName, exhaustedKey, false, false, amqp.Publishing{
		DeliveryMode: amqp.Persistent,
		ContentType:  "application/json",
		MessageId:    out.EventID,
		Timestamp:    time.Now(),
		Type:         out.EventName,
		Body:         body,
	})
}
