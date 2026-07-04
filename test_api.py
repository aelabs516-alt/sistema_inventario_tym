import urllib.request
import json

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/products/SKU-1",
    data=b'{"sku":"SKU-1","name":"Test Product"}',
    headers={"Content-Type": "application/json"},
    method="PUT"
)
try:
    print("PUT response:", urllib.request.urlopen(req).read().decode())
    print("GET response:", urllib.request.urlopen("http://127.0.0.1:8000/api/products/SKU-1").read().decode())
except Exception as e:
    print("Error:", e)
