#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://neondb_owner:npg_8QamKog9wCyv@ep-wild-surf-adq0py68-pooler.c-2.us-east-1.aws.neon.tech/neondb?schema=public&sslmode=require&pgbouncer=true&connect_timeout=15"
export DIRECT_DATABASE_URL="postgresql://neondb_owner:npg_8QamKog9wCyv@ep-wild-surf-adq0py68.c-2.us-east-1.aws.neon.tech/neondb?schema=public&sslmode=require"
export JWT_SECRET="dev-secret-for-sandbox-preview-only-not-for-production"
exec bun run dev
