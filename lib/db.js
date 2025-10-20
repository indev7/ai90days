// Dual Database Support: SQLite and PostgreSQL
// Switches between databases based on DATABASE_PROVIDER environment variable

const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';

let db = null;
let prisma = null;

// Lazy-loaded SQLite dependencies
let sqlite3, open, readFileSync, join;

// Initialize the appropriate database connection
export async function getDatabase() {
  if (DATABASE_PROVIDER === 'postgres') {
    // Use Prisma for PostgreSQL
    if (!prisma) {
      const { PrismaClient } = await import('@prisma/client');
      prisma = new PrismaClient();
    }
    return prisma;
  } else {
    // Use SQLite with existing implementation
    if (db) return db;
    
    // Lazy load SQLite dependencies
    if (!sqlite3) {
      const sqlite3Module = await import('sqlite3');
      sqlite3 = sqlite3Module.default;
      const sqliteModule = await import('sqlite');
      open = sqliteModule.open;
      const fsModule = await import('fs');
      readFileSync = fsModule.readFileSync;
      const pathModule = await import('path');
      join = pathModule.join;
    }

    const dbPath = join(process.cwd(), 'Phase1', 'DB', 'app.db');
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Initialize schema and run migrations
    await initializeSQLiteSchema(db);
    
    return db;
  }
}

// Helper to determine if using Prisma/PostgreSQL
export function isPrisma() {
  return DATABASE_PROVIDER === 'postgres';
}

// SQLite schema initialization with all migrations
async function initializeSQLiteSchema(db) {
  try {
    const schemaPath = join(process.cwd(), 'Phase1', 'DB', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await db.exec(schema);
    
    // Check and run Phase 2 migration (Microsoft OAuth)
    try {
      await db.get('SELECT microsoft_id FROM users LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 2 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase2.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Database migration completed!');
    }
    
    // Check and run Phase 3 migration (OKRT table)
    try {
      await db.get('SELECT id FROM okrt LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 3 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase3.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 3 database migration completed!');
    }
    
    // Check and run Phase 6 migration (Groups and Sharing)
    try {
      await db.get('SELECT id FROM groups LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 6 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase6.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 6 database migration completed!');
    }
    
    // Check and run Phase 7 migration (Follow functionality)
    try {
      await db.get('SELECT id FROM follows LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 7 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase7.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 7 database migration completed!');
    }
    
    // Check and run Phase 8 migration (Notifications)
    try {
      await db.get('SELECT id FROM notifications LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 8 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase8.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 8 database migration completed!');
    }
    
    // Check and run Phase 9 migration (Comments)
    try {
      await db.get('SELECT id FROM comments LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 9 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase9.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 9 database migration completed!');
    }
    
    // Check and run Phase 11 migration (Time Blocks)
    try {
      await db.get('SELECT id FROM time_blocks LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 11 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase11.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 11 database migration completed!');
    }
    
    // Check and run Phase 14 migration (User Preferences)
    try {
      await db.get('SELECT preferences FROM users LIMIT 1');
    } catch (migrationError) {
      console.log('Migrating database to Phase 14 schema...');
      const migrationPath = join(process.cwd(), 'Phase1', 'DB', 'migrate-to-phase14.sql');
      const migration = readFileSync(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Phase 14 database migration completed!');
    }
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
}

// Helper function to convert Prisma result to SQLite-like format
function convertPrismaToSQLite(result) {
  if (!result) return result;
  if (Array.isArray(result)) return result;
  
  // Convert camelCase to snake_case for compatibility
  const converted = {};
  for (const [key, value] of Object.entries(result)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    converted[snakeKey] = value;
  }
  return converted;
}

// ============================================================================
// USER FUNCTIONS
// ============================================================================

export async function getUserByEmail(email) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const user = await prisma.user.findUnique({
      where: { email }
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM users WHERE email = ?', [email]);
  }
}

export async function getUserByUsername(username) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const user = await prisma.user.findUnique({
      where: { username }
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
  }
}

export async function createUser({ email, password_hash, display_name }) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const user = await prisma.user.create({
      data: {
        username: email,
        passwordHash: password_hash,
        displayName: display_name,
        email
      }
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    const username = email;
    
    const result = await database.run(
      'INSERT INTO users (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)',
      [username, password_hash, display_name, email]
    );
    
    return database.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
  }
}

export async function updateUser(userId, updateData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert snake_case to camelCase for Prisma
    const prismaData = {};
    for (const [key, value] of Object.entries(updateData)) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      prismaData[camelKey] = value;
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: prismaData
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    await database.run(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...updateValues, userId]
    );
    
    return database.get('SELECT * FROM users WHERE id = ?', [userId]);
  }
}

export async function getUserByMicrosoftId(microsoftId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const user = await prisma.user.findUnique({
      where: { microsoftId }
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM users WHERE microsoft_id = ?', [microsoftId]);
  }
}

export async function getUserById(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const user = await prisma.user.findUnique({
      where: { id }
    });
    return convertPrismaToSQLite(user);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM users WHERE id = ?', [userId]);
  }
}

export async function searchUsers(query, limit = 10) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true
      },
      take: limit,
      orderBy: { displayName: 'asc' }
    });
    return users.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT id, display_name, email, first_name, last_name, profile_picture_url
      FROM users
      WHERE (
        LOWER(display_name) LIKE LOWER(?) OR
        LOWER(email) LIKE LOWER(?) OR
        LOWER(first_name) LIKE LOWER(?) OR
        LOWER(last_name) LIKE LOWER(?)
      )
      ORDER BY display_name ASC
      LIMIT ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]);
  }
}

