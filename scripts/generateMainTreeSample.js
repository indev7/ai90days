/**
 * Script to generate a sample mainTree JSON for a specific user
 * Usage: node scripts/generateMainTreeSample.js <userId>
 * Example: node scripts/generateMainTreeSample.js 4
 */

import { exportMainTreeAsJSON } from '../lib/mainTreeLoader.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateMainTreeSample() {
  // Get userId from command line arguments, default to 4
  const userId = process.argv[2] ? parseInt(process.argv[2]) : 4;
  
  console.log(`Generating mainTree sample for user ID: ${userId}`);
  
  try {
    // Load and export mainTree as JSON
    const mainTreeJSON = await exportMainTreeAsJSON(userId);
    
    // Ensure Spec/Phase14 directory exists
    const outputDir = join(process.cwd(), 'Spec', 'Phase14');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    
    // Write to file
    const outputPath = join(outputDir, `mainTree_user${userId}_sample.json`);
    writeFileSync(outputPath, mainTreeJSON, 'utf8');
    
    console.log(`✓ Successfully generated mainTree sample`);
    console.log(`  Output file: ${outputPath}`);
    console.log(`  File size: ${(mainTreeJSON.length / 1024).toFixed(2)} KB`);
    
    // Parse and display summary
    const mainTree = JSON.parse(mainTreeJSON);
    console.log('\n=== MainTree Summary ===');
    console.log(`  My OKRTs: ${mainTree.myOKRTs.length} items`);
    console.log(`  Shared OKRTs: ${mainTree.sharedOKRTs.length} items`);
    console.log(`  Notifications: ${mainTree.notifications.length} items`);
    console.log(`  Time Blocks: ${mainTree.timeBlocks.length} items`);
    console.log(`  Groups: ${mainTree.groups.length} items`);
    
    if (mainTree.groups.length > 0) {
      console.log('\n=== Groups Details ===');
      mainTree.groups.forEach(group => {
        console.log(`  - ${group.name} (${group.type})`);
        console.log(`    Members: ${group.members.length}`);
        console.log(`    Objectives: ${group.objectiveIds.length}`);
        console.log(`    Admin: ${group.is_admin ? 'Yes' : 'No'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating mainTree sample:', error);
    process.exit(1);
  }
}

generateMainTreeSample();