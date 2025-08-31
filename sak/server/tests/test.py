import requests
import time

BASE = "http://127.0.0.1:8000"


def create_item(payload):
    r = requests.post(f"{BASE}/items", json=payload)
    print("CREATE", r.status_code, r.text)
    return r


def list_items():
    r = requests.get(f"{BASE}/items")
    print("LIST", r.status_code, r.text)
    return r


def get_item(item_id):
    r = requests.get(f"{BASE}/items/{item_id}")
    print("GET", r.status_code, r.text)
    return r


def patch_item(item_id, payload):
    r = requests.patch(f"{BASE}/items/{item_id}", json=payload)
    print("PATCH", r.status_code, r.text)
    return r


def delete_item(item_id):
    r = requests.delete(f"{BASE}/items/{item_id}")
    print("DELETE", r.status_code)
    return r


if __name__ == "__main__":
    # small smoke test
    print("Starting smoke tests...\n")
    # create without meta
    r1 = create_item({"name": "Smoke1", "description": "desc1"})
    time.sleep(0.2)
    # create with meta (should be ignored)
    r2 = create_item({"id": 9999, "name": "Smoke2", "description": "desc2", "creado_en": "2000-01-01T00:00:00Z"})
    time.sleep(0.2)
    # list
    list_items()
    # get first created if any
    try:
        j = r1.json()
        item_id = j.get("id")
        if item_id:
            get_item(item_id)
            patch_item(item_id, {"description": "updated"})
            get_item(item_id)
            delete_item(item_id)
    except Exception as e:
        print("Skipping further steps, error:", e)

    print("Done")
