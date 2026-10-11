#!/usr/bin/env python3
"""Real REST requests through the existing checkout API and its gRPC consumer."""
import json
import os
from pathlib import Path
import socket
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("SUPERMART_BACKEND_URL", "http://127.0.0.1:3001/api/v1")
REST = os.environ.get("SUPERMART_INVENTORY_URL", "http://127.0.0.1:8081/api/v1/inventory/check-stock")
PRODUCT = "p0000001-0000-0000-0000-000000000001"
SECOND = "p0000002-0000-0000-0000-000000000002"
WAREHOUSE = "w0000001-0000-0000-0000-000000000001"
TOKEN = ""

def request(method, url, data=None, authenticated=False):
    headers = {"Content-Type": "application/json"}
    if authenticated:
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

def available():
    code, body = request("GET", f"{REST}?product_id={PRODUCT}&warehouse_id={WAREHOUSE}")
    assert code == 200, body
    return int(body["available_qty"])

def main():
    global TOKEN
    print(f"Hostname: {socket.gethostname()}")
    before = available()
    email = f"tugas2-{uuid.uuid4()}@example.test"
    code, body = request("POST", BASE+"/auth/register", {"email": email, "password": "LocalFixtureOnly!42", "full_name": "Tugas 2 Smoke", "phone_number": "000"})
    assert code in (200, 201), body
    TOKEN = body["data"]["token"]
    code, body = request("POST", BASE+"/auth/addresses", {"address_label":"Fixture", "recipient_name":"Tugas 2", "phone_number":"000", "street_address":"Fixture", "city":"Denpasar", "province":"Bali", "postal_code":"00000", "is_primary":True}, True)
    assert code in (200, 201), body
    code, body = request("GET", BASE+"/auth/addresses", authenticated=True)
    assert code == 200 and body.get("data"), body
    address = body["data"][0]["id"]
    code, body = request("POST", BASE+"/orders/cart", {"product_id":PRODUCT, "quantity":2}, True)
    assert code in (200,201), body
    code, body = request("POST", BASE+"/orders/cart", {"product_id":SECOND, "quantity":3}, True)
    assert code in (200,201), body
    checkout = {"shipping_address_id":address, "warehouse_id":WAREHOUSE}
    code, body = request("POST", BASE+"/orders/checkout", checkout, True)
    assert code >= 400, (code,body)
    assert available() == before, "partial checkout left stock reserved"
    print("PASS partial checkout: insufficient second product leaves first product unchanged")
    code, cart = request("GET", BASE+"/orders/cart", authenticated=True)
    assert code == 200, cart
    item = next(it for it in cart["data"]["items"] if it["product_id"] == SECOND)
    code, body = request("DELETE", BASE+"/orders/cart/"+item["id"], authenticated=True)
    assert code in (200,204), body
    invalid_checkout = dict(checkout, shipping_address_id=str(uuid.uuid4()))
    code, body = request("POST", BASE+"/orders/checkout", invalid_checkout, True)
    assert code >= 400 and "insert order" in str(body), (code, body)
    assert available() == before, "order DB failure did not release its committed inventory hold"
    print("PASS order save failure: invalid address FK triggers compensation of committed hold")
    code, body = request("POST", BASE+"/orders/checkout", checkout, True)
    assert code in (200,201), body
    order_id = body["data"]["id"]
    assert available() == before-2, "successful network checkout did not hold stock"
    print(f"PASS successful checkout: order={order_id}; two units held via gRPC")
    code, body = request("POST", BASE+f"/orders/{order_id}/cancel", {"reason":"Tugas 2 smoke compensation"}, True)
    assert code == 200, body
    assert available() == before, "cancel did not compensate"
    print("PASS cancellation: stock restored; read-only benchmark fixture unchanged")

if __name__ == "__main__":
    main()
