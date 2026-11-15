#!/bin/sh
set -eu

# D owns broker topology. Use the broker container's credentials and vhost;
# do not source host .env files or discard existing queues/messages.
docker exec -i "${RABBITMQ_CONTAINER:-medcore-message-broker}" sh -s <<'BROKER'
set -eu
admin() {
  rabbitmqadmin -u "$RABBITMQ_DEFAULT_USER" -p "$RABBITMQ_DEFAULT_PASS" \
    -V "$RABBITMQ_DEFAULT_VHOST" "$@"
}
admin declare exchange name=medcore.clinical.events type=topic durable=true
admin declare exchange name=medcore.deadletter.exchange type=fanout durable=true
admin declare queue name=pharmacy.dlq durable=true
admin declare binding source=medcore.deadletter.exchange destination=pharmacy.dlq
admin declare queue name=pharmacy.prescription.order.q durable=true \
  arguments='{"x-dead-letter-exchange":"medcore.deadletter.exchange"}'
admin declare binding source=medcore.clinical.events \
  destination=pharmacy.prescription.order.q routing_key='clinical.consultation.*'

# Billing failures stay separate from Pharmacy failures for independent auditing.
admin declare exchange name=medcore.billing.deadletter.exchange type=fanout durable=true
admin declare queue name=billing.dlq durable=true
admin declare binding source=medcore.billing.deadletter.exchange destination=billing.dlq
admin declare queue name=billing.invoice.q durable=true \
  arguments='{"x-dead-letter-exchange":"medcore.billing.deadletter.exchange"}'
admin declare binding source=medcore.clinical.events \
  destination=billing.invoice.q routing_key=clinical.consultation.completed

# Same names/arguments as A's existing worker; no change to its code.
admin declare queue name=notification.patient.alert.q durable=true
admin declare binding source=medcore.clinical.events \
  destination=notification.patient.alert.q routing_key='clinical.#'
BROKER
