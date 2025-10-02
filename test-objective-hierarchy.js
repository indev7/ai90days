// Test file to verify the new ObjectiveHierarchy component
// This is for development testing only

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
    parent_id: "obj1",
    area: "Sales"
  },
  {
    id: "kr2", 
    title: "Launch 3 marketing campaigns",
    description: "Digital marketing campaigns for lead generation",
    type: "K",
    progress: 90,
    owner_name: "Mike Johnson",
    parent_id: "obj1",
    area: "Marketing"
  },
  {
    id: "task1",
    title: "Set up CRM integration",
    description: "Integrate Salesforce with our platform",
    type: "T",
    progress: 40,
    owner_name: "Sarah Wilson",
    parent_id: "kr1",
    area: "Sales Operations"
  },
  {
    id: "obj2",
    title: "Product Development Goals",
    description: "Enhance product capabilities and user experience",
    type: "O", 
    progress: 45,
    owner_name: "Alex Chen",
    parent_id: null,
    area: "Product",
    shared_groups: [{ name: "Engineering Team" }]
  }
];

console.log('Test Objectives Structure:');
console.log('Total objectives:', testObjectives.length);
console.log('Root objectives:', testObjectives.filter(o => !o.parent_id).length);
console.log('Child objectives:', testObjectives.filter(o => o.parent_id).length);

// Test hierarchical structure
testObjectives.forEach(obj => {
  const children = testObjectives.filter(o => o.parent_id === obj.id);
  console.log(`${obj.title} (${obj.type}): ${children.length} children`);
});