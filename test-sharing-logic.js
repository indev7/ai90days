/**
 * OKRT Sharing Logic Test Suite
 * 
 * This script tests the three core sharing rules:
 * 1. Objective must have visibility = 'shared'
 * 2. Objective must be explicitly shared with group(s)  
 * 3. Viewing user must belong to one of those groups
 */

const { getDatabase } = require('./lib/db');

class SharingLogicTester {
  constructor() {
    this.db = null;
    this.testResults = [];
  }

  async init() {
    this.db = await getDatabase();
  }

  log(test, passed, message) {
    const result = { test, passed, message };
    this.testResults.push(result);
    console.log(`${passed ? '✅' : '❌'} ${test}: ${message}`);
  }

  async cleanup() {
    // Clean up test data
    await this.db.run('DELETE FROM share WHERE okrt_id LIKE "test_%"');
    await this.db.run('DELETE FROM user_group WHERE group_id LIKE "test_%"');  
    await this.db.run('DELETE FROM groups WHERE id LIKE "test_%"');
    await this.db.run('DELETE FROM okrt WHERE id LIKE "test_%"');
    await this.db.run('DELETE FROM users WHERE username LIKE "test_%"');
  }

  async setupTestData() {
    // Create test users (using username instead of id for TEXT compatibility)
    await this.db.run(`
      INSERT OR REPLACE INTO users (username, display_name, email, password_hash) 
      VALUES 
        ('test_owner', 'Test Owner', 'owner@test.com', 'dummy_hash'),
        ('test_member', 'Test Member', 'member@test.com', 'dummy_hash'),
        ('test_outsider', 'Test Outsider', 'outsider@test.com', 'dummy_hash')
    `);

    // Get the auto-generated IDs
    const owner = await this.db.get('SELECT id FROM users WHERE username = "test_owner"');
    const member = await this.db.get('SELECT id FROM users WHERE username = "test_member"');
    const outsider = await this.db.get('SELECT id FROM users WHERE username = "test_outsider"');
    
    this.testUserIds = {
      owner: owner.id.toString(),
      member: member.id.toString(),
      outsider: outsider.id.toString()
    };

    // Create test groups
    await this.db.run(`
      INSERT OR REPLACE INTO groups (id, name, type) 
      VALUES 
        ('test_group_A', 'Test Group A', 'Team'),
        ('test_group_B', 'Test Group B', 'Team')
    `);

    // Add users to groups
    await this.db.run(`
      INSERT OR REPLACE INTO user_group (user_id, group_id) 
      VALUES 
        (?, 'test_group_A'),
        (?, 'test_group_A')
    `, [this.testUserIds.member, this.testUserIds.owner]);

    // Create test objectives with different sharing scenarios
    await this.db.run(`
      INSERT OR REPLACE INTO okrt (id, type, owner_id, title, visibility)
      VALUES 
        ('test_obj_private', 'O', ?, 'Private Objective', 'private'),
        ('test_obj_shared_no_groups', 'O', ?, 'Shared but No Groups', 'shared'),
        ('test_obj_shared_with_group', 'O', ?, 'Shared with Group', 'shared')
    `, [this.testUserIds.owner, this.testUserIds.owner, this.testUserIds.owner]);

    // Create sharing records
    await this.db.run(`
      INSERT OR REPLACE INTO share (okrt_id, group_or_user_id, share_type)
      VALUES 
        ('test_obj_shared_with_group', 'test_group_A', 'G')
    `);

    // Create child KRs and Tasks
    await this.db.run(`
      INSERT OR REPLACE INTO okrt (id, type, owner_id, parent_id, title, kr_target_number, kr_unit)
      VALUES 
        ('test_kr_1', 'K', ?, 'test_obj_shared_with_group', 'Test KR 1', 100, 'units'),
        ('test_task_1', 'T', ?, 'test_kr_1', 'Test Task 1', null, null)
    `, [this.testUserIds.owner, this.testUserIds.owner]);
  }

  async testRule1_VisibilityCheck() {
    console.log('\n🔍 Testing Rule 1: Visibility must be "shared"');
    
    // Test 1.1: Private objective should not be accessible
    const privateQuery = `
      SELECT COUNT(*) as count FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE o.id = 'test_obj_private'
        AND o.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const privateResult = await this.db.get(privateQuery, [this.testUserIds.member]);
    this.log('1.1 Private Objective Access', privateResult.count === 0, 
             `Private objective ${privateResult.count === 0 ? 'correctly blocked' : 'incorrectly accessible'}`);

    // Test 1.2: Shared objective should be accessible (if other rules met)
    const sharedQuery = `
      SELECT COUNT(*) as count FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id  
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE o.id = 'test_obj_shared_with_group'
        AND o.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const sharedResult = await this.db.get(sharedQuery, [this.testUserIds.member]);
    this.log('1.2 Shared Objective Access', sharedResult.count > 0,
             `Shared objective ${sharedResult.count > 0 ? 'correctly accessible' : 'incorrectly blocked'}`);
  }

