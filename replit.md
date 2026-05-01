# PWE (Partners with Ethiopia) - Child Sponsorship Records Portal

## Overview
A secure internal case-management portal for Partners with Ethiopia (PWE) to store documents, track child progress, and manage sponsorship records over time. Supports multi-organization management, sponsor messaging, and data export. Not a fundraising/payment platform.

## Design System
- **Style**: Balbooa Forms-inspired — soft, rounded, spacious, minimalist
- **Font**: Inter (sans-serif), IBM Plex Mono (monospace) via Google Fonts
- **Color System**: Purpose-driven — Blue (#3b82f6 / HSL 217 72% 53%) as primary for navigation, UI chrome, focus rings; Green (emerald-600) for creation/positive actions (Add Child, Create User, active status); Amber for warnings/paused; Red for destructive/exited; Pink/Rose for sponsorship; Orange for organizations
- **Border Radius**: 12px (lg), 8px (md), 6px (sm) — rounded, friendly feel
- **Shadows**: Soft, layered shadows (not flat/zero-shadow)
- **Inputs**: h-11, rounded-lg, border-border/60, soft blue glow on focus (box-shadow ring)
- **Buttons**: Rounded-lg, shadow-sm on primary, h-11 for form buttons, h-9 for action buttons. Creation buttons use `bg-emerald-600 hover:bg-emerald-700 text-white`
- **Cards**: border-border/50, hover:shadow-md, whisper-light borders
- **Spacing**: Generous — p-5/p-7/p-8, space-y-5/6 for form fields
- **Section Headers**: Blue accent bar (w-1 h-5 rounded-full bg-primary) before title text

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Custom username/password authentication with bcryptjs password hashing, express-session with connect-pg-simple for PostgreSQL session store
- **File uploads**: Replit Object Storage (cloud-based, persists across deployments) with presigned URL upload flow
- **Export**: xlsx package for CSV/XLSX spreadsheet generation

## Key Features
- Child Profiles (CRUD with status tracking: active/paused/exited, profile photo, sponsor photo, inline-editable description)
- Sponsored/Non-Sponsored categorization with filtering and dashboard stats
- Document Management (upload files linked to child profiles, 7 categories, delete confirmation dialog)
- Progress Timeline (chronological feed of milestones and events)
- Sponsor Commenting (leave comments on behalf of sponsors, reactions: like/love, threaded replies, status tracking: pending/delivered/read)
- Multi-Organization Management (create/manage organizations, assign children to organizations)
- Organization-based access control (non-admin users assigned to an org only see that org's children)
- Multi-child sponsor assignment: sponsors can be linked to one or more children; per-child commenting toggle directly in User Management
- Data Export to CSV/XLSX with selectable fields
- Dashboard with statistics overview (total, active, paused, sponsored counts), org filter, and pending messages
- Custom username/password login (no signup - admin creates users)
- Admin user management panel (create, edit, delete users, assign roles and organizations)
- Role-based access control: admin, case_worker, read_only, sponsor
- **Sponsor Portal**: Dedicated read-only portal for sponsors — warm welcome, child profile card, progress/documents/comments tabs, comment/react/reply capability; completely isolated from admin UI

## Auth System
- Login via username/password (POST /api/login), no signup form
- Default admin account seeded: username "admin", password "admin123"
- Sessions stored in PostgreSQL via connect-pg-simple
- Roles: admin (full access + user management + org management), case_worker (CRUD on children/docs/timeline/comments), read_only (view only), sponsor (view assigned children + leave comments/reactions/replies if enabled)
- Admin panel at /admin/users for managing user accounts

## Project Structure
- `shared/schema.ts` - Drizzle schema (organizations, children, documents, timelineEntries, messages) + auth models
- `shared/models/auth.ts` - Auth-related Drizzle schemas (users, sessions), Zod validation schemas
- `server/routes.ts` - API endpoints for organizations, children, documents, timeline, messages, export, stats
- `server/storage.ts` - DatabaseStorage class with all CRUD operations
- `server/seed.ts` - Seed data for initial database population (admin user + 5 sample children)
- `server/db.ts` - Database connection
- `server/auth/` - Session setup, login/logout endpoints, auth middleware, user CRUD (platform-agnostic)
- `server/uploads.ts` - Local disk file upload handling (platform-agnostic, replaces Replit object storage)
- `client/src/App.tsx` - Main app with routing and auth gating
- `client/src/pages/` - Page components (landing, dashboard, children-list, child-form, child-profile, admin-users, organizations, sponsor-portal)
- `client/src/components/` - Reusable components (app-sidebar, theme-provider, theme-toggle)
- `client/src/hooks/use-auth.ts` - Auth hook for frontend session management

## Database Tables
- `organizations` - id, name, description, createdAt
- `children` - id, childId, fullName, age, gender, location, programEnrollment, assignedSponsors, assignedCaseWorker, status, photoUrl, description, isSponsored, sponsorPhotoUrl, organizationId (FK), sponsorUserId (varchar, links to users.id), sponsorCanComment (boolean, default false — admin-controlled)
- `documents` - id, childId (FK), documentType, description, fileName, fileUrl, uploadedBy, uploadedAt
- `timeline_entries` - id, childId (FK), title, description, entryType, createdBy, createdAt
- `messages` - id, childId (FK), senderName, senderRole, content, status, createdAt
- `users` - id, username, hashedPassword, firstName, lastName, email, role, organizationId, createdAt, updatedAt
- `sessions` - sid, sess, expire

## API Endpoints
### Auth
- `POST /api/login` - Login with {username, password}
- `POST /api/logout` - Logout (destroy session)
- `GET /api/auth/user` - Get current authenticated user

### Admin (requires admin role)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Organizations (requires auth, admin for write)
- `GET /api/organizations` - List all organizations
- `GET /api/organizations/:id` - Get organization by ID
- `POST /api/organizations` - Create organization (admin only)
- `PATCH /api/organizations/:id` - Update organization (admin only)
- `DELETE /api/organizations/:id` - Delete organization (admin only)

### Children (requires auth)
- `GET /api/children` - List all children (optional ?organizationId filter)
- `GET /api/children/:id` - Get child by ID
- `POST /api/children` - Create child (not read_only)
- `PATCH /api/children/:id` - Update child (not read_only)
- `DELETE /api/children/:id` - Delete child (not read_only)
- `POST /api/children/:id/photo` - Upload child photo
- `POST /api/children/:id/sponsor-photo` - Upload sponsor photo

### File Uploads (requires auth)
- `POST /api/uploads/request-url` - Get presigned URL for file upload
- `GET /objects/*` - Serve uploaded files from cloud storage

### Documents
- `GET /api/children/:id/documents` - List documents for child
- `POST /api/children/:id/documents` - Create document record (not read_only)
- `PATCH /api/documents/:id` - Update document description
- `DELETE /api/documents/:id` - Delete document (not read_only)

### Timeline
- `GET /api/children/:id/timeline` - Timeline entries for child
- `POST /api/children/:id/timeline` - Add timeline entry (not read_only)
- `PATCH /api/timeline/:id` - Update timeline entry description
- `GET /api/timeline/recent` - Recent timeline entries across all children

### Messages
- `GET /api/children/:id/messages` - Messages for child
- `POST /api/children/:id/messages` - Send message (not read_only)
- `PATCH /api/messages/:id` - Update message status (pending/delivered/read)
- `DELETE /api/messages/:id` - Delete message (not read_only)
- `GET /api/messages/pending` - All pending messages (admin/case_worker review)

### Export
- `POST /api/export/children` - Export children data as CSV or XLSX with field selection

### Stats
- `GET /api/stats` - Dashboard statistics (optional ?organizationId filter)
