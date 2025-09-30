# Database Setup - SQLite for Development, PostgreSQL for Production

This project supports dual database configuration:
- **SQLite** for development (local development)
- **PostgreSQL** for production (deployment)

## How it works

The database type is automatically determined based on the `NODE_ENV` environment variable:
- `NODE_ENV=development` → Uses SQLite (default)
- `NODE_ENV=production` → Uses PostgreSQL

## Development Setup (SQLite)

For local development, no additional setup is required. The application will automatically:
1. Use the existing SQLite database at `Phase1/DB/app.db`
2. Run all existing migrations automatically
3. Create the database file if it doesn't exist

```bash
# Development (default)
npm run dev
```

## Production Setup (PostgreSQL)

### 1. Environment Variables

Set these environment variables in production:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

### 2. Database Initialization

Run the PostgreSQL schema to set up your production database:

```sql
-- Connect to your PostgreSQL database and run:
-- db/postgres/schema.sql
```

### 3. Platform-Specific Setup

#### Vercel with Neon/Supabase
1. Create a PostgreSQL database on Neon or Supabase
2. Add the `DATABASE_URL` to your Vercel environment variables
3. Deploy - the schema will be automatically created

#### Heroku
1. Add the Heroku Postgres add-on
2. The `DATABASE_URL` is automatically provided
3. Deploy - the schema will be automatically created

#### Railway
1. Add a PostgreSQL service
2. The `DATABASE_URL` is automatically provided
3. Deploy - the schema will be automatically created

## Database Schema Management

### SQLite (Development)
- Uses existing schema at `Phase1/DB/schema.sql`
- Runs incremental migrations automatically
- All existing migration files are preserved

### PostgreSQL (Production)
- Uses optimized schema at `db/postgres/schema.sql`
- Includes all tables and indexes from the latest SQLite schema
- Uses PostgreSQL-specific data types and features
- Automatic timestamp triggers for updated_at columns

## Key Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Data Types | INTEGER, TEXT, REAL | SERIAL, VARCHAR, NUMERIC |
| Auto Increment | AUTOINCREMENT | SERIAL |
| Timestamps | datetime('now') | CURRENT_TIMESTAMP |
| Triggers | SQLite syntax | PostgreSQL functions |
| Placeholders | ? | $1, $2, $3... |

## Code Usage

The database adapter automatically handles these differences. Your existing code doesn't need to change:

```javascript
import { getDatabase } from './lib/db.js';

// This works the same in both SQLite and PostgreSQL
const database = await getDatabase();
const user = await database.get('SELECT * FROM users WHERE email = ?', [email]);
```

## Testing Database Switching

### Test SQLite (Development)
```bash
NODE_ENV=development npm run dev
```

### Test PostgreSQL (with local PostgreSQL)
```bash
# Set up local PostgreSQL database first
NODE_ENV=production DATABASE_URL=postgresql://user:pass@localhost:5432/testdb npm run dev
```

## Migration Strategy

When deploying to production for the first time:

1. **Data Migration** (if you have existing data):
   - Export data from SQLite: `sqlite3 app.db .dump > data.sql`
   - Convert to PostgreSQL format and import

2. **Fresh Deployment**:
   - Just deploy with `NODE_ENV=production`
   - Schema will be created automatically

## Troubleshooting

### Common Issues

1. **Connection errors**: Check `DATABASE_URL` format
2. **Schema errors**: Ensure PostgreSQL database exists
3. **Migration issues**: Check logs for specific SQL errors

### Debug Mode

Add logging to see which database is being used:

```javascript
import { getDatabaseType } from './lib/db-config.js';
console.log('Using database type:', getDatabaseType());
```