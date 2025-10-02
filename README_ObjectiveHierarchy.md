# Groups Page Enhancement: Objective Hierarchy View

## Overview

This feature adds a toggle switch to the Groups page that allows users to switch between the existing **Group Hierarchy** view and a new **Objective Hierarchy** view.

## Features

### Toggle Switch
- Located in the top-right corner of the Groups page header
- Smooth animated slider switch with labels "Groups" and "Objectives"
- Default view is "Groups" (existing functionality)
- Responsive design that adapts to different screen sizes

### Objective Hierarchy View
- Displays shared objectives in a hierarchical tree structure
- Shows only objectives that are shared with the current user
- Uses parent-child relationships via the `parent_id` field in the OKRT table
- Connected nodes with visual connectors showing relationships

## Technical Implementation

### New Components
1. **ObjectiveHierarchy.js** - Main component for displaying objective hierarchy
2. **ObjectiveHierarchy.module.css** - Styling for the objective hierarchy view

### Updated Components
1. **Groups page.js** - Added toggle functionality and integrated new view
2. **Groups page.module.css** - Added toggle switch styling and responsive design

### Data Structure
- Uses existing OKRT table with `parent_id` field for hierarchical relationships
- Leverages existing sharing functionality via the `share` table
- Fetches data from the existing `/api/shared` endpoint

## Node Display Features

### Objective Node Information
- **Title**: Objective/Key Result/Task title
- **Type Badge**: Color-coded badge showing O (Objective), K (Key Result), or T (Task)
- **Owner**: Display name of the objective owner
- **Progress**: Visual progress bar with percentage
- **Shared Groups**: List of groups the objective is shared with
- **Description**: Full description when expanded
- **Area**: Functional area classification

### Interactive Features
- **Expandable Nodes**: Click to expand and see detailed information
- **Selection**: Click to select nodes (visual feedback)
- **Hierarchical Navigation**: Tree structure with connectors
- **Responsive Layout**: Adapts to different screen sizes

## Visual Design

### Color Coding by Type
- **Objectives (O)**: Indigo (#4f46e5)
- **Key Results (K)**: Emerald (#059669) 
- **Tasks (T)**: Red (#dc2626)

### Layout Features
- Uses the existing `tidyTree` layout algorithm for optimal spacing
- Responsive node sizing (320px width, 100px height on desktop)
- Smooth animations and hover effects
- Professional card-based design consistent with existing UI

## Usage

1. Navigate to the Groups page
2. Use the toggle switch in the top-right corner to switch views
3. In Objective Hierarchy view:
   - Browse the hierarchical structure of shared objectives
   - Click nodes to select them
   - Expand nodes to see detailed information
   - View parent-child relationships through visual connectors

## Error Handling

- Graceful handling when no shared objectives exist
- Loading states for async data fetching
- Error messages for network issues
- Fallback layouts for different screen sizes

## Responsive Design

- **Desktop**: Full tree layout with connectors
- **Tablet**: Optimized node sizing and spacing
- **Mobile**: Stacked layout with hidden connectors for better usability

## API Integration

Uses existing endpoints:
- `/api/shared` - Fetches shared objectives for the current user
- Respects existing authentication and authorization

## Future Enhancements

Potential future improvements:
- Filtering by objective type (O/K/T)
- Search functionality within the hierarchy
- Drag-and-drop to reorganize hierarchy
- Export hierarchy as image or PDF
- Real-time updates when objectives are shared/unshared