  async testRule2_GroupSpecification() {
    console.log('\n🔍 Testing Rule 2: Must be shared with specific groups');

    // Test 2.1: Shared objective without group sharing should not be accessible
    const noGroupQuery = `
      SELECT COUNT(*) as count FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'  
      WHERE o.id = 'test_obj_shared_no_groups'
        AND o.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const noGroupResult = await this.db.get(noGroupQuery, [this.testUserIds.member]);
    this.log('2.1 Shared Without Groups', noGroupResult.count === 0,
             `Objective without group shares ${noGroupResult.count === 0 ? 'correctly blocked' : 'incorrectly accessible'}`);

    // Test 2.2: Verify share table has correct entries
    const shareCheck = await this.db.get(`
      SELECT COUNT(*) as count FROM share 
      WHERE okrt_id = 'test_obj_shared_with_group' AND share_type = 'G'
    `);
    this.log('2.2 Share Table Entries', shareCheck.count > 0,
             `Share table ${shareCheck.count > 0 ? 'correctly has' : 'missing'} group share entries`);
  }

  async testRule3_UserGroupMembership() {
    console.log('\n🔍 Testing Rule 3: User must belong to shared groups');

    // Test 3.1: Member of shared group should have access
    const memberQuery = `
      SELECT COUNT(*) as count FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE o.id = 'test_obj_shared_with_group'
        AND o.visibility = 'shared'  
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const memberResult = await this.db.get(memberQuery, [this.testUserIds.member]);
    this.log('3.1 Group Member Access', memberResult.count > 0,
             `Group member ${memberResult.count > 0 ? 'correctly has' : 'incorrectly denied'} access`);

    // Test 3.2: Non-member should not have access
    const outsiderQuery = `
      SELECT COUNT(*) as count FROM okrt o
      LEFT JOIN share s ON o.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE o.id = 'test_obj_shared_with_group'
        AND o.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const outsiderResult = await this.db.get(outsiderQuery, [this.testUserIds.outsider]);
    this.log('3.2 Non-Member Access', outsiderResult.count === 0,
             `Non-member ${outsiderResult.count === 0 ? 'correctly blocked' : 'incorrectly has access'}`);
  }

  async testChildInheritance() {
    console.log('\n🔍 Testing Child KR/Task Inheritance');

    // Test 4.1: Child KRs should inherit parent sharing
    const krQuery = `
      SELECT COUNT(*) as count FROM okrt kr
      JOIN okrt parent ON kr.parent_id = parent.id
      LEFT JOIN share s ON parent.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE kr.id = 'test_kr_1'
        AND kr.type = 'K'
        AND parent.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const krResult = await this.db.get(krQuery, [this.testUserIds.member]);
    this.log('4.1 KR Inheritance', krResult.count > 0,
             `Child KR ${krResult.count > 0 ? 'correctly inherits' : 'does not inherit'} parent sharing`);

    // Test 4.2: Child Tasks should inherit parent sharing  
    const taskQuery = `
      SELECT COUNT(*) as count FROM okrt t
      JOIN okrt kr ON t.parent_id = kr.id
      JOIN okrt parent ON kr.parent_id = parent.id
      LEFT JOIN share s ON parent.id = s.okrt_id
      LEFT JOIN user_group ug ON s.group_or_user_id = ug.group_id AND s.share_type = 'G'
      WHERE t.id = 'test_task_1'
        AND t.type = 'T'
        AND parent.visibility = 'shared'
        AND (s.share_type = 'G' AND ug.user_id = ?)
    `;
    const taskResult = await this.db.get(taskQuery, [this.testUserIds.member]);
    this.log('4.2 Task Inheritance', taskResult.count > 0,
             `Child Task ${taskResult.count > 0 ? 'correctly inherits' : 'does not inherit'} parent sharing`);
  }

  async runAllTests() {
    console.log('🚀 Starting OKRT Sharing Logic Tests\n');

    try {
      await this.init();
      await this.cleanup();
      await this.setupTestData();

      await this.testRule1_VisibilityCheck();
      await this.testRule2_GroupSpecification();
      await this.testRule3_UserGroupMembership();
      await this.testChildInheritance();

      // Summary
      const passed = this.testResults.filter(r => r.passed).length;
      const total = this.testResults.length;
      
      console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
      
      if (passed === total) {
        console.log('🎉 All sharing logic tests passed!');
      } else {
        console.log('⚠️  Some tests failed - review implementation');
        this.testResults.filter(r => !r.passed).forEach(result => {
          console.log(`   ❌ ${result.test}: ${result.message}`);
        });
      }

      await this.cleanup();
      
    } catch (error) {
      console.error('🚨 Test execution failed:', error);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SharingLogicTester();
  tester.runAllTests();
}

module.exports = SharingLogicTester;