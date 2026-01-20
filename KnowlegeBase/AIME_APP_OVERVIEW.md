# Aime Web Application Overview

## Purpose
Aime is a 90-day goal and coaching web app that helps users plan, execute, and track Objectives, Key Results, and Tasks (OKRTs) within a quarterly cycle. It combines structured goal management, progress tracking, scheduling, and an AI coach to keep users focused and accountable.

## Core Concepts
- Objective (O): the high-level goal for the quarter.
- Key Result (K): measurable outcomes that define success for an Objective.
- Task (T): actionable steps that roll up into Key Results and Objectives.
- Progress: updates roll up the hierarchy, reflecting overall completion.

## Main Features and Functionality
### Goals and Progress
- Create, edit, and delete Objectives, Key Results, and Tasks.
- View OKRTs as a hierarchy/tree and as detailed cards.
- Track progress and status across objectives, key results, and tasks.
- Set cycles, visibility (private/shared), weights, and due dates.

### Dashboard and Daily Focus
- Dashboard highlights current-quarter objectives and progress.
- Today widget surfaces tasks and quick updates.
- Visual 12-week clock for the 90-day cycle.

### Scheduling and Time Blocks
- Calendar view for weekly schedule and time blocking.
- Create, update, and delete time blocks linked to tasks.
- Schedule filters to switch between tasks, meetings, or all events.

### Sharing, Groups, and Collaboration
- Share objectives with groups or individuals.
- Follow shared objectives and view shared hierarchies.
- Comment on objectives and send rewards/encouragement.

### Notifications
- Notifications center with unread counts and quick actions.
- Server-sent events for live updates (when enabled).

### AI Coach (Aime)
- Coach chat for OKRT planning, updates, and motivation.
- Suggested actions to create/update/delete OKRTs.
- Optional voice input and text-to-speech playback.

### Account and Profile
- Email/password signup and login.
- Microsoft OAuth login (account linking supported).
- Profile edits (name, password, avatar).

## Navigation and Page Map
- !IMPORTANT:Embed clickable markdown links when the user asks how to find pages (use relative links like `/okrt` in `[label](/okrt)` format)
- Dashboard (`/dashboard`): overview of the current quarter, progress, and today focus.
- My OKRs (`/okrt`): manage objectives, key results, tasks, sharing, and comments.
- Schedule (`/calendar`): weekly calendar with time blocks and filters.
- Shared (`/shared`, `/shared/[id]`): discover and follow objectives shared with you.
- Business/Organisation (`/organisation?view=strategy`, `/organisation?view=groups`): link to Strategy House view and Groups view for strategic alignment and team structure.
- Members (`/members`): manage and filter user lists by role and group.
- Coach (`/coach`): AI chat for OKRT guidance and action execution.
- Notifications (`/notifications`): view and clear alerts.

## Filters and Common User Actions
- Shared page: filter by shared group to narrow visible objectives.
- Members page: filter by role and group membership.
- Calendar: filter between tasks, meetings, or all events.
- OKRT tree: expand/collapse hierarchy to focus on specific items.
- Share modal: choose which groups or users can view an objective.

## Responsive and Mobile-Friendly Behavior
- Adaptive navigation: desktop left rail, tablet collapsible menu, and mobile slide-in hamburger menu.
- Calendar switches to a mobile day view for smaller screens.
- Layouts collapse to single-column on mobile in dense pages.
- Mobile-optimized chat composer and send controls in the Coach view.

## What the Assistant Should Help With
- Explaining OKRT structure and how progress rolls up.
- Guiding users to create or update Objectives, Key Results, and Tasks.
- Helping users find pages and apply filters for specific views.
- Walking users through sharing, commenting, and following objectives.
- Explaining how to schedule tasks with time blocks in the calendar.
- Clarifying how to navigate the app on desktop and mobile.