// ============================================================================
// OKRT FUNCTIONS
// ============================================================================

export async function createOKRT(okrtData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const {
      id, type, owner_id, parent_id, title, description, progress = 0,
      status = 'D', area, cycle_qtr, order_index = 0, visibility = 'private',
      objective_kind, kr_target_number, kr_unit, kr_baseline_number,
      weight = 1.0, task_status, due_date, recurrence_json, blocked_by
    } = okrtData;

    // Convert owner_id to integer for Prisma
    const ownerId = typeof owner_id === 'string' ? parseInt(owner_id, 10) : owner_id;

    const okrt = await prisma.okrt.create({
      data: {
        id,
        type,
        owner: {
          connect: { id: ownerId }
        },
        ...(parent_id && {
          parent: {
            connect: { id: parent_id }
          }
        }),
        title,
        description,
        progress,
        status,
        area,
        cycleQtr: cycle_qtr,
        orderIndex: order_index,
        visibility,
        objectiveKind: objective_kind,
        krTargetNumber: kr_target_number,
        krUnit: kr_unit,
        krBaselineNumber: kr_baseline_number,
        weight,
        taskStatus: task_status,
        dueDate: due_date,
        recurrenceJson: recurrence_json,
        ...(blocked_by && {
          blocker: {
            connect: { id: blocked_by }
          }
        })
      }
    });
    return convertPrismaToSQLite(okrt);
  } else {
    const database = await getDatabase();
    const {
      id, type, owner_id, parent_id, title, description, progress = 0,
      status = 'D', area, cycle_qtr, order_index = 0, visibility = 'private',
      objective_kind, kr_target_number, kr_unit, kr_baseline_number,
      weight = 1.0, task_status, due_date, recurrence_json, blocked_by
    } = okrtData;

    await database.run(`
      INSERT INTO okrt (
        id, type, owner_id, parent_id, title, description, progress, status,
        area, cycle_qtr, order_index, visibility, objective_kind,
        kr_target_number, kr_unit, kr_baseline_number, weight,
        task_status, due_date, recurrence_json, blocked_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, type, owner_id, parent_id, title, description, progress, status,
      area, cycle_qtr, order_index, visibility, objective_kind,
      kr_target_number, kr_unit, kr_baseline_number, weight,
      task_status, due_date, recurrence_json, blocked_by
    ]);

    return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
  }
}

export async function getOKRTById(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const okrt = await prisma.okrt.findUnique({
      where: { id }
    });
    return convertPrismaToSQLite(okrt);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
  }
}

export async function getOKRTsByOwner(ownerId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert ownerId to integer for Prisma
    const id = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;
    const okrts = await prisma.okrt.findMany({
      where: { ownerId: id },
      orderBy: { orderIndex: 'asc' }
    });
    return okrts.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM okrt WHERE owner_id = ? ORDER BY order_index ASC', [ownerId]);
  }
}

export async function getOKRTsByParent(parentId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const okrts = await prisma.okrt.findMany({
      where: { parentId },
      orderBy: { orderIndex: 'asc' }
    });
    return okrts.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM okrt WHERE parent_id = ? ORDER BY order_index ASC', [parentId]);
  }
}

export async function updateOKRT(id, updateData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert snake_case to camelCase for Prisma
    const prismaData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'updated_at') continue; // Prisma handles this automatically
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      prismaData[camelKey] = value;
    }
    
    const okrt = await prisma.okrt.update({
      where: { id },
      data: prismaData
    });
    return convertPrismaToSQLite(okrt);
  } else {
    const database = await getDatabase();
    
    updateData.updated_at = new Date().toISOString();
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    await database.run(
      `UPDATE okrt SET ${setClause} WHERE id = ?`,
      [...updateValues, id]
    );
    
    return database.get('SELECT * FROM okrt WHERE id = ?', [id]);
  }
}

export async function deleteOKRT(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    await prisma.okrt.delete({
      where: { id }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run('DELETE FROM okrt WHERE id = ?', [id]);
  }
}

export async function deleteOKRTCascade(rootId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Collect all descendant IDs
    const idsToDelete = [];
    const stack = [rootId];

    while (stack.length > 0) {
      const currentId = stack.pop();
      idsToDelete.push(currentId);
      const children = await prisma.okrt.findMany({
        where: { parentId: currentId },
        select: { id: true }
      });
      for (const child of children) {
        stack.push(child.id);
      }
    }

    // Delete all collected ids
    await prisma.okrt.deleteMany({
      where: { id: { in: idsToDelete } }
    });
  } else {
    const database = await getDatabase();
    const idsToDelete = [];
    const stack = [rootId];

    while (stack.length > 0) {
      const currentId = stack.pop();
      idsToDelete.push(currentId);
      const children = await database.all('SELECT id FROM okrt WHERE parent_id = ?', [currentId]);
      for (const child of children) {
        stack.push(child.id);
      }
    }

    const placeholders = idsToDelete.map(() => '?').join(', ');
    await database.run(`DELETE FROM okrt WHERE id IN (${placeholders})`, idsToDelete);
  }
}

export async function getOKRTHierarchy(ownerId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert ownerId to integer for Prisma
    const id = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;
    const okrts = await prisma.okrt.findMany({
      where: { ownerId: id },
      orderBy: [
        { parentId: 'asc' },
        { orderIndex: 'asc' }
      ]
    });
    return okrts.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT * FROM okrt 
      WHERE owner_id = ? 
      ORDER BY 
        CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
        order_index ASC
    `, [ownerId]);
  }
}

// ============================================================================
// GROUP FUNCTIONS
// ============================================================================

export async function createGroup(groupData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const { id, name, type, parent_group_id, thumbnail_url } = groupData;

    const group = await prisma.group.create({
      data: {
        id,
        name,
        type,
        parentGroupId: parent_group_id,
        thumbnailUrl: thumbnail_url
      }
    });
    return convertPrismaToSQLite(group);
  } else {
    const database = await getDatabase();
    const { id, name, type, parent_group_id, thumbnail_url } = groupData;

    await database.run(`
      INSERT INTO groups (id, name, type, parent_group_id, thumbnail_url)
      VALUES (?, ?, ?, ?, ?)
    `, [id, name, type, parent_group_id, thumbnail_url]);

    return database.get('SELECT * FROM groups WHERE id = ?', [id]);
  }
}

export async function getGroupById(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const group = await prisma.group.findUnique({
      where: { id }
    });
    return convertPrismaToSQLite(group);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM groups WHERE id = ?', [id]);
  }
}

export async function getAllGroups() {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const groups = await prisma.group.findMany({
      orderBy: { name: 'asc' }
    });
    return groups.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM groups ORDER BY name ASC');
  }
}

export async function getGroupsByParent(parentId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const groups = await prisma.group.findMany({
      where: { parentGroupId: parentId },
      orderBy: { name: 'asc' }
    });
    return groups.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM groups WHERE parent_group_id = ? ORDER BY name ASC', [parentId]);
  }
}

export async function getRootGroups() {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const groups = await prisma.group.findMany({
      where: { parentGroupId: null },
      orderBy: { name: 'asc' }
    });
    return groups.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM groups WHERE parent_group_id IS NULL ORDER BY name ASC');
  }
}

export async function updateGroup(id, updateData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const prismaData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'updated_at') continue;
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      prismaData[camelKey] = value;
    }
    
    const group = await prisma.group.update({
      where: { id },
      data: prismaData
    });
    return convertPrismaToSQLite(group);
  } else {
    const database = await getDatabase();
    
    updateData.updated_at = new Date().toISOString();
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    await database.run(
      `UPDATE groups SET ${setClause} WHERE id = ?`,
      [...updateValues, id]
    );
    
    return database.get('SELECT * FROM groups WHERE id = ?', [id]);
  }
}

export async function deleteGroup(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    await prisma.group.delete({
      where: { id }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run('DELETE FROM groups WHERE id = ?', [id]);
  }
}

// ============================================================================
// USER-GROUP RELATIONSHIP FUNCTIONS
// ============================================================================

export async function addUserToGroup(userId, groupId, isAdmin = false) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const userGroup = await prisma.userGroup.upsert({
      where: {
        userId_groupId: {
          userId: id,
          groupId
        }
      },
      update: { isAdmin },
      create: {
        userId: id,
        groupId,
        isAdmin
      }
    });
    return convertPrismaToSQLite(userGroup);
  } else {
    const database = await getDatabase();
    return database.run(`
      INSERT OR REPLACE INTO user_group (user_id, group_id, is_admin)
      VALUES (?, ?, ?)
    `, [userId, groupId, isAdmin]);
  }
}

export async function removeUserFromGroup(userId, groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    await prisma.userGroup.delete({
      where: {
        userId_groupId: {
          userId: id,
          groupId
        }
      }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run('DELETE FROM user_group WHERE user_id = ? AND group_id = ?', [userId, groupId]);
  }
}

export async function getUserGroups(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: id },
      include: { group: true },
      orderBy: { group: { name: 'asc' } }
    });
    return userGroups.map(ug => ({
      ...convertPrismaToSQLite(ug.group),
      is_admin: ug.isAdmin
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT g.*, ug.is_admin
      FROM groups g
      JOIN user_group ug ON g.id = ug.group_id
      WHERE ug.user_id = ?
      ORDER BY g.name ASC
    `, [userId]);
  }
}

export async function getUserAdminGroups(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const userGroups = await prisma.userGroup.findMany({
      where: {
        userId: id,
        isAdmin: true
      },
      include: { group: true },
      orderBy: { group: { name: 'asc' } }
    });
    return userGroups.map(ug => convertPrismaToSQLite(ug.group));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT g.*
      FROM groups g
      JOIN user_group ug ON g.id = ug.group_id
      WHERE ug.user_id = ? AND ug.is_admin = 1
      ORDER BY g.name ASC
    `, [userId]);
  }
}

export async function getGroupMembers(groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const userGroups = await prisma.userGroup.findMany({
      where: { groupId },
      include: { 
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true
          }
        }
      },
      orderBy: [
        { isAdmin: 'desc' },
        { user: { displayName: 'asc' } }
      ]
    });
    return userGroups.map(ug => ({
      ...convertPrismaToSQLite(ug.user),
      is_admin: ug.isAdmin
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT u.id, u.display_name, u.email, u.first_name, u.last_name, u.profile_picture_url, ug.is_admin
      FROM users u
      JOIN user_group ug ON u.id = ug.user_id
      WHERE ug.group_id = ?
      ORDER BY ug.is_admin DESC, u.display_name ASC
    `, [groupId]);
  }
}

export async function isUserGroupAdmin(userId, groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const userGroup = await prisma.userGroup.findUnique({
      where: {
        userId_groupId: {
          userId: id,
          groupId
        }
      }
    });
    return userGroup?.isAdmin || false;
  } else {
    const database = await getDatabase();
    const result = await database.get(`
      SELECT is_admin FROM user_group
      WHERE user_id = ? AND group_id = ?
    `, [userId, groupId]);
    return result?.is_admin || false;
  }
}

// ============================================================================
// SHARING FUNCTIONS
// ============================================================================

export async function shareOKRTWithGroup(okrtId, groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const share = await prisma.share.upsert({
      where: {
        okrtId_groupOrUserId_shareType: {
          okrtId,
          groupOrUserId: groupId,
          shareType: 'G'
        }
      },
      update: {},
      create: {
        okrtId,
        groupOrUserId: groupId,
        shareType: 'G'
      }
    });
    return convertPrismaToSQLite(share);
  } else {
    const database = await getDatabase();
    return database.run(`
      INSERT OR REPLACE INTO share (okrt_id, group_or_user_id, share_type)
      VALUES (?, ?, 'G')
    `, [okrtId, groupId]);
  }
}

export async function shareOKRTWithUser(okrtId, userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const share = await prisma.share.upsert({
      where: {
        okrtId_groupOrUserId_shareType: {
          okrtId,
          groupOrUserId: userId,
          shareType: 'U'
        }
      },
      update: {},
      create: {
        okrtId,
        groupOrUserId: userId,
        shareType: 'U'
      }
    });
    return convertPrismaToSQLite(share);
  } else {
    const database = await getDatabase();
    return database.run(`
      INSERT OR REPLACE INTO share (okrt_id, group_or_user_id, share_type)
      VALUES (?, ?, 'U')
    `, [okrtId, userId]);
  }
}

export async function unshareOKRT(okrtId, groupOrUserId, shareType) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    await prisma.share.delete({
      where: {
        okrtId_groupOrUserId_shareType: {
          okrtId,
          groupOrUserId,
          shareType
        }
      }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run(`
      DELETE FROM share
      WHERE okrt_id = ? AND group_or_user_id = ? AND share_type = ?
    `, [okrtId, groupOrUserId, shareType]);
  }
}

export async function getOKRTShares(okrtId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const shares = await prisma.share.findMany({
      where: { okrtId }
    });
    return shares.map(convertPrismaToSQLite);
  } else {
    const database = await getDatabase();
    return database.all('SELECT * FROM share WHERE okrt_id = ?', [okrtId]);
  }
}

export async function getSharedOKRTsForUser(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    // Get user's groups
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: id },
      select: { groupId: true }
    });
    const groupIds = userGroups.map(ug => ug.groupId);

    // Get shared OKRTs
    const shares = await prisma.share.findMany({
      where: {
        OR: [
          { shareType: 'U', groupOrUserId: id.toString() },
          { shareType: 'G', groupOrUserId: { in: groupIds } }
        ]
      },
      include: {
        okrt: {
          include: {
            owner: {
              select: { displayName: true }
            }
          }
        }
      }
    });

    // Get follow status
    const okrtIds = shares.map(s => s.okrtId);
    const follows = await prisma.follow.findMany({
      where: {
        userId: id,
        objectiveId: { in: okrtIds }
      }
    });
    const followedIds = new Set(follows.map(f => f.objectiveId));

    return shares.map(s => ({
      ...convertPrismaToSQLite(s.okrt),
      owner_name: s.okrt.owner.displayName,
      is_following: followedIds.has(s.okrtId) ? 1 : 0
    })).sort((a, b) => {
      if (a.is_following !== b.is_following) return a.is_following ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT DISTINCT o.*, u.display_name as owner_name,
             CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_following
      FROM okrt o
      JOIN users u ON o.owner_id = u.id
      JOIN share s ON o.id = s.okrt_id
      LEFT JOIN follows f ON o.id = f.objective_id AND f.user_id = ?
      WHERE (
        (s.share_type = 'U' AND s.group_or_user_id = ?)
        OR
        (s.share_type = 'G' AND s.group_or_user_id IN (
          SELECT group_id FROM user_group WHERE user_id = ?
        ))
      )
      AND o.visibility = 'shared'
      ORDER BY
        CASE WHEN f.id IS NOT NULL THEN 0 ELSE 1 END,
        o.updated_at DESC
    `, [userId, userId, userId]);
  }
}

export async function getGroupSharedOKRTCount(groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const count = await prisma.share.count({
      where: {
        groupOrUserId: groupId,
        shareType: 'G',
        okrt: {
          visibility: 'shared'
        }
      }
    });
    return count;
  } else {
    const database = await getDatabase();
    const result = await database.get(`
      SELECT COUNT(*) as count
      FROM share s
      JOIN okrt o ON s.okrt_id = o.id
      WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
    `, [groupId]);
    return result?.count || 0;
  }
}

export async function getGroupSharedOKRTs(groupId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const shares = await prisma.share.findMany({
      where: {
        groupOrUserId: groupId,
        shareType: 'G',
        okrt: {
          visibility: 'shared'
        }
      },
      include: {
        okrt: {
          include: {
            owner: {
              select: { displayName: true }
            }
          }
        }
      },
      orderBy: {
        okrt: { updatedAt: 'desc' }
      }
    });
    return shares.map(s => ({
      ...convertPrismaToSQLite(s.okrt),
      owner_name: s.okrt.owner.displayName
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT o.*, u.display_name as owner_name
      FROM okrt o
      JOIN users u ON o.owner_id = u.id
      JOIN share s ON o.id = s.okrt_id
      WHERE s.group_or_user_id = ? AND s.share_type = 'G' AND o.visibility = 'shared'
      ORDER BY o.updated_at DESC
    `, [groupId]);
  }
}

// ============================================================================
// FOLLOW FUNCTIONS
// ============================================================================

export async function getOKRTFollowers(okrtId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const follows = await prisma.follow.findMany({
      where: { objectiveId: okrtId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });
    return follows.map(f => ({
      user_id: f.userId,
      display_name: f.user.displayName
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT f.user_id, u.display_name
      FROM follows f
      JOIN users u ON f.user_id = u.id
      WHERE f.objective_id = ?
    `, [okrtId]);
  }
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

export async function createNotification(notificationData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const {
      user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
    } = notificationData;

    const notification = await prisma.notification.create({
      data: {
        userId: user_id,
        type,
        title,
        message,
        relatedOkrtId: related_okrt_id,
        relatedGroupId: related_group_id,
        relatedUserId: related_user_id
      }
    });
    return convertPrismaToSQLite(notification);
  } else {
    const database = await getDatabase();
    const {
      user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
    } = notificationData;

    const result = await database.run(`
      INSERT INTO notifications (
        user_id, type, title, message, related_okrt_id, related_group_id, related_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [user_id, type, title, message, related_okrt_id, related_group_id, related_user_id]);

    return database.get('SELECT * FROM notifications WHERE id = ?', [result.lastID]);
  }
}

export async function getNotificationsByUser(userId, limit = 50) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const notifications = await prisma.notification.findMany({
      where: { userId: id },
      include: {
        relatedOkrt: {
          select: { title: true }
        },
        relatedGroup: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return notifications.map(n => ({
      ...convertPrismaToSQLite(n),
      related_okrt_title: n.relatedOkrt?.title,
      related_group_name: n.relatedGroup?.name,
      related_user_name: null // Would need to join users table
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT n.*,
             u.display_name as related_user_name,
             o.title as related_okrt_title,
             g.name as related_group_name
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      LEFT JOIN okrt o ON n.related_okrt_id = o.id
      LEFT JOIN groups g ON n.related_group_id = g.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `, [userId, limit]);
  }
}

export async function getUnreadNotificationCount(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    return await prisma.notification.count({
      where: {
        userId: id,
        isRead: false
      }
    });
  } else {
    const database = await getDatabase();
    const result = await database.get(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);
    return result?.count || 0;
  }
}

export async function markNotificationAsRead(notificationId, userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId: id
      },
      data: { isRead: true }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run(`
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);
  }
}

export async function markAllNotificationsAsRead(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    await prisma.notification.updateMany({
      where: {
        userId: id,
        isRead: false
      },
      data: { isRead: true }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run(`
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = ? AND is_read = FALSE
    `, [userId]);
  }
}

export async function deleteNotification(notificationId, userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    await prisma.notification.delete({
      where: {
        id: notificationId,
        userId: id
      }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run(`
      DELETE FROM notifications
      WHERE id = ? AND user_id = ?
    `, [notificationId, userId]);
  }
}

// ============================================================================
// COMMENT FUNCTIONS
// ============================================================================

export async function createComment(commentData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const {
      comment, parent_comment_id, type = 'text', count = 1,
      sending_user, receiving_user, okrt_id
    } = commentData;

    const newComment = await prisma.comment.create({
      data: {
        comment,
        parentCommentId: parent_comment_id,
        type,
        count,
        sendingUser: sending_user,
        receivingUser: receiving_user,
        okrtId: okrt_id
      }
    });
    return convertPrismaToSQLite(newComment);
  } else {
    const database = await getDatabase();
    const {
      comment, parent_comment_id, type = 'text', count = 1,
      sending_user, receiving_user, okrt_id
    } = commentData;

    const result = await database.run(`
      INSERT INTO comments (
        comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [comment, parent_comment_id, type, count, sending_user, receiving_user, okrt_id]);

    return database.get('SELECT * FROM comments WHERE id = ?', [result.lastID]);
  }
}

export async function getCommentsByOKRT(okrtId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const comments = await prisma.comment.findMany({
      where: { okrtId },
      include: {
        sender: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        },
        receiver: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    return comments.map(c => ({
      ...convertPrismaToSQLite(c),
      sender_name: c.sender.displayName,
      sender_avatar: c.sender.profilePictureUrl,
      receiver_name: c.receiver.displayName,
      receiver_avatar: c.receiver.profilePictureUrl
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT c.*,
             su.display_name as sender_name, su.profile_picture_url as sender_avatar,
             ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
      FROM comments c
      JOIN users su ON c.sending_user = su.id
      JOIN users ru ON c.receiving_user = ru.id
      WHERE c.okrt_id = ?
      ORDER BY c.created_at ASC
    `, [okrtId]);
  }
}

export async function getCommentById(commentId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        sender: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        },
        receiver: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        }
      }
    });
    if (!comment) return null;
    return {
      ...convertPrismaToSQLite(comment),
      sender_name: comment.sender.displayName,
      sender_avatar: comment.sender.profilePictureUrl,
      receiver_name: comment.receiver.displayName,
      receiver_avatar: comment.receiver.profilePictureUrl
    };
  } else {
    const database = await getDatabase();
    return database.get(`
      SELECT c.*,
             su.display_name as sender_name, su.profile_picture_url as sender_avatar,
             ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
      FROM comments c
      JOIN users su ON c.sending_user = su.id
      JOIN users ru ON c.receiving_user = ru.id
      WHERE c.id = ?
    `, [commentId]);
  }
}

export async function updateComment(commentId, updateData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const prismaData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'updated_at') continue;
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      prismaData[camelKey] = value;
    }
    
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: prismaData
    });
    return convertPrismaToSQLite(comment);
  } else {
    const database = await getDatabase();
    
    updateData.updated_at = new Date().toISOString();
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    await database.run(
      `UPDATE comments SET ${setClause} WHERE id = ?`,
      [...updateValues, commentId]
    );
    
    return database.get('SELECT * FROM comments WHERE id = ?', [commentId]);
  }
}

export async function deleteComment(commentId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    await prisma.comment.delete({
      where: { id: commentId }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run('DELETE FROM comments WHERE id = ?', [commentId]);
  }
}

export async function getCommentsByUser(userId, type = 'sent') {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const whereClause = type === 'sent' ? { sendingUser: id } : { receivingUser: id };
    
    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        },
        receiver: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        },
        okrt: {
          select: { title: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return comments.map(c => ({
      ...convertPrismaToSQLite(c),
      sender_name: c.sender.displayName,
      sender_avatar: c.sender.profilePictureUrl,
      receiver_name: c.receiver.displayName,
      receiver_avatar: c.receiver.profilePictureUrl,
      okrt_title: c.okrt.title
    }));
  } else {
    const database = await getDatabase();
    const userField = type === 'sent' ? 'sending_user' : 'receiving_user';
    
    return database.all(`
      SELECT c.*,
             su.display_name as sender_name, su.profile_picture_url as sender_avatar,
             ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar,
             o.title as okrt_title
      FROM comments c
      JOIN users su ON c.sending_user = su.id
      JOIN users ru ON c.receiving_user = ru.id
      JOIN okrt o ON c.okrt_id = o.id
      WHERE c.${userField} = ?
      ORDER BY c.created_at DESC
    `, [userId]);
  }
}

export async function getReplies(parentCommentId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const comments = await prisma.comment.findMany({
      where: { parentCommentId },
      include: {
        sender: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        },
        receiver: {
          select: {
            displayName: true,
            profilePictureUrl: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    return comments.map(c => ({
      ...convertPrismaToSQLite(c),
      sender_name: c.sender.displayName,
      sender_avatar: c.sender.profilePictureUrl,
      receiver_name: c.receiver.displayName,
      receiver_avatar: c.receiver.profilePictureUrl
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT c.*,
             su.display_name as sender_name, su.profile_picture_url as sender_avatar,
             ru.display_name as receiver_name, ru.profile_picture_url as receiver_avatar
      FROM comments c
      JOIN users su ON c.sending_user = su.id
      JOIN users ru ON c.receiving_user = ru.id
      WHERE c.parent_comment_id = ?
      ORDER BY c.created_at ASC
    `, [parentCommentId]);
  }
}

export async function getRewardSummaryForOKRT(okrtId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const rewards = await prisma.comment.groupBy({
      by: ['type'],
      where: {
        okrtId,
        type: { in: ['medal', 'star', 'cookie'] }
      },
      _sum: {
        count: true
      }
    });
    return rewards.map(r => ({
      type: r.type,
      total_count: r._sum.count || 0
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT type, SUM(count) as total_count
      FROM comments
      WHERE okrt_id = ? AND type IN ('medal', 'star', 'cookie')
      GROUP BY type
    `, [okrtId]);
  }
}

// ============================================================================
// TIME BLOCK FUNCTIONS
// ============================================================================

export async function createTimeBlock(timeBlockData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const {
      task_id, user_id, start_time, duration, objective_id
    } = timeBlockData;

    const timeBlock = await prisma.timeBlock.create({
      data: {
        taskId: task_id,
        userId: user_id,
        startTime: new Date(start_time),
        duration,
        objectiveId: objective_id
      }
    });
    return convertPrismaToSQLite(timeBlock);
  } else {
    const database = await getDatabase();
    const {
      task_id, user_id, start_time, duration, objective_id
    } = timeBlockData;

    const result = await database.run(
      'INSERT INTO time_blocks (task_id, user_id, start_time, duration, objective_id) VALUES (?, ?, ?, ?, ?)',
      [task_id, user_id, start_time, duration, objective_id]
    );

    return database.get('SELECT * FROM time_blocks WHERE id = ?', [result.lastID]);
  }
}

export async function getTimeBlocksByUserAndDate(userId, date) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
    
    const timeBlocks = await prisma.timeBlock.findMany({
      where: {
        userId: id,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        task: {
          select: {
            title: true,
            description: true,
            status: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    return timeBlocks.map(tb => ({
      ...convertPrismaToSQLite(tb),
      task_title: tb.task.title,
      task_description: tb.task.description,
      task_status: tb.task.status
    }));
  } else {
    const database = await getDatabase();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    
    return database.all(`
      SELECT tb.*, 
             task.title as task_title, 
             task.description as task_description, 
             task.status as task_status
      FROM time_blocks tb
      JOIN okrt task ON tb.task_id = task.id
      WHERE tb.user_id = ? AND tb.start_time >= ? AND tb.start_time <= ?
      ORDER BY tb.start_time ASC
    `, [userId, startOfDay, endOfDay]);
  }
}

export async function getTimeBlockById(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const timeBlock = await prisma.timeBlock.findUnique({
      where: { id }
    });
    return convertPrismaToSQLite(timeBlock);
  } else {
    const database = await getDatabase();
    return database.get('SELECT * FROM time_blocks WHERE id = ?', [id]);
  }
}

export async function updateTimeBlock(id, updateData) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    const prismaData = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'updated_at') continue;
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (key === 'start_time') {
        prismaData[camelKey] = new Date(value);
      } else {
        prismaData[camelKey] = value;
      }
    }
    
    const timeBlock = await prisma.timeBlock.update({
      where: { id },
      data: prismaData
    });
    return convertPrismaToSQLite(timeBlock);
  } else {
    const database = await getDatabase();
    
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    
    await database.run(
      `UPDATE time_blocks SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
      [...updateValues, id]
    );
    
    return database.get('SELECT * FROM time_blocks WHERE id = ?', [id]);
  }
}

export async function deleteTimeBlock(id) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    await prisma.timeBlock.delete({
      where: { id }
    });
    return { changes: 1 };
  } else {
    const database = await getDatabase();
    return database.run('DELETE FROM time_blocks WHERE id = ?', [id]);
  }
}

export async function getTimeBlocksByUser(userId) {
  if (isPrisma()) {
    const prisma = await getDatabase();
    // Convert userId to integer for Prisma
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const timeBlocks = await prisma.timeBlock.findMany({
      where: { userId: id },
      include: {
        task: {
          select: {
            title: true,
            description: true,
            status: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    return timeBlocks.map(tb => ({
      ...convertPrismaToSQLite(tb),
      task_title: tb.task.title,
      task_description: tb.task.description,
      task_status: tb.task.status
    }));
  } else {
    const database = await getDatabase();
    return database.all(`
      SELECT tb.*, o.title as task_title, o.description as task_description, o.status as task_status
      FROM time_blocks tb
      JOIN okrt o ON tb.task_id = o.id
      WHERE tb.user_id = ?
      ORDER BY tb.start_time ASC
    `, [userId]);
  }
}
