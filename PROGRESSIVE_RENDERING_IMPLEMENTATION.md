# Progressive Rendering Implementation

## Overview
This document describes the implementation of progressive rendering for the dashboard, where components render as soon as their required data becomes available, synchronized with LED indicator updates.

## Data Loading Sequence

The mainTree data loads progressively in this order:
1. **MyOKRTs** - User's own objectives, key results, and tasks
2. **TimeBlocks** - Scheduled time blocks for tasks
3. **Notifications** - User notifications
4. **SharedOKRTs** - OKRTs shared with the user
5. **Groups** - User's groups and memberships
6. **Calendar** - Microsoft Calendar events (loaded in background)

## Component Dependencies

### Dashboard Components and Their Data Dependencies

| Component | Depends On | Renders When |
|-----------|------------|--------------|
| 12 Week Clock | myOKRTs + timeBlocks | Both sections loaded |
| Today Widget | myOKRTs + timeBlocks | Both sections loaded |
| Notifications Widget | notifications | Notifications loaded |
| Daily Inspiration | None | Always renders immediately |

## LED Indicator States

Each section has three possible states:
- **Idle** (gray) - Not yet started loading
- **Loading** (pulsing orange) - Currently loading
- **Loaded** (solid green) - Successfully loaded

## Implementation Details

### Store Updates (`store/mainTreeStore.js`)
- Each section has its own state tracking: `{ loading, loaded, lastUpdated }`
- Individual setter methods update both data and section state
- Section states are persisted to localStorage for cross-tab sync

### Progressive API (`app/api/main-tree/progressive/route.js`)
- Streams data using Server-Sent Events (SSE)
- Each section is sent as soon as it's ready
- Sections are loaded in the specified order
- Calendar is loaded separately in the background

### Hook Updates (`hooks/useMainTree.js`)
- Processes streaming response line by line
- Updates store immediately when each section arrives
- Marks sections as loading/loaded appropriately
- Handles calendar loading separately

### Dashboard Updates (`app/dashboard/page.js`)
- Subscribes to individual sections instead of entire mainTree
- Checks `sectionStates` to determine what to render
- Shows loading placeholders for pending sections
- Renders components as soon as their dependencies are met

## Benefits

1. **Faster Perceived Load Time** - Users see content appear progressively
2. **Better UX** - Clear visual feedback via LED indicators
3. **Reduced Wait Time** - No need to wait for all data before showing anything
4. **Synchronized Feedback** - LED lights up exactly when component renders

## Testing

To test the progressive rendering:
1. Clear browser cache and localStorage
2. Open the dashboard
3. Watch the LED indicators light up in sequence
4. Observe components rendering as their LEDs turn green
5. Verify no components wait for unrelated data

## Sequence Diagram

```
User Opens Dashboard
        ↓
    [Start Loading]
        ↓
    LED 1: Loading (orange pulse)
        ↓
    MyOKRTs Data Arrives
        ↓
    LED 1: Loaded (green) ← Clock starts rendering
        ↓
    LED 2: Loading (orange pulse)
        ↓
    TimeBlocks Data Arrives
        ↓
    LED 2: Loaded (green) ← Clock fully renders, Today Widget renders
        ↓
    LED 3: Loading (orange pulse)
        ↓
    Notifications Data Arrives
        ↓
    LED 3: Loaded (green) ← Notifications Widget renders
        ↓
    LED 4: Loading (orange pulse)
        ↓
    SharedOKRTs Data Arrives
        ↓
    LED 4: Loaded (green)
        ↓
    LED 5: Loading (orange pulse)
        ↓
    Groups Data Arrives
        ↓
    LED 5: Loaded (green)
        ↓
    LED 6: Loading (orange pulse)
        ↓
    Calendar Data Arrives (background)
        ↓
    LED 6: Loaded (green)
        ↓
    [All Components Rendered]
```

## Files Modified

1. `app/dashboard/page.js` - Progressive component rendering
2. `components/LoadingIndicators.js` - LED indicator labels updated
3. `store/mainTreeStore.js` - Already had section state tracking
4. `hooks/useMainTree.js` - Already implemented progressive loading
5. `app/api/main-tree/progressive/route.js` - Already sends data progressively

## Notes

- The store already had section state tracking implemented
- The progressive API was already streaming data correctly
- The main change was making the dashboard render progressively instead of waiting
- LED indicators were already connected to section states
- Calendar loads in background to avoid blocking other sections