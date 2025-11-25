require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkAndUpdateRole() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check if role column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('Role column does not exist. Adding it now...');
      
      // Add role column
      await pool.query(`
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'User' CHECK(role IN ('Admin', 'Owner', 'Leader', 'User'))
      `);
      
      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
      `);
      
      console.log('✅ Role column added successfully');
    } else {
      console.log('✅ Role column already exists');
    }

    // Check indev user's role (by email since username is the email)
    const userCheck = await pool.query(`
      SELECT id, username, email, role FROM users WHERE email = 'indev@test.com'
    `);

    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      console.log('\nCurrent indev user:', user);

      if (user.role !== 'Admin') {
        console.log('\nUpdating indev user role to Admin...');
        await pool.query(`
          UPDATE users SET role = 'Admin' WHERE email = 'indev@test.com'
        `);
        console.log('✅ indev@test.com user role updated to Admin');
      } else {
        console.log('✅ indev user already has Admin role');
      }
    } else {
      console.log('❌ indev user not found');
    }

    // Show all users with their roles
    const allUsers = await pool.query(`
      SELECT id, username, email, role FROM users ORDER BY id
    `);
    
    console.log('\n📋 All users:');
    console.table(allUsers.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndUpdateRole();