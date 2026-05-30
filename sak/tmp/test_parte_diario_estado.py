import urllib.request, json

BASE = "http://localhost:8000/parte-diario-estados"

# GET by id
r = urllib.request.urlopen(BASE + "/1")
item = json.loads(r.read())
print("GET /1:", item["abreviatura"], "-", item["nombre"])

# POST nuevo estado
data = json.dumps({"abreviatura": "TST", "nombre": "TEST", "activo": True}).encode()
req = urllib.request.Request(BASE, data=data, headers={"Content-Type": "application/json"}, method="POST")
new = json.loads(urllib.request.urlopen(req).read())
print("POST:", new["id"], new["abreviatura"])

# PUT update
nid = new["id"]
data2 = json.dumps({"nombre": "TEST ACTUALIZADO", "activo": False, "version": 1}).encode()
req2 = urllib.request.Request(BASE + "/" + str(nid), data=data2, headers={"Content-Type": "application/json"}, method="PUT")
updated = json.loads(urllib.request.urlopen(req2).read())
print("PUT:", updated["nombre"], "| activo:", updated["activo"])

# DELETE soft
req3 = urllib.request.Request(BASE + "/" + str(nid), method="DELETE")
r3 = urllib.request.urlopen(req3)
print("DELETE status:", r3.status)

print("\nTodos los endpoints OK")
