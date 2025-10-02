# Dual Database Setup - Complete Guide

## ✅ New Enhanced Database Switching

Your project now uses **DATABASE_PROVIDER** for explicit database control!

### 🎯 Why This is Better:

❌ **Old Problem**: `NODE_ENV` was controlled by Next.js (`npm run dev` = always development)  
✅ **New Solution**: `DATABASE_PROVIDER` gives you full control over database selection

## 🔧 How to Switch Databases:

### For PostgreSQL (Production/Testing):
```bash
# In .env file:
DATABASE_PROVIDER=postgres
DATABASE_URL="postgresql://your-connection-string"
```

### For SQLite (Development):
```bash
# In .env file:
DATABASE_PROVIDER=sqlite
# (DATABASE_URL not needed)
```

## 🚀 Deployment Configurations:

### Vercel Production Deployment:

**Environment Variables in Vercel Dashboard:**
```
DATABASE_PROVIDER = postgres
DATABASE_URL = postgresql://neondb_owner:npg_bN4fWrL2vjAO@ep-blue-lab-a1l4uics-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### Local Development Options:

**Option 1: SQLite (Fast local development)**
```bash
# .env file:
DATABASE_PROVIDER=sqlite
npm run dev
```

**Option 2: Test with PostgreSQL locally**
```bash
# .env file:
DATABASE_PROVIDER=postgres
DATABASE_URL="postgresql://your-neon-url"
npm run dev
```

## 📊 Database Switching Matrix:

| DATABASE_PROVIDER | Database Used | Best For |
|-------------------|---------------|----------|
| `sqlite`          | SQLite        | Development, Testing |
| `postgres`        | PostgreSQL    | Production, Staging |
| `postgresql`      | PostgreSQL    | (Alternative name) |
| *not set*         | SQLite        | Default fallback |

## 🎯 Current Status:

✅ **Working in development**: `npm run dev` with any database  
✅ **Production ready**: Works on Vercel with PostgreSQL  
✅ **Easy switching**: Just change `DATABASE_PROVIDER`  
✅ **No Next.js conflicts**: Independent of `NODE_ENV`  

## 🔄 Quick Switch Commands:

```bash
# Switch to SQLite for development
echo "DATABASE_PROVIDER=sqlite" > .env.local

# Switch to PostgreSQL for testing
echo "DATABASE_PROVIDER=postgres" > .env.local
echo "DATABASE_URL=postgresql://..." >> .env.local

# Use Vercel environment for production
# (Set in Vercel dashboard)
```

Your database switching is now bulletproof! 🎉