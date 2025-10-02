// Test to verify connector generation with hierarchical data
const { createTreeLayout } = require('./lib/tidyTree.js');

const testObjectives = [
  {
    id: "obj1",
    title: "Q1 Revenue Growth",
    parent_id: null, // Root
    type: "O"
  },
  {
    id: "kr1",
    title: "Acquire 100 new customers", 
    parent_id: "obj1", // Child of obj1
    type: "K"
  },
  {
    id: "kr2",
    title: "Launch 3 marketing campaigns",
    parent_id: "obj1", // Child of obj1
    type: "K"
  },
  {
    id: "task1",
    title: "Set up CRM integration",
    parent_id: "kr1", // Child of kr1
    type: "T"
  }
];

console.log('Testing connector generation...\n');

// Filter out solitary objectives (same logic as component)
const filteredObjectives = testObjectives.filter(obj => {
  const hasParent = obj.parent_id && testObjectives.some(o => o.id === obj.parent_id);
  const hasChildren = testObjectives.some(o => o.parent_id === obj.id);
  return hasParent || hasChildren;
});

console.log('Filtered objectives:', filteredObjectives.length);
filteredObjectives.forEach(obj => {
  console.log(`- ${obj.title} (${obj.type}), parent: ${obj.parent_id || 'none'}`);
});

// Convert to tree format
const objectiveTree = filteredObjectives.map(obj => ({
  id: obj.id,
  parent_group_id: obj.parent_id,
  name: obj.title,
  ...obj
}));

console.log('\nTree structure:');
objectiveTree.forEach(obj => {
  console.log(`- ${obj.name} -> parent: ${obj.parent_group_id || 'ROOT'}`);
});

try {
  const layouts = createTreeLayout(objectiveTree, {
    nodeWidth: 280,
    nodeHeight: 60,
    levelHeight: 100,
    siblingDistance: 320,
    subtreeDistance: 320,
    spacingReduction: 0.8,
    minSpacing: 80
  });

  console.log('\nLayout results:');
  layouts.forEach((layout, i) => {
    console.log(`Layout ${i + 1}:`);
    console.log(`  Nodes: ${layout.nodes.length}`);
    console.log(`  Edges: ${layout.edges.length}`);
    console.log(`  Bounds: ${layout.bounds.width}x${layout.bounds.height}`);
    
    if (layout.edges.length > 0) {
      console.log('  Edges:');
      layout.edges.forEach((edge, j) => {
        console.log(`    ${j + 1}. ${edge.from} -> ${edge.to}: (${edge.fromX},${edge.fromY}) to (${edge.toX},${edge.toY})`);
      });
    } else {
      console.log('  No edges generated!');
    }
  });

} catch (error) {
  console.error('Error creating tree layout:', error);
}

console.log('\nIf edges are generated here but not showing in browser, the issue is likely in rendering/CSS.');