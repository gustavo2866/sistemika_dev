import httpx
import asyncio

async def test_token():
    token = "EAAQ5VhZB8sb4BQCfpXxusmQDrTigbm5R8LrSsRDepFtCOH9Q4dNuyF7vY9nAiG9cnP0ynpI4ZCjPDgleLkZBPl5CoVe97hS6jZA8zu1Aimv31TGzXxArwHz4o5lEeSzLK2LaPegfhZBWzZAiH0HAmUFduOoSZAkvzWQHFWAqOEwiJe7PSEytcUIseLT7xnGyImSi6sCEDZC5ofhO2z1KbcuoaI9zQMKC16jcA0HojMs8DCQ7tIO42PdPFLruFYhcILHHM5DDp7F2lrJaVglfp0jS"
    phone_id = "891207920743299"
    
    url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": "+541156384310",
        "type": "template",
        "template": {
            "name": "hello_world",
            "language": {"code": "en_US"},
        },
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test_token())
