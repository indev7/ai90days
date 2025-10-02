// Test connector positioning logic
console.log('Testing connector positioning...\n');

// Simulate edge data from tidyTree
const mockEdges = [
  {
    from: 'parent1',
    to: 'child1',
    fromX: 140, // Center of 280px wide node
    fromY: 60,  // Bottom of 60px high parent node
    toX: 140,   // Center of 280px wide node  
    toY: 160    // Top of child node (60px height + 100px level spacing)
  },
  {
    from: 'parent1',
    to: 'child2', 
    fromX: 140,
    fromY: 60,
    toX: 460,   // Different X position for sibling
    toY: 160
  }
];

const nodeHeight = 60;

console.log('Original edge coordinates:');
mockEdges.forEach((edge, i) => {
  console.log(`Edge ${i + 1}:`);
  console.log(`  From: (${edge.fromX}, ${edge.fromY})`);
  console.log(`  To: (${edge.toX}, ${edge.toY})`);
});

console.log('\nAdjusted connector coordinates:');
mockEdges.forEach((edge, i) => {
  // Adjust coordinates to connect card centers
  const fromX = edge.fromX;
  const fromY = edge.fromY - nodeHeight + (nodeHeight / 2); // Adjust to card center
  const toX = edge.toX;
  const toY = edge.toY + (nodeHeight / 2); // Adjust to card center
  
  console.log(`Connector ${i + 1}:`);
  console.log(`  From: (${fromX}, ${fromY}) - Parent card center`);
  console.log(`  To: (${toX}, ${toY}) - Child card center`);
  
  const midY = (fromY + toY) / 2;
  const path = `M ${fromX},${fromY} V ${midY} H ${toX} V ${toY}`;
  console.log(`  SVG Path: ${path}`);
});

console.log('\nConnector positioning should now properly connect card centers!');