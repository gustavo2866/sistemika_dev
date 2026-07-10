# Deploy GCP config - before vs after

## Context
This document compares the real automatic deploy configuration used in GitHub Actions:
- production workflow (master)
- test workflow (test)

Change commit:
- commit: `455ca1e641b95688c25bd2cb31479331ce1895f6`
- date: `2026-06-13 19:03:30 -0300`
- message: `dev-033 (fix 2 - gcp config)`

## Production workflow

### Before (parent commit: `455ca1e^`)
```bash
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --source ./sak/backend \
  --region ${{ env.REGION }} \
  --project ${{ env.PROJECT_ID }} \
  --service-account ${{ env.SERVICE_ACCOUNT }} \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=3600 \
  --max-instances=10 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="ENV=prod,CORS_ORIGINS=https://wcl.vercel.app;http://localhost:3000,CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\\.vercel\\.app,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=${{ env.PROJECT_ID }},GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

### After (commit: `455ca1e` and current)
```bash
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --source ./sak/backend \
  --region ${{ env.REGION }} \
  --project ${{ env.PROJECT_ID }} \
  --service-account ${{ env.SERVICE_ACCOUNT }} \
  --allow-unauthenticated \
  --cpu=1 \
  --no-cpu-throttling \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=3600 \
  --min-instances=1 \
  --max-instances=10 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="ENV=prod,OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini,CORS_ORIGINS=https://wcl.vercel.app;http://localhost:3000,CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\\.vercel\\.app,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=${{ env.PROJECT_ID }},GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

### Delta (production)
- Added `--no-cpu-throttling`
- Added `--min-instances=1`
- Added env var `OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini`

## Test workflow

### Before (parent commit: `455ca1e^`)
```bash
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --source ./sak/backend \
  --region ${{ env.REGION }} \
  --project ${{ env.PROJECT_ID }} \
  --service-account ${{ env.SERVICE_ACCOUNT }} \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=3600 \
  --max-instances=10 \
  --set-secrets="DATABASE_URL=DATABASE_URL_TEST:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="ENV=test,CORS_ORIGINS=https://wcl.vercel.app;http://localhost:3000,CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\\.vercel\\.app,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=${{ env.PROJECT_ID }},GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

### After (commit: `455ca1e` and current)
```bash
gcloud run deploy ${{ env.SERVICE_NAME }} \
  --source ./sak/backend \
  --region ${{ env.REGION }} \
  --project ${{ env.PROJECT_ID }} \
  --service-account ${{ env.SERVICE_ACCOUNT }} \
  --allow-unauthenticated \
  --cpu=1 \
  --no-cpu-throttling \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=3600 \
  --min-instances=1 \
  --max-instances=10 \
  --set-secrets="DATABASE_URL=DATABASE_URL_TEST:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="ENV=test,OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini,CORS_ORIGINS=https://wcl.vercel.app;http://localhost:3000,CORS_ORIGINS_REGEX=https://.*-gustavo2866s-projects\\.vercel\\.app,SQLALCHEMY_ECHO=0,GCS_PROJECT_ID=${{ env.PROJECT_ID }},GCS_BUCKET_NAME=sak-wcl-bucket,GCS_INVOICE_FOLDER=facturas"
```

### Delta (test)
- Added `--no-cpu-throttling`
- Added `--min-instances=1`
- Added env var `OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini`

## Why this matters
- `--no-cpu-throttling` reduces cold-wait style latency during idle periods.
- `--min-instances=1` keeps one instance warm and improves response consistency.
- `OPENAI_CHAT_REPLY_MODEL=gpt-4.1-mini` pins the agent reply model in runtime config.
