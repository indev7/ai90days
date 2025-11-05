#!/bin/bash

# Direct migration script for time_blocks timezone fix
# Run this with: bash scripts/run-migration-directly.sh

echo "Time Blocks Timezone Migration"
echo "==============================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    # Try to load from .env.local
    if [ -f .env.local ]; then
        export $(cat .env.local | grep DATABASE_URL | xargs)
        echo "Loaded DATABASE_URL from .env.local"
    elif [ -f .env ]; then
        export $(cat .env | grep DATABASE_URL | xargs)
        echo "Loaded DATABASE_URL from .env"
    else
        echo "Error: No .env or .env.local file found!"
        exit 1
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not found in environment files!"
    exit 1
fi

echo "Running migration..."
echo ""

# Run the migration SQL directly
psql "$DATABASE_URL" -f Phase1/PGDB/migrate-time-blocks-timestamptz.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Verifying column types..."
    psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'time_blocks' AND column_name IN ('start_time', 'created_at', 'updated_at') ORDER BY column_name;"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi