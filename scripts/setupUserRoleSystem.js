#!/usr/bin/env node

/**
 * User Role System Setup Script
 * Adds role column to users table and sets admin privileges
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupUserRoles() {
  console.log('🚀 Starting user role system setup...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env.local');
    console.error('Please add DATABASE_URL to your .env.local file');
    process.exit(1);
  }

  console.log('📡 Connecting to database...');
  console.log(`   URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');

    try {
      // Check if role column already exists
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
      `);

      if (columnCheck.rows.length === 0) {
        console.log('📖 Reading migration file...');
        const migrationPath = join(__dirname, '..', 'Phase1', 'PGDB', 'add-user-role-column.sql');
        const migration = readFileSync(migrationPath, 'utf8');
        console.log('✅ Migration file loaded\n');

        console.log('🔨 Adding role column...');
        await client.query(migration);
        console.log('✅ Role column added successfully\n');
      } else {
        console.log('✅ Role column already exists\n');
      }

      // Set admin role for indev@test.com user
      console.log('👤 Setting up admin user...');
      const userCheck = await client.query(`
        SELECT id, username, email, role FROM users WHERE email = 'indev@test.com'
      `);

      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        console.log(`   Found user: ${user.email} (current role: ${user.role})`);

        if (user.role !== 'Admin') {
          await client.query(`
            UPDATE users SET role = 'Admin' WHERE email = 'indev@test.com'
          `);
          console.log('✅ indev@test.com updated to Admin role');
        } else {
          console.log('✅ indev@test.com already has Admin role');
        }
      } else {
        console.log('⚠️  Warning: indev@test.com user not found');
      }

      // Display all users with their roles
      const allUsers = await client.query(`
        SELECT id, username, email, role 
        FROM users 
        ORDER BY id
      `);

      console.log('\n📋 All users and their roles:');
      console.table(allUsers.rows);

      console.log('\n✨ User role system setup complete!');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n❌ Error during setup:');
    console.error(error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Make sure PostgreSQL is running and DATABASE_URL is correct');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupUserRoles().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
