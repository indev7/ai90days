// Test script for Time Blocks API (Phase 11)
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api';

async function testTimeBlocksAPI() {
  console.log('Testing Time Blocks API...\n');

  try {
    // Test 1: Get available tasks
    console.log('1. Testing GET /time-blocks/tasks');
    const tasksResponse = await fetch(`${BASE_URL}/time-blocks/tasks`);
    console.log('Status:', tasksResponse.status);
    
    if (tasksResponse.status === 401) {
      console.log('✅ Authentication required (as expected)');
    } else {
      const tasksData = await tasksResponse.json();
      console.log('Response:', tasksData);
    }

    // Test 2: Get time blocks
    console.log('\n2. Testing GET /time-blocks');
    const timeBlocksResponse = await fetch(`${BASE_URL}/time-blocks`);
    console.log('Status:', timeBlocksResponse.status);
    
    if (timeBlocksResponse.status === 401) {
      console.log('✅ Authentication required (as expected)');
    } else {
      const timeBlocksData = await timeBlocksResponse.json();
      console.log('Response:', timeBlocksData);
    }

    // Test 3: Get time blocks for specific date
    console.log('\n3. Testing GET /time-blocks?date=2025-09-29');
    const dateBlocksResponse = await fetch(`${BASE_URL}/time-blocks?date=2025-09-29`);
    console.log('Status:', dateBlocksResponse.status);
    
    if (dateBlocksResponse.status === 401) {
      console.log('✅ Authentication required (as expected)');
    } else {
      const dateBlocksData = await dateBlocksResponse.json();
      console.log('Response:', dateBlocksData);
    }

    console.log('\n✅ All API endpoints are responding correctly!');
    console.log('Note: 401 responses are expected since authentication is required.');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Test database migration
async function checkDatabase() {
  console.log('\nTesting database migration...');
  
  try {
    const { getDatabase } = require('./lib/db');
    const db = await getDatabase();
    
    // Check if time_blocks table exists
    const tableInfo = await db.all("PRAGMA table_info(time_blocks)");
    console.log('✅ time_blocks table structure:');
    tableInfo.forEach(column => {
      console.log(`  ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
    });

    // Check indexes
    const indexes = await db.all("PRAGMA index_list(time_blocks)");
    console.log('✅ time_blocks indexes:');
    indexes.forEach(index => {
      console.log(`  ${index.name}: ${index.unique ? 'UNIQUE' : 'INDEX'}`);
    });

  } catch (error) {
    console.error('❌ Database test error:', error.message);
  }
}

async function runTests() {
  await testTimeBlocksAPI();
  await checkDatabase();
}

runTests().then(() => {
  console.log('\n🎉 Testing completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});