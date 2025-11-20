# 90 Days Goal & Coaching App - Architecture Documentation

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end
    
    subgraph "Next.js Application Layer"
        subgraph "Frontend - React Components"
            Pages[Pages/Routes]
            Components[UI Components]
            Hooks[Custom Hooks]
            Contexts[Context Providers]
            Store[Zustand Store]
        end
        
        subgraph "API Routes - Next.js Backend"
            AuthAPI[Auth APIs]
            OKRTAPI[OKRT APIs]
            GroupAPI[Group APIs]
            CommentAPI[Comment APIs]
            NotifAPI[Notification APIs]
            TimeBlockAPI[Time Block APIs]
            LLMAPI[LLM/AI APIs]
        end
        
        subgraph "Business Logic Layer"
            AuthLib[Authentication lib/auth.js]
            DBLib[Database lib/pgdb.js]
            NotifLib[Notifications lib/notifications.js]
            ProgressLib[Progress Propagation lib/progressPropagation.js]
            CacheLib[Cache Handler lib/cacheUpdateHandler.js]
            TreeLib[Tree Loader lib/mainTreeLoader.js]
        end
    end
    
    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL Database)]
        SQLite[(SQLite - Legacy)]
    end
    
    subgraph "External Services"
        MSAuth[Microsoft OAuth Azure AD]
        OpenAI[OpenAI API]
    end
    
    Browser --> Pages
    Mobile --> Pages
    Pages --> Components
    Components --> Hooks
    Components --> Contexts
    Hooks --> Store
    
    Pages --> AuthAPI
    Pages --> OKRTAPI
    Pages --> GroupAPI
    Pages --> CommentAPI
    Pages --> NotifAPI
    Pages --> TimeBlockAPI
    Pages --> LLMAPI
    
    AuthAPI --> AuthLib
    AuthAPI --> MSAuth
    OKRTAPI --> DBLib
    GroupAPI --> DBLib
    CommentAPI --> DBLib
    NotifAPI --> NotifLib
    TimeBlockAPI --> DBLib
    LLMAPI --> OpenAI
    
    AuthLib --> DBLib
    NotifLib --> DBLib
    ProgressLib --> DBLib
    CacheLib --> Store
    TreeLib --> DBLib
    
    DBLib --> PostgreSQL
    DBLib -.-> SQLite
```

## Detailed Component Architecture

### 1. Frontend Architecture

```mermaid
graph LR
    subgraph "Page Components"
        Home[Home Page]
        Dashboard[Dashboard]
        Login[Login/Signup]
        Profile[Profile]
        OKRT[OKRT Detail]
        Groups[Groups]
    end
    
    subgraph "Shared Components"
        Header[HeaderBar]
        LeftMenu[LeftMenu]
        MobileMenu[MobileMenu]
        Avatar[AvatarDropdown]
        Notif[NotificationsWidget]
        Clock[TwelveWeekClock]
        Today[TodayWidget]
        Tree[OKRTreeComponent]
        Cards[OKRTCards]
        Comments[CommentsSection]
        Modal[OKRTModal]
        Share[ShareModal]
    end
    
    subgraph "State Management"
        UserHook[useUser Hook]
        MediaHook[useMediaQuery Hook]
        TreeHook[useMainTree Hook]
        CoachCtx[CoachContext]
        TreeStore[mainTreeStore Zustand]
    end
    
    Home --> Header
    Dashboard --> Header
    Dashboard --> LeftMenu
    Dashboard --> Clock
    Dashboard --> Today
    Dashboard --> Tree
    
    Header --> Avatar
    Header --> Notif
    LeftMenu --> MobileMenu
    
    Tree --> Cards
    OKRT --> Comments
    OKRT --> Modal
    OKRT --> Share
    
    Dashboard --> UserHook
    Dashboard --> MediaHook
    Dashboard --> TreeHook
    Dashboard --> CoachCtx
    
    TreeHook --> TreeStore
    Tree --> TreeStore
```

### 2. API Routes Architecture

```mermaid
graph TB
    subgraph "Authentication APIs"
        Login[POST /api/login]
        Signup[POST /api/signup]
        Logout[POST /api/logout]
        Me[GET /api/me]
        MSCallback[GET /api/auth/microsoft/callback]
    end
    
    subgraph "OKRT Management APIs"
        GetOKRT[GET /api/okrt]
        CreateOKRT[POST /api/okrt]
        UpdateOKRT[PATCH /api/okrt/id]
        DeleteOKRT[DELETE /api/okrt/id]
        SharedOKRT[GET /api/okrt/shared]
        MainTree[GET /api/okrt/main-tree]
    end
    
    subgraph "Group Management APIs"
        GetGroups[GET /api/groups]
        CreateGroup[POST /api/groups]
        UpdateGroup[PATCH /api/groups/id]
        JoinGroup[POST /api/groups/id/join]
        LeaveGroup[DELETE /api/groups/id/leave]
    end
    
    subgraph "Social Features APIs"
        GetComments[GET /api/comments]
        CreateComment[POST /api/comments]
        GetRewards[GET /api/comments/rewards]
        GetNotif[GET /api/notifications]
        MarkRead[PATCH /api/notifications/id]
    end
    
    subgraph "Time Management APIs"
        GetTimeBlocks[GET /api/time-blocks]
        CreateTimeBlock[POST /api/time-blocks]
        UpdateTimeBlock[PATCH /api/time-blocks/id]
        GetTasks[GET /api/tasks/current-cycle]
    end
    
    subgraph "AI Features APIs"
        LLMChat[POST /api/llm]
        TTS[POST /api/text-to-speech]
    end
