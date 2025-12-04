# LearnLynk Technical Assessment

A full-stack application demonstrating multi-tenant lead management with role-based access control, task management, and Stripe payment integration concepts.

## Tech Stack

- **Frontend**: Next.js with React
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **Authentication**: Supabase Auth with JWT
- **Payment Processing**: Stripe (conceptual integration)

## Project Structure
```
.
├── backend/
│   ├── schema.sql                 # Database schema with multi-tenancy
│   ├── rls_policies.sql          # Row-Level Security policies
│   └── edge-functions/
│       └── create-task/
│           └── index.ts          # Task creation API endpoint
└── frontend/
    └── pages/
        └── dashboard/
            └── today.tsx         # Daily task dashboard
```

## Features

### 1. Database Schema
**File**: `backend/schema.sql`

- Multi-tenant architecture with strict data isolation
- Three core tables: `leads`, `applications`, `tasks`
- Cascading relationships for data integrity
- Audit fields (`created_at`, `updated_at`, `tenant_id`)
- Custom constraints:
  - Task type enforcement (`call`, `email`, `review`)
  - Due date validation (prevents retroactive deadlines)
- Performance indexes on common access patterns
- Team-based access support via `team_id` column

### 2. Row-Level Security (RLS)
**File**: `backend/rls_policies.sql`

**Tenant Isolation**
- All policies enforce `tenant_id` matching via JWT claims
- Prevents cross-tenant data leaks

**Role-Based Access**
- **Admins**: Full access to all tenant data
- **Counselors**: Access limited to:
  - Leads they own directly (`owner_id`)
  - Leads assigned to their teams (via `user_teams` table)

**Operations**
- SELECT: Role-based filtering with team support
- INSERT: Restricted to authenticated users within their tenant

### 3. Edge Function: Task Creation
**File**: `backend/edge-functions/create-task/index.ts`

**Features**
- Input validation for task type and due date
- Future date enforcement for deadlines
- Service role client for secure insertions
- Structured error responses (400/500)

**Endpoint**
```
POST /functions/v1/create-task
Content-Type: application/json

{
  "application_id": "uuid",
  "task_type": "call|email|review",
  "due_at": "ISO-8601 datetime"
}
```

### 4. Daily Task Dashboard
**File**: `frontend/pages/dashboard/today.tsx`

**Capabilities**
- Filters tasks due today (00:00:00 to 23:59:59)
- Excludes completed tasks
- Optimistic UI updates for task completion
- Loading and error states
- Real-time data from Supabase

**User Actions**
- View all pending tasks for the current day
- Mark tasks as complete with single click
- Automatic UI refresh on status change

### 5. Stripe Payment Integration (Conceptual)

**Payment Flow Design**

1. **Initiation**
   - Create `payment_requests` record (status: `pending`)
   - Generate Stripe Checkout Session
   - Store `stripe_session_id` for tracking
   - Include `application_id` in session metadata

2. **User Payment**
   - Redirect to Stripe hosted checkout
   - User completes payment securely

3. **Webhook Handling**
   - Listen for `checkout.session.completed` event
   - Verify webhook signature
   - Extract `application_id` from metadata
   - Update `payment_requests` status to `paid`
   - Advance application stage (e.g., to `review`)
   - Transaction guarantees data consistency

**Database Table**
```sql
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id),
  stripe_session_id TEXT,
  status TEXT CHECK (status IN ('pending', 'paid', 'failed')),
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase account
- PostgreSQL knowledge (helpful)

### Backend Setup

1. **Create Supabase Project**
```bash
   # Visit https://supabase.com and create new project
```

2. **Run Database Migrations**
```bash
   # Execute in Supabase SQL Editor
   cat backend/schema.sql | pbcopy
   # Paste and run in SQL Editor
   
   cat backend/rls_policies.sql | pbcopy
   # Paste and run in SQL Editor
```

3. **Deploy Edge Function**
```bash
   supabase functions deploy create-task
```

### Frontend Setup

1. **Install Dependencies**
```bash
   cd frontend
   npm install
```

2. **Configure Environment**
```bash
   cp .env.example .env.local
```
   
   Add your Supabase credentials:
```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. **Run Development Server**
```bash
   npm run dev
```
   
   Visit `http://localhost:3000/dashboard/today`

## Architecture Decisions

### Multi-Tenancy
- **Tenant ID** included in all tables
- RLS policies enforce strict isolation
- JWT claims used for authorization

### Team-Based Access
- `team_id` column added to `leads` table
- `user_teams` junction table for many-to-many relationships
- Counselors access leads via ownership OR team membership

### Security
- RLS policies prevent unauthorized data access
- Service role used only in backend functions
- Input validation on all endpoints
- Webhook signature verification for payments

### Performance
- Strategic indexes on:
  - Foreign keys (`owner_id`, `application_id`)
  - Filter columns (`status`, `due_at`)
  - Tenant isolation (`tenant_id`)
- Optimistic UI updates reduce perceived latency

### Scalability
- Edge Functions for serverless compute
- Database cascades reduce orphaned data
- Structured error handling for debugging

## API Reference

### Create Task
**Endpoint**: `POST /functions/v1/create-task`

**Request**
```json
{
  "application_id": "123e4567-e89b-12d3-a456-426614174000",
  "task_type": "call",
  "due_at": "2025-12-05T14:00:00Z"
}
```

**Response** (Success)
```json
{
  "success": true,
  "task": {
    "id": "...",
    "application_id": "...",
    "type": "call",
    "due_at": "2025-12-05T14:00:00Z",
    "status": "pending"
  }
}
```

**Response** (Error)
```json
{
  "error": "due_at must be a future date"
}
```

## Testing

### Database Tests
```sql
-- Test tenant isolation
SET request.jwt.claims = '{"tenant_id": "tenant-1"}';
SELECT * FROM leads; -- Should only see tenant-1 leads

-- Test role-based access
SET request.jwt.claims = '{"tenant_id": "tenant-1", "role": "counselor", "user_id": "user-1"}';
SELECT * FROM leads WHERE owner_id != 'user-1'; -- Should only see team leads
```

### Edge Function Tests
```bash
# Valid request
curl -X POST https://your-project.supabase.co/functions/v1/create-task \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"application_id":"...","task_type":"call","due_at":"2025-12-05T14:00:00Z"}'

# Invalid date
curl -X POST https://your-project.supabase.co/functions/v1/create-task \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"application_id":"...","task_type":"call","due_at":"2020-01-01T00:00:00Z"}'
```

## Key Learnings

1. **RLS Complexity**: Team-based access required careful EXISTS subqueries to avoid N+1 problems
2. **Date Handling**: Timezone-aware filtering crucial for "due today" accuracy
3. **Optimistic Updates**: Improves UX but requires rollback logic for failures
4. **Service Role**: Necessary for backend operations but must be protected
5. **Webhook Security**: Signature verification prevents spoofed payment confirmations

## Future Improvements

- [ ] Add caching layer (Redis) for frequent queries
- [ ] Implement real-time subscriptions for live dashboard updates
- [ ] Add comprehensive test suite (Jest + Playwright)
- [ ] Create admin panel for tenant management
- [ ] Implement audit logging for compliance
- [ ] Add email notifications for overdue tasks
- [ ] Build mobile app with React Native
