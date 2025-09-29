// Test file to verify the filtering logic for solitary objectives
const testObjectives = [
  {
    id: "obj1",
    title: "Q1 Revenue Growth",
    description: "Increase overall company revenue by 25%",
    type: "O",
    progress: 75,
    owner_name: "John Doe",
    parent_id: null,
    area: "Sales & Marketing",
    shared_groups: [{ name: "Sales Team" }, { name: "Marketing Team" }]
  },
  {
    id: "kr1",
    title: "Acquire 100 new customers", 
    description: "Focus on enterprise clients",
    type: "K",
    progress: 60,
    owner_name: "Jane Smith",
    parent_id: "obj1", // Has parent
    area: "Sales"
  },
  {
    id: "solitary1", // This should be filtered out
    title: "Standalone Task",
    description: "This is a solitary objective with no parent or children",
    type: "T",
    progress: 50,
    owner_name: "Bob Wilson",
    parent_id: null, // No parent
    area: "Misc"
  },
  {
    id: "kr2",
    title: "Launch 3 marketing campaigns",
    description: "Digital marketing campaigns for lead generation", 
    type: "K",
    progress: 90,
    owner_name: "Mike Johnson",
    parent_id: "obj1", // Has parent
    area: "Marketing"
  },
  {
    id: "solitary2", // This should be filtered out
    title: "Another Standalone",
    description: "Another solitary objective",
    type: "O",
    progress: 30,
    owner_name: "Alice Brown", 
    parent_id: null, // No parent
    area: "Random"
  }
];

// Test the filtering logic
function testFilteringSolitaryObjectives(objectives) {
  console.log('Testing solitary objective filtering...\n');
  
  // Filter out solitary objectives (those without parents or children)
  const filteredObjectives = objectives.filter(obj => {
    const hasParent = obj.parent_id && objectives.some(o => o.id === obj.parent_id);
    const hasChildren = objectives.some(o => o.parent_id === obj.id);
    return hasParent || hasChildren;
  });

  console.log('Original objectives:', objectives.length);
  console.log('Filtered objectives:', filteredObjectives.length);
  console.log('\nOriginal objectives:');
  objectives.forEach(obj => {
    const hasParent = obj.parent_id && objectives.some(o => o.id === obj.parent_id);
    const hasChildren = objectives.some(o => o.parent_id === obj.id);
    const shouldKeep = hasParent || hasChildren;
    console.log(`- ${obj.title}: parent=${hasParent}, children=${hasChildren}, keep=${shouldKeep}`);
  });
  
  console.log('\nFiltered objectives (should exclude solitary ones):');
  filteredObjectives.forEach(obj => {
    console.log(`- ${obj.title} (${obj.type}) by ${obj.owner_name}`);
  });
  
  return filteredObjectives;
}

testFilteringSolitaryObjectives(testObjectives);