# Database Migration Guide: SQLite to PostgreSQL

This guide explains how to migrate your 90 Days Goal & Coaching App from SQLite to PostgreSQL while maintaining the ability to switch between databases for local development.

## Overview

The application now supports **dual database connectivity**:
- **SQLite**: For local development and testing
- **PostgreSQL**: For production deployment

The system automatically switches between databases based on the `DATABASE_PROVIDER` environment variable.

## What's Been Implemented

### 1. ✅ Prisma Schema (`prisma/schema.prisma`)
Complete PostgreSQL-compatible schema with all tables:
- Users (with Microsoft OAuth support)
- OKRT (Objectives, Key Results, Tasks)
- Groups (hierarchical structure)
- User-Group relationships
- Shares (OKRT sharing)
- Follows (objective following)
- Notifications
- Comments (with rewards system)
- Time Blocks (task scheduling)

### 2. ✅ Dual Database Layer (`lib/db.js`)
Updated database abstraction layer that:
- Automatically detects `DATABASE_PROVIDER` environment variable
- Uses Prisma Client for PostgreSQL
- Uses sqlite3 for SQLite
- Provides identical API for both databases
- Handles data format conversion between databases

### 3. ✅ Migration Script (`scripts/migrate-sqlite-to-postgres.js`)
Automated data migration script that copies all data from SQLite to PostgreSQL:
- Migrates all tables in correct order (respecting foreign keys)
- Handles data type conversions
- Provides progress feedback
- Skips duplicate entries (upsert logic)

## Setup Instructions

### Step 1: Install Dependencies

The required dependencies are already in your `package.json`:
```bash
npm install
```

### Step 2: Configure Environment Variables

Update your `.env.local` file:

```env
# Database Configuration
DATABASE_PROVIDER=postgres  # or 'sqlite' for local development
DATABASE_URL=postgresql://neondb_owner:npg_WN18JVSmlzDF@ep-dry-dust-abglz4jw-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Keep your existing variables
SESSION_SECRET=your-super-secret-session-key
MICROSOFT_CLIENT_ID=ac3031fc-728a-4b8a-8a87-0d9a8369e7cd
# ... etc
```

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

This creates the Prisma Client in `lib/generated/prisma/`.

### Step 4: Create PostgreSQL Tables

Push the schema to your PostgreSQL database:

```bash
npx prisma db push
```

This will create all tables in your PostgreSQL database.

### Step 5: Verify Tables (Optional)

Open Prisma Studio to browse your PostgreSQL database:

```bash
npx prisma studio
```

This opens a web interface at http://localhost:5555 where you can see all tables.

### Step 6: Migrate Data from SQLite

If you have existing data in SQLite that you want to migrate:

```bash
node scripts/migrate-sqlite-to-postgres.js
```

The script will:
- Connect to both databases
- Copy all data from SQLite to PostgreSQL
- Show progress for each table
- Report any errors

**Note**: The script uses upsert logic, so it's safe to run multiple times.

### Step 7: Switch to PostgreSQL

Update `.env.local`:
```env
DATABASE_PROVIDER=postgres
```

### Step 8: Restart Your Application

```bash
npm run dev
```

Your application is now using PostgreSQL! 🎉

## Switching Between Databases

### Use SQLite (Local Development)
```env
DATABASE_PROVIDER=sqlite
```

### Use PostgreSQL (Production)
```env
DATABASE_PROVIDER=postgres
DATABASE_URL=your_postgresql_connection_string
```

## Database Schema Overview

### Core Tables

1. **users** - User accounts with OAuth support
2. **okrt** - Objectives, Key Results, and Tasks
3. **groups** - Hierarchical group structure
4. **user_group** - Many-to-many user-group relationships
5. **share** - OKRT sharing with groups/users
6. **follows** - User following of objectives
7. **notifications** - System notifications
8. **comments** - Comments and rewards on OKRTs
9. **time_blocks** - Task scheduling/time blocking

