// Database configuration module to switch between SQLite and PostgreSQL
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// Database type constants
export const DB_TYPES = {
  SQLITE: 'sqlite',
  POSTGRES: 'postgres'
};

// Get database type based on DATABASE_PROVIDER environment variable
export function getDatabaseType() {
  const provider = process.env.DATABASE_PROVIDER?.toLowerCase();
  return provider === 'postgres' || provider === 'postgresql' ? DB_TYPES.POSTGRES : DB_TYPES.SQLITE;
}

// SQLite connection
let sqliteDb = null;

async function getSQLiteConnection() {
  if (sqliteDb) return sqliteDb;

  const dbPath = join(process.cwd(), 'Phase1', 'DB', 'app.db');
  
  sqliteDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  return sqliteDb;
}

// PostgreSQL connection
let pgPool = null;

function getPostgreSQLConnection() {
  if (pgPool) return pgPool;

  const { Pool } = pg;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  return pgPool;
}

// Generic database interface
export class DatabaseAdapter {
  constructor(type) {
    this.type = type;
    this.connection = null;
  }

  async connect() {
    if (this.type === DB_TYPES.SQLITE) {
      this.connection = await getSQLiteConnection();
    } else {
      this.connection = getPostgreSQLConnection();
    }
    return this.connection;
  }

  async query(sql, params = []) {
    await this.connect();

    if (this.type === DB_TYPES.SQLITE) {
      // For SQLite, use the sqlite wrapper methods
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return await this.connection.all(sql, params);
      } else {
        return await this.connection.run(sql, params);
      }
    } else {
      // For PostgreSQL, convert ? placeholders to $1, $2, etc.
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.connection.query(pgSql, params);
      return result.rows;
    }
  }

  async all(sql, params = []) {
    await this.connect();

    if (this.type === DB_TYPES.SQLITE) {
      return await this.connection.all(sql, params);
    } else {
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.connection.query(pgSql, params);
      return result.rows;
    }
  }

  async get(sql, params = []) {
    await this.connect();

    if (this.type === DB_TYPES.SQLITE) {
      return await this.connection.get(sql, params);
    } else {
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.connection.query(pgSql, params);
      return result.rows[0] || null;
    }
  }

  async run(sql, params = []) {
    await this.connect();

    if (this.type === DB_TYPES.SQLITE) {
      return await this.connection.run(sql, params);
    } else {
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.connection.query(pgSql, params);
      return {
        // Some INSERTs may not return rows (no RETURNING clause) or insert into tables without an 'id' column.
        lastID: result.rows[0]?.id || null,
        changes: result.rowCount
      };
    }
  }

  async exec(sql) {
    await this.connect();

    if (this.type === DB_TYPES.SQLITE) {
      return await this.connection.exec(sql);
    } else {
      return await this.connection.query(sql);
    }
  }

  // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
  convertPlaceholders(sql) {
    if (this.type === DB_TYPES.SQLITE) return sql;
    
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  // Convert SQLite-specific SQL to PostgreSQL-compatible SQL
  convertSQLToPostgreSQL(sql) {
    if (this.type === DB_TYPES.SQLITE) return sql;

    return sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
      .replace(/TEXT/g, 'VARCHAR')
      .replace(/REAL/g, 'NUMERIC')
      .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
      .replace(/CURRENT_TIMESTAMP/g, 'NOW()')
      .replace(/DATE/g, 'DATE')
      .replace(/BOOLEAN/g, 'BOOLEAN')
      .replace(/DATETIME/g, 'TIMESTAMP');
  }
}

// Export singleton database adapter
let dbAdapter = null;

export function getDbAdapter() {
  if (!dbAdapter) {
    const dbType = getDatabaseType();
    dbAdapter = new DatabaseAdapter(dbType);
  }
  return dbAdapter;
}