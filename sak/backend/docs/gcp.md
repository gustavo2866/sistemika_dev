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