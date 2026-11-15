package consumer

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrPermanent = errors.New("invalid billing event")

// Keep the publisher's JSON envelope; unrelated prescription fields are ignored.
type Event struct {
	EventID    string `json:"event_id"`
	EventName  string `json:"event_name"`
	OccurredAt string `json:"occurred_at"`
	Producer   string `json:"producer"`
	Payload    struct {
		AppointmentID      string `json:"appointment_id"`
		PatientID          string `json:"patient_id"`
		ConsultationStatus string `json:"consultation_status"`
		BillingSummary     struct {
			ConsultationFee json.Number `json:"consultation_fee"`
		} `json:"billing_summary"`
	} `json:"payload"`
}

func permanent(message string) error { return fmt.Errorf("%w: %s", ErrPermanent, message) }

func parseEvent(body []byte) (Event, string, string, error) {
	var evt Event
	if len(body) > 64*1024 {
		return evt, "", "", permanent("payload exceeds 64 KiB")
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&evt); err != nil {
		return evt, "", "", permanent("malformed JSON")
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return evt, "", "", permanent("expected one JSON object")
	}
	// Appointment currently prefixes UUIDs with evt-. Accept both representations.
	if !validUUID(strings.TrimPrefix(evt.EventID, "evt-")) ||
		!validUUID(evt.Payload.PatientID) || !validUUID(evt.Payload.AppointmentID) {
		return evt, "", "", permanent("event, patient or appointment ID is invalid")
	}
	if evt.EventName != "ConsultationCompletedEvent" || evt.Producer != "appointment-service" ||
		evt.Payload.ConsultationStatus != "COMPLETED" {
		return evt, "", "", permanent("expected a completed consultation from appointment-service")
	}
	when, err := time.Parse(time.RFC3339Nano, evt.OccurredAt)
	if err != nil {
		return evt, "", "", permanent("occurred_at must be RFC3339")
	}
	amount, err := decimalAmount(evt.Payload.BillingSummary.ConsultationFee)
	if err != nil {
		return evt, "", "", err
	}
	// Hash canonical business data, independent of whitespace, JSON key order and
	// equivalent decimal/time representations. No cross-domain prescription data.
	canonical, _ := json.Marshal([]string{evt.EventID, evt.EventName, evt.Producer,
		when.UTC().Format(time.RFC3339Nano), evt.Payload.AppointmentID,
		evt.Payload.PatientID, evt.Payload.ConsultationStatus, amount})
	hash := sha256.Sum256(canonical)
	return evt, amount, hex.EncodeToString(hash[:]), nil
}

func validUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	id, err := uuid.Parse(s)
	return err == nil && id != uuid.Nil
}

// Parse JSON decimal numbers exactly; never round through a float64. The existing
// Billing schema uses DECIMAL(12,2), with at most 9999999999.99 per invoice.
func decimalAmount(n json.Number) (string, error) {
	if len(n.String()) == 0 || len(n.String()) > 64 {
		return "", permanent("consultation_fee is missing or too long")
	}
	// Bound the exponent before big.Rat allocates an arbitrary-size integer.
	s := strings.ToLower(n.String())
	if i := strings.IndexByte(s, 'e'); i >= 0 {
		var exp int
		if _, err := fmt.Sscanf(s[i+1:], "%d", &exp); err != nil || exp < -20 || exp > 20 {
			return "", permanent("consultation_fee exponent is out of range")
		}
	}
	r, ok := new(big.Rat).SetString(s)
	if !ok || r.Sign() < 0 {
		return "", permanent("consultation_fee must be nonnegative")
	}
	r.Mul(r, big.NewRat(100, 1))
	if !r.IsInt() || r.Num().Cmp(big.NewInt(999999999999)) > 0 {
		return "", permanent("consultation_fee must fit DECIMAL(12,2) without rounding")
	}
	cents := r.Num().Int64()
	return fmt.Sprintf("%d.%02d", cents/100, cents%100), nil
}
