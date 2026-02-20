# CareTrack - Child Sponsorship Records Portal

## Overview
A secure internal case-management portal for nonprofit organizations to store documents, track child progress, and manage sponsorship records over time. Not a fundraising/payment platform.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Custom username/password authentication with bcryptjs password hashing, express-session with connect-pg-simple for PostgreSQL session store
- **File uploads**: Multer, stored in `/uploads` directory

## Key Features
- Child Profiles (CRUD with status tracking: active/paused/exited)
- Document Management (upload files linked to child profiles, 7 categories)
- Progress Timeline (chronological feed of milestones and events)
- Dashboard with statistics overview
- Custom username/password login (no signup - admin creates users)
- Admin user management panel (create, edit, delete users and assign roles)
- Role-based access control: admin, case_worker, read_only

## Auth System
- Login via username/password (POST /api/login), no signup form
- Default admin account seeded: username "admin", password "admin123"
- Sessions stored in PostgreSQL via connect-pg-simple
- Roles: admin (full access + user management), case_worker (CRUD on children/docs/timeline), read_only (view only)
- Admin panel at /admin/users for managing user accounts

## Project Structure
- `shared/schema.ts` - Drizzle schema (children, documents, timelineEntries) + auth models
- `shared/models/auth.ts` - Auth-related Drizzle schemas (users, sessions), Zod validation schemas (loginSchema, createUserSchema, updateUserSchema)
- `server/routes.ts` - API endpoints for children, documents, timeline
- `server/storage.ts` - DatabaseStorage class with all CRUD operations
- `server/seed.ts` - Seed data for initial database population (admin user + 5 sample children)
- `server/db.ts` - Database connection
- `server/replit_integrations/auth/replitAuth.ts` - Session setup, login/logout endpoints, isAuthenticated middleware
- `server/replit_integrations/auth/routes.ts` - Auth routes (current user, admin user CRUD)
- `server/replit_integrations/auth/storage.ts` - AuthStorage class for user operations
- `client/src/App.tsx` - Main app with routing and auth gating
- `client/src/pages/` - Page components (landing/login, dashboard, children-list, child-form, child-profile, admin-users)
- `client/src/components/` - Reusable components (app-sidebar, theme-provider, theme-toggle)
- `client/src/hooks/use-auth.ts` - Auth hook for frontend session management

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

### Children (requires auth)
- `GET /api/children` - List all children
- `GET /api/children/:id` - Get child by ID
- `POST /api/children` - Create child (not read_only)
- `PATCH /api/children/:id` - Update child (not read_only)
- `DELETE /api/children/:id` - Delete child (not read_only)

### Documents
- `GET /api/children/:id/documents` - List documents for child
- `POST /api/children/:id/documents` - Upload document (multipart form, not read_only)
- `DELETE /api/documents/:id` - Delete document (not read_only)

### Timeline
- `GET /api/children/:id/timeline` - Timeline entries for child
- `POST /api/children/:id/timeline` - Add timeline entry (not read_only)
- `GET /api/timeline/recent` - Recent timeline entries across all children

### Stats
- `GET /api/stats` - Dashboard statistics