### Key Features

- **Hierarchical OKRTs**: Parent-child relationships for objectives
- **Group Hierarchy**: Nested group structure (Organization → Department → Team)
- **Flexible Sharing**: Share OKRTs with groups or individual users
- **Rich Comments**: Text comments plus reward system (medals, stars, cookies)
- **Time Blocking**: Schedule tasks with start time and duration

## Troubleshooting

### Issue: "Can't reach database server"

**Solution**: Ensure your PostgreSQL database is running and the `DATABASE_URL` is correct.

For Neon.tech (your current provider):
1. Log into https://neon.tech
2. Verify your database is active
3. Check the connection string matches your `.env.local`

### Issue: "Prisma Client not found"

**Solution**: Run `npx prisma generate` to create the client.

### Issue: "Table doesn't exist"

**Solution**: Run `npx prisma db push` to create tables in PostgreSQL.

### Issue: Migration script fails

**Solution**: 
1. Check both databases are accessible
2. Ensure Prisma Client is generated
3. Verify PostgreSQL tables exist
4. Check the error message for specific table/field issues

### Issue: Data type mismatch

**Solution**: The migration script handles most conversions automatically:
- SQLite INTEGER → PostgreSQL INT
- SQLite TEXT → PostgreSQL VARCHAR/TEXT
- SQLite REAL → PostgreSQL FLOAT
- SQLite datetime strings → PostgreSQL TIMESTAMP

## Database Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Setup** | Zero config | Requires server |
| **Performance** | Fast for small data | Scales better |
| **Concurrent Writes** | Limited | Excellent |
| **Data Types** | Basic | Rich types |
| **Full-text Search** | Limited | Advanced |
| **JSON Support** | Basic | Native JSONB |
| **Best For** | Development, Testing | Production |

## Production Deployment Checklist

- [ ] PostgreSQL database provisioned (Neon.tech, Supabase, etc.)
- [ ] `DATABASE_URL` set in production environment
- [ ] `DATABASE_PROVIDER=postgres` in production
- [ ] Run `npx prisma generate` in build process
- [ ] Run `npx prisma db push` or migrations
- [ ] Migrate data if needed
- [ ] Test all CRUD operations
- [ ] Monitor database performance
- [ ] Set up database backups

## Prisma Studio

Browse and edit your database data:

```bash
npx prisma studio
```

This works with both SQLite and PostgreSQL based on your `DATABASE_PROVIDER` setting.

## Advanced: Custom Migrations

If you need to make schema changes:

1. Update `prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name your_migration_name`
3. Apply to production: `npx prisma migrate deploy`

## Support

For issues or questions:
1. Check Prisma docs: https://www.prisma.io/docs
2. Check your database provider docs (Neon.tech)
3. Review the error logs in the terminal

## Files Modified/Created

### Modified
- `prisma/schema.prisma` - Complete PostgreSQL schema
- `lib/db.js` - Dual database support layer
- `.env.local` - Added DATABASE_PROVIDER and DATABASE_URL

### Created
- `scripts/migrate-sqlite-to-postgres.js` - Data migration script
- `lib/generated/prisma/` - Generated Prisma Client (auto-generated)
- `DATABASE_MIGRATION_GUIDE.md` - This guide

### Backup
- `lib/db.sqlite.backup.js` - Original SQLite-only version (backup)

## Next Steps

1. ✅ Prisma schema created
2. ✅ Dual database layer implemented
3. ✅ Migration script created
4. ✅ Prisma client generated
5. ⏳ Push schema to PostgreSQL (`npx prisma db push`)
6. ⏳ Migrate data (`node scripts/migrate-sqlite-to-postgres.js`)
7. ⏳ Test application with PostgreSQL
8. ⏳ Deploy to production

---

**Note**: Your SQLite database remains untouched. You can always switch back by setting `DATABASE_PROVIDER=sqlite` in `.env.local`.