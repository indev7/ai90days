#!/usr/bin/env node
/**
 * Replicate schema to POSTGRES_URL and copy a specific user.
 * - Reads DATABASE_URL (source) and POSTGRES_URL (target) from .env.local
 * - Applies Phase1/PGDB/schema.sql to the target DB
 * - Copies the user with email indev@test.com into the target users table
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const REQUIRED_VARS = ['DATABASE_URL', 'POSTGRES_URL'];
const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required env vars in .env.local: ${missing.join(', ')}`);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '..', 'Phase1', 'PGDB', 'schema.sql');
const visionMissionMigrationPath = resolve(__dirname, '..', 'Phase1', 'PGDB', 'add-vision-mission-to-groups.sql');
const schemaSql = readFileSync(schemaPath, 'utf8');
const visionMissionSql = readFileSync(visionMissionMigrationPath, 'utf8');
const targetEmail = 'indev@test.com';

const sourcePool = new Pool({ connectionString: process.env.DATABASE_URL });
const targetPool = new Pool({ connectionString: process.env.POSTGRES_URL });

const mask = (url) => url.replace(/:(?!\/\/)[^:@]+@/, ':****@');

async function applySchema() {
  console.log(`Applying schema from ${schemaPath} to POSTGRES_URL (${mask(process.env.POSTGRES_URL)})...`);
  await targetPool.query(schemaSql);
  console.log('Schema applied to target DB.');
}

async function applyVisionMissionMigration() {
  console.log(`Applying vision/mission columns migration on target DB using ${visionMissionMigrationPath}...`);
  await targetPool.query(visionMissionSql);
  console.log('Vision/mission migration applied to target DB.');
}

async function fetchUser() {
  const { rows } = await sourcePool.query(
    `SELECT id, username, password_hash, display_name, email, created_at, updated_at,
            microsoft_id, first_name, last_name, profile_picture_url, auth_provider, preferences,
            microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at, role
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [targetEmail],
  );
  return rows[0];
}

async function upsertUser(user) {
  if (!user) {
    console.warn(`User ${targetEmail} not found in source DB.`);
    return;
  }

  console.log(`Upserting user ${targetEmail} into target DB...`);
  await targetPool.query(
    `INSERT INTO users (
        id, username, password_hash, display_name, email, created_at, updated_at,
        microsoft_id, first_name, last_name, profile_picture_url, auth_provider, preferences,
        microsoft_access_token, microsoft_refresh_token, microsoft_token_expires_at, role
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at,
        microsoft_id = EXCLUDED.microsoft_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        profile_picture_url = EXCLUDED.profile_picture_url,
        auth_provider = EXCLUDED.auth_provider,
        preferences = EXCLUDED.preferences,
        microsoft_access_token = EXCLUDED.microsoft_access_token,
        microsoft_refresh_token = EXCLUDED.microsoft_refresh_token,
        microsoft_token_expires_at = EXCLUDED.microsoft_token_expires_at,
        role = EXCLUDED.role`,
    [
      user.id,
      user.username,
      user.password_hash,
      user.display_name,
      user.email,
      user.created_at,
      user.updated_at,
      user.microsoft_id,
      user.first_name,
      user.last_name,
      user.profile_picture_url,
      user.auth_provider,
      user.preferences,
      user.microsoft_access_token,
      user.microsoft_refresh_token,
      user.microsoft_token_expires_at,
      user.role,
    ],
  );

  // Align the sequence so future inserts work as expected.
  await targetPool.query(
    `SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1))`,
  );
  console.log('User upserted and sequence aligned.');
}

async function main() {
  console.log(`Source DB:  ${mask(process.env.DATABASE_URL)}`);
  console.log(`Target DB:  ${mask(process.env.POSTGRES_URL)}\n`);

  try {
    await sourcePool.query('SELECT 1');
    await targetPool.query('SELECT 1');

    await applySchema();
    await applyVisionMissionMigration();
    const user = await fetchUser();
    await upsertUser(user);

    console.log('\n✨ Done! Database schema replicated and user copied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([sourcePool.end(), targetPool.end()]);
  }
}

main();
