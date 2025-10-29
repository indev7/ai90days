#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Data Migration Script
 * 
 * This script migrates all data from SQLite to PostgreSQL.
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js
 * 
 * Prerequisites:
 *   1. Set DATABASE_PROVIDER=sqlite in .env.local to read from SQLite
 *   2. Set DATABASE_URL to your PostgreSQL connection string
 *   3. Run `npx prisma db push` to create PostgreSQL tables
 *   4. Run `npx prisma generate` to generate Prisma client
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { PrismaClient } from '../lib/generated/prisma/index.js';
import { join } from 'path';

const prisma = new PrismaClient();

async function openSQLiteDB() {
  const dbPath = join(process.cwd(), 'Phase1', 'DB', 'app.db');
  return await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

async function migrateUsers(sqliteDb) {
  console.log('\n📊 Migrating users...');
  const users = await sqliteDb.all('SELECT * FROM users');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const user of users) {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          username: user.username,
          passwordHash: user.password_hash,
          displayName: user.display_name,
          email: user.email,
          microsoftId: user.microsoft_id,
          firstName: user.first_name,
          lastName: user.last_name,
          profilePictureUrl: user.profile_picture_url,
          authProvider: user.auth_provider || 'email',
          preferences: user.preferences,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at)
        },
        create: {
          id: user.id,
          username: user.username,
          passwordHash: user.password_hash,
          displayName: user.display_name,
          email: user.email,
          microsoftId: user.microsoft_id,
          firstName: user.first_name,
          lastName: user.last_name,
          profilePictureUrl: user.profile_picture_url,
          authProvider: user.auth_provider || 'email',
          preferences: user.preferences,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating user ${user.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} users (${skipped} skipped)`);
}

async function migrateGroups(sqliteDb) {
  console.log('\n📊 Migrating groups...');
  const groups = await sqliteDb.all('SELECT * FROM groups');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const group of groups) {
    try {
      await prisma.group.upsert({
        where: { id: group.id },
        update: {
          name: group.name,
          type: group.type,
          parentGroupId: group.parent_group_id,
          thumbnailUrl: group.thumbnail_url,
          createdAt: new Date(group.created_at),
          updatedAt: new Date(group.updated_at)
        },
        create: {
          id: group.id,
          name: group.name,
          type: group.type,
          parentGroupId: group.parent_group_id,
          thumbnailUrl: group.thumbnail_url,
          createdAt: new Date(group.created_at),
          updatedAt: new Date(group.updated_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating group ${group.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} groups (${skipped} skipped)`);
}