```

### 3. Database Schema Architecture

```mermaid
erDiagram
    USERS ||--o{ OKRT : owns
    USERS ||--o{ USER_GROUP : belongs_to
    USERS ||--o{ FOLLOWS : follows
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ COMMENTS : sends
    USERS ||--o{ COMMENTS : receives
    USERS ||--o{ TIME_BLOCKS : schedules
    
    GROUPS ||--o{ USER_GROUP : contains
    GROUPS ||--o{ SHARE : shared_with
    GROUPS ||--o{ GROUPS : parent_of
    
    OKRT ||--o{ OKRT : parent_of
    OKRT ||--o{ SHARE : shared_as
    OKRT ||--o{ FOLLOWS : followed_by
    OKRT ||--o{ COMMENTS : has
    OKRT ||--o{ TIME_BLOCKS : scheduled_in
    
    COMMENTS ||--o{ COMMENTS : replies_to
    
    USERS {
        int id PK
        string username UK
        string password_hash
        string display_name
        string email UK
        string microsoft_id UK
        string first_name
        string last_name
        string profile_picture_url
        string auth_provider
        jsonb preferences
        timestamp created_at
        timestamp updated_at
    }
    
    OKRT {
        string id PK
        string type
        int owner_id FK
        string parent_id FK
        string title
        string description
        float progress
        string status
        string area
        string cycle_qtr
        int order_index
        string visibility
        string objective_kind
        float kr_target_number
        string kr_unit
        float kr_baseline_number
        float weight
        string task_status
        date due_date
        string recurrence_json
        string blocked_by FK
        string header_image_url
        timestamp created_at
        timestamp updated_at
    }
    
    GROUPS {
        string id PK
        string name UK
        string type
        string parent_group_id FK
        string thumbnail_url
        timestamp created_at
        timestamp updated_at
    }
    
    USER_GROUP {
        int user_id FK
        string group_id FK
        boolean is_admin
        timestamp created_at
    }
    
    SHARE {
        string okrt_id FK
        string group_or_user_id
        string share_type
        timestamp created_at
    }
    
    FOLLOWS {
        int id PK
        int user_id FK
        string objective_id FK
        timestamp created_at
    }
    
    NOTIFICATIONS {
        int id PK
        int user_id FK
        string type
        string title
        string message
        string related_okrt_id FK
        string related_group_id FK
        int related_user_id FK
        boolean is_read
        timestamptz created_at
    }
    
    COMMENTS {
        int id PK
        string comment
        int parent_comment_id FK
        string type
        int count
        int sending_user FK
        int receiving_user FK
        string okrt_id FK
        timestamptz created_at
        timestamptz updated_at
    }
    
    TIME_BLOCKS {
        int id PK
        string task_id FK
        int user_id FK
        timestamptz start_time
        int duration
        string objective_id FK
        timestamptz created_at
        timestamptz updated_at
    }
```

## Technology Stack

### Frontend
- **Framework**: Next.js 15.5.3 (App Router)
- **Language**: JavaScript (React 19.1.0)
- **UI Libraries**: 
  - Material-UI (@mui/material, @mui/x-tree-view)
  - PrimeReact
  - Lucide React Icons
  - React Icons
- **State Management**: 
  - Zustand (global state)
  - React Context (theme, coach)
  - Custom Hooks (user, media query, main tree)
- **Styling**: CSS Modules + Theme Variables
- **Tree Visualization**: React Arborist, TidyTree

### Backend
- **Runtime**: Node.js with Next.js API Routes
- **Authentication**: 
  - JWT (jose library)
  - NextAuth.js (Microsoft OAuth)
  - bcryptjs (password hashing)
- **Database**: 
  - PostgreSQL (primary - pg library)
  - SQLite (legacy support - sqlite3)
- **AI Integration**: OpenAI API

### Database
- **Primary**: PostgreSQL with connection pooling
- **Schema Management**: SQL migration scripts
- **Features**:
  - Automatic timestamp updates
  - Cascading deletes
  - JSONB for preferences
  - Full-text search ready

## Key Features by Phase

### Phase 1-2: Foundation
- User authentication (email/password)
- Microsoft OAuth integration
- Profile management
- Responsive navigation

### Phase 3: OKR Framework
- Objectives, Key Results, Tasks (OKRT) hierarchy
- Progress tracking
- Status management
- Cycle/quarter organization

### Phase 6: Collaboration
- Groups (Organization, Department, Team, etc.)
- User-group relationships
- OKRT sharing with groups/users
- Group hierarchy

### Phase 7: Social Features
- Following shared objectives
- Visibility controls
- Ownership management

### Phase 8: Notifications
- Real-time notification system
- Multiple notification types
- Read/unread tracking
- Related entity linking

### Phase 9: Engagement
- Comments system
- Threaded replies
- Rewards (medals, stars, cookies)
- Reward aggregation

### Phase 11: Time Management
- Time blocking
- Task scheduling
- Calendar integration
- Duration tracking

### Phase 14: AI Features
- LLM-powered coaching
- Text-to-speech
- Intelligent suggestions

## Data Flow Patterns

### 1. Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant Auth
    participant DB
    
    User->>Browser: Enter credentials
    Browser->>API: POST /api/login
    API->>Auth: verifyPassword()
    Auth->>DB: getUserByEmail()
    DB-->>Auth: User data
    Auth->>Auth: createSession()
    Auth-->>API: JWT token
    API-->>Browser: Set cookie + user data
    Browser-->>User: Redirect to dashboard
```

### 2. OKRT Creation Flow
```mermaid
sequenceDiagram
    participant User
    participant Component
    participant API
    participant DB
    participant Cache
    
    User->>Component: Create OKRT
    Component->>API: POST /api/okrt
    API->>DB: createOKRT()
    DB-->>API: New OKRT
    API->>Cache: Update instruction
    API-->>Component: OKRT + cache update
    Component->>Cache: Apply cache update
    Cache-->>Component: Updated state
    Component-->>User: Show new OKRT
```

### 3. Progress Propagation Flow
```mermaid
sequenceDiagram
    participant User
    participant API
    participant Progress
    participant DB
    
    User->>API: Update Task progress
    API->>DB: updateOKRT()
    API->>Progress: propagateProgress()
    Progress->>DB: Get parent KR
    Progress->>Progress: Calculate KR progress
    Progress->>DB: Update KR progress
    Progress->>DB: Get parent Objective
    Progress->>Progress: Calculate Objective progress
    Progress->>DB: Update Objective progress
    Progress-->>API: Complete
    API-->>User: Success
```

## Security Architecture

### Authentication & Authorization
- JWT-based session management
- HTTP-only cookies
- 7-day token expiration
- Password hashing with bcrypt (12 rounds)
- Microsoft OAuth integration

### Data Access Control
- User-owned OKRT filtering
- Group membership validation
- Share permission checks
- Admin role verification

### API Security
- Session validation on all protected routes
- User ID verification from JWT
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

## Performance Optimizations

### Frontend
- CSS Modules for scoped styling
- Theme variables for consistent theming
- Media query hooks for responsive design
- Zustand for efficient state management
- Component-level code splitting

### Backend
- PostgreSQL connection pooling (max 20 connections)
- Database indexes on frequently queried columns
- Efficient hierarchical queries
- Cache update instructions to minimize refetches

### Database
- Indexed foreign keys
- Composite indexes for common queries
- Automatic timestamp triggers
- Optimized JOIN queries with views

## Deployment Considerations

### Environment Variables Required
```
DATABASE_URL or POSTGRES_* variables
SESSION_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID
OPENAI_API_KEY
NODE_ENV
```

### Database Migration Path
1. SQLite (Phase 1-2) → PostgreSQL (Phase 3+)
2. Migration scripts in `Phase1/PGDB/`
3. Automatic schema initialization
4. Backward compatibility maintained

### Scalability
- Stateless API design
- Database connection pooling
- Horizontal scaling ready
- CDN-ready static assets

## Future Architecture Considerations

### Potential Enhancements
- Redis for session storage and caching
- WebSocket for real-time notifications
- GraphQL API layer
- Microservices for AI features
- Mobile native apps (React Native)
- Offline-first PWA capabilities
- Event sourcing for audit trails
- CQRS pattern for read/write optimization

### Monitoring & Observability
- Application performance monitoring
- Database query performance tracking
- Error tracking and logging
- User analytics
- API rate limiting