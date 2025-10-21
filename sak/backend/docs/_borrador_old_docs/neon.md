# Recommended for most uses
DATABASE_URL=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require

# For uses requiring a connection without pgbouncer
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require

# Parameters for constructing your own connection string
PGHOST=ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech
PGHOST_UNPOOLED=ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech
PGUSER=neondb_owner
PGDATABASE=neondb
PGPASSWORD=npg_2HqUWwPRtEy7

# Parameters for Vercel Postgres Templates
POSTGRES_URL=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e.sa-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_USER=neondb_owner
POSTGRES_HOST=ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech
POSTGRES_PASSWORD=npg_2HqUWwPRtEy7
POSTGRES_DATABASE=neondb
POSTGRES_URL_NO_SSL=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb
POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_2HqUWwPRtEy7@ep-steep-bird-acyo7x0e-pooler.sa-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
