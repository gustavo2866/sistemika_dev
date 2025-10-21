# Dar permisos al secret OPENAI_API_KEY (con guion bajo)
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=sak-wcl

# Dar permisos al secret JWT_SECRET (con guion bajo)
gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=sak-wcl

# Dar permisos al secret DATABASE_URL (ya debería tener)
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:sak-wcl-service@sak-wcl.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=sak-wcl

  Resumen de tus Secrets:
Secret en GCP	Variable de entorno	Estado
DATABASE_URL	DATABASE_URL	✅ Creado
DATABASE_URL_DIRECT	(sin pooler - opcional)	✅ Creado
JWT_SECRET	JWT_SECRET	✅ Creado
OPENAI_API_KEY	OPENAI_API_KEY	✅ Creado


Variable	Valor	Descripción
GCS_PROJECT_ID	sak-wcl	ID del proyecto GCP
GCS_BUCKET_NAME	sak-facturas-prod	Nombre del bucket (debes crearlo)
ENV	prod	Ambiente de ejecución
CORS_ORIGINS	Tu URL del frontend	URLs permitidas para CORS

Producción (GCP Cloud Run):
https://sak-backend-94464199991.us-central1.run.app

api key
{
  "type": "service_account",
  "project_id": "sak-wcl",
  "private_key_id": "d1a44049ff8852a5af65ffdf5f7e8547a05ccbf6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCswQZrlseQ6cNR\nziZ3tG5qQ4QkxhKYp6HCnTaKEbGxMaE54LUJ793HpH/wXH9pt8acMUYA6shDrvV8\nqwH/CDSnlStqbLQkTOFdBZbrYSBpgPwGHwg3X7TCbRYMgVTdmVD9xGl8GTmKdAtJ\nxVHMchSMdP3xNZtFE1YdKqHTlYw2aQYXV/Mk5S2wiHZeCB0vf5DXCkgkr3lZP0/W\nX47M5ndk1K9b2o1A88ycSvjHigE2YohKSbDoXpo1fCO7NHMU3zavFVbN8JSP9Fj6\nuqIkOyzNflYzYVuv6ot+Mzi0nBoiE16ruSdYoC4qcysGDXlTJ7be/gLXMflvpQKt\nnJ5yQgolAgMBAAECggEAB/rRlFouZTn7EPYMDlb6C7QLMFSq6rzBitcOvCF1mwj/\nGMiRrEAVd0GYvE5Vf1ljFfdrs6KktgWopsXSbYigQAZyrzOOvaeEeHLH5h8CK4Vu\n/sxjqYUk+R8nV9QIisToehReyAH1R7k1BUcVUHOLkfJcgY4XmkD6pxW/TGH5zFCJ\noRzmDQtFVZ+zrhHrHruRy0jr5fkcDSyUMSU2+vUhBybwj9kATgnk/T+3m19fqBxh\n4e19e/xcb9sPvUdBr5bNdBZBSC1fYMWvFRkfJnuGBnfDXvg1cv5Nui8QHXwyKlfw\nCCwSQDD2xbQOektHq4oLeHp37llrbl6LRljVTm0i2QKBgQDir8A5n8OQUxN6CtVd\nR5kMpoBB9mjrvTvAzbTZ51CKsrjNjXK/AstxSy0/ju6boFzkghMShKNXxnI9V9TJ\n7FGTW2y3ijBp7iBiqgWAgtoAq9Lqk/QI60b73qFb9oN5DuxoU5jYKtptXjuHCS3o\n0Yua4F5isj46yt1+a/SSeeW+fQKBgQDDF+M6QRewRjg4k2rM37Pm3k1q7Y+4m6S6\n7OUha/NT/U+uaJrT7StrelL9mwrkwJN/mq+N7CtbclulM7NMfO3enciZTvwY8h4N\nt0n8xbTu/dpeItWpmXfX4qXQxcPsptDCM1Tk6+uZYE40RMYyrOOWVl12AQZIdePa\n3EZW//SCyQKBgQDE7DBs3qEg60psJqUbl2sZVjrtEoYq5ATYhNqqwQtysbdguZQI\n4wCgttHj+OLHRxPrXiP7XkYXpkjviTFNCIIFJNLYzq8oFrkDfPeyn/mJw7pCFa1V\nYi4T917taMTlkVVFe/m3L+L4R3gm4o6DRiWksWzNCFKO+FRZ0qZv6HzwcQKBgHii\nMLM4xLkO8nypSwTb3pYHJ7/SnWf9deLP0O7VnWR14etqazJYGN0gimiekiHYolvo\n/ly3iCfHkruYOGo3Za6dyghiOqgCLms0xt8yMSsGdRx4Vb3FU8F+OCHb58ZRcAxl\nST00VD5GupS/Yf67wQ6Y4Lmy8Hulyfru8d+h7UNhAoGBAMw54snT/+aivO4zE9/T\neoKg1JNY0qosN9GatBnUnbnufBjLJNQ9e+acFEl5opGw1kfs0WmG7PiNDdqvQEpI\ncbIur0EuqrbNtK+/V9plCzU2UOEdQ1SZFMvmY9Y1Wju8kekIvGMzl51wCSfkCl8+\nwgrZrjGdVVFD3n+BLbEVhDE7\n-----END PRIVATE KEY-----\n",
  "client_email": "sak-wcl-service@sak-wcl.iam.gserviceaccount.com",
  "client_id": "108262985388783409882",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sak-wcl-service%40sak-wcl.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