async function migrateOKRTs(sqliteDb) {
  console.log('\n📊 Migrating OKRTs...');
  const okrts = await sqliteDb.all('SELECT * FROM okrt');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const okrt of okrts) {
    try {
      await prisma.okrt.upsert({
        where: { id: okrt.id },
        update: {
          type: okrt.type,
          ownerId: okrt.owner_id,
          parentId: okrt.parent_id,
          title: okrt.title,
          description: okrt.description,
          progress: okrt.progress || 0,
          status: okrt.status || 'D',
          area: okrt.area,
          cycleQtr: okrt.cycle_qtr,
          orderIndex: okrt.order_index || 0,
          visibility: okrt.visibility || 'private',
          objectiveKind: okrt.objective_kind,
          krTargetNumber: okrt.kr_target_number,
          krUnit: okrt.kr_unit,
          krBaselineNumber: okrt.kr_baseline_number,
          weight: okrt.weight || 1.0,
          taskStatus: okrt.task_status,
          dueDate: okrt.due_date ? new Date(okrt.due_date) : null,
          recurrenceJson: okrt.recurrence_json,
          blockedBy: okrt.blocked_by,
          headerImageUrl: okrt.header_image_url,
          createdAt: new Date(okrt.created_at),
          updatedAt: new Date(okrt.updated_at)
        },
        create: {
          id: okrt.id,
          type: okrt.type,
          ownerId: okrt.owner_id,
          parentId: okrt.parent_id,
          title: okrt.title,
          description: okrt.description,
          progress: okrt.progress || 0,
          status: okrt.status || 'D',
          area: okrt.area,
          cycleQtr: okrt.cycle_qtr,
          orderIndex: okrt.order_index || 0,
          visibility: okrt.visibility || 'private',
          objectiveKind: okrt.objective_kind,
          krTargetNumber: okrt.kr_target_number,
          krUnit: okrt.kr_unit,
          krBaselineNumber: okrt.kr_baseline_number,
          weight: okrt.weight || 1.0,
          taskStatus: okrt.task_status,
          dueDate: okrt.due_date ? new Date(okrt.due_date) : null,
          recurrenceJson: okrt.recurrence_json,
          blockedBy: okrt.blocked_by,
          headerImageUrl: okrt.header_image_url,
          createdAt: new Date(okrt.created_at),
          updatedAt: new Date(okrt.updated_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating OKRT ${okrt.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} OKRTs (${skipped} skipped)`);
}

async function migrateUserGroups(sqliteDb) {
  console.log('\n📊 Migrating user-group relationships...');
  const userGroups = await sqliteDb.all('SELECT * FROM user_group');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const ug of userGroups) {
    try {
      await prisma.userGroup.upsert({
        where: {
          userId_groupId: {
            userId: ug.user_id,
            groupId: ug.group_id
          }
        },
        update: {
          isAdmin: ug.is_admin === 1,
          createdAt: new Date(ug.created_at)
        },
        create: {
          userId: ug.user_id,
          groupId: ug.group_id,
          isAdmin: ug.is_admin === 1,
          createdAt: new Date(ug.created_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating user-group ${ug.user_id}-${ug.group_id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} user-group relationships (${skipped} skipped)`);
}

async function migrateShares(sqliteDb) {
  console.log('\n📊 Migrating shares...');
  const shares = await sqliteDb.all('SELECT * FROM share');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const share of shares) {
    try {
      await prisma.share.upsert({
        where: {
          okrtId_groupOrUserId_shareType: {
            okrtId: share.okrt_id,
            groupOrUserId: share.group_or_user_id,
            shareType: share.share_type
          }
        },
        update: {
          createdAt: new Date(share.created_at)
        },
        create: {
          okrtId: share.okrt_id,
          groupOrUserId: share.group_or_user_id,
          shareType: share.share_type,
          createdAt: new Date(share.created_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating share ${share.okrt_id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} shares (${skipped} skipped)`);
}

async function migrateFollows(sqliteDb) {
  console.log('\n📊 Migrating follows...');
  const follows = await sqliteDb.all('SELECT * FROM follows');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const follow of follows) {
    try {
      await prisma.follow.upsert({
        where: {
          userId_objectiveId: {
            userId: follow.user_id,
            objectiveId: follow.objective_id
          }
        },
        update: {
          createdAt: new Date(follow.created_at)
        },
        create: {
          userId: follow.user_id,
          objectiveId: follow.objective_id,
          createdAt: new Date(follow.created_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating follow ${follow.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} follows (${skipped} skipped)`);
}

async function migrateNotifications(sqliteDb) {
  console.log('\n📊 Migrating notifications...');
  const notifications = await sqliteDb.all('SELECT * FROM notifications');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const notif of notifications) {
    try {
      await prisma.notification.create({
        data: {
          userId: notif.user_id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          relatedOkrtId: notif.related_okrt_id,
          relatedGroupId: notif.related_group_id,
          relatedUserId: notif.related_user_id,
          isRead: notif.is_read === 1,
          createdAt: new Date(notif.created_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating notification ${notif.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} notifications (${skipped} skipped)`);
}

async function migrateComments(sqliteDb) {
  console.log('\n📊 Migrating comments...');
  const comments = await sqliteDb.all('SELECT * FROM comments');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const comment of comments) {
    try {
      await prisma.comment.create({
        data: {
          comment: comment.comment,
          parentCommentId: comment.parent_comment_id,
          type: comment.type || 'text',
          count: comment.count || 1,
          sendingUser: comment.sending_user,
          receivingUser: comment.receiving_user,
          okrtId: comment.okrt_id,
          createdAt: new Date(comment.created_at),
          updatedAt: new Date(comment.updated_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating comment ${comment.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} comments (${skipped} skipped)`);
}

async function migrateTimeBlocks(sqliteDb) {
  console.log('\n📊 Migrating time blocks...');
  const timeBlocks = await sqliteDb.all('SELECT * FROM time_blocks');
  
  let migrated = 0;
  let skipped = 0;
  
  for (const tb of timeBlocks) {
    try {
      await prisma.timeBlock.create({
        data: {
          taskId: tb.task_id,
          userId: tb.user_id,
          startTime: new Date(tb.start_time),
          duration: tb.duration,
          objectiveId: tb.objective_id,
          createdAt: new Date(tb.created_at),
          updatedAt: new Date(tb.updated_at)
        }
      });
      migrated++;
    } catch (error) {
      console.error(`  ❌ Error migrating time block ${tb.id}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`  ✅ Migrated ${migrated} time blocks (${skipped} skipped)`);
}

async function main() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...\n');
  console.log('📋 Configuration:');
  console.log(`   SQLite DB: ${join(process.cwd(), 'Phase1', 'DB', 'app.db')}`);
  console.log(`   PostgreSQL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}\n`);
  
  let sqliteDb;
  
  try {
    // Open SQLite database
    sqliteDb = await openSQLiteDB();
    console.log('✅ Connected to SQLite database');
    
    // Test PostgreSQL connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Migrate in order (respecting foreign key constraints)
    await migrateUsers(sqliteDb);
    await migrateGroups(sqliteDb);
    await migrateOKRTs(sqliteDb);
    await migrateUserGroups(sqliteDb);
    await migrateShares(sqliteDb);
    await migrateFollows(sqliteDb);
    await migrateNotifications(sqliteDb);
    await migrateComments(sqliteDb);
    await migrateTimeBlocks(sqliteDb);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update DATABASE_PROVIDER=postgres in .env.local');
    console.log('   2. Restart your application');
    console.log('   3. Verify data in PostgreSQL using: npx prisma studio');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (sqliteDb) {
      await sqliteDb.close();
    }
    await prisma.$disconnect();
  }
}

main();