# CareTrack - Child Sponsorship Records Portal

## Overview
A secure internal case-management portal for nonprofit organizations to store documents, track child progress, and manage sponsorship records over time. Not a fundraising/payment platform.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect)
- **File uploads**: Multer, stored in `/uploads` directory

## Key Features
- Child Profiles (CRUD with status tracking: active/paused/exited)
- Document Management (upload files linked to child profiles)
- Progress Timeline (chronological feed of milestones and events)
- Dashboard with statistics overview
- Secure authentication via Replit Auth

## Project Structure
- `shared/schema.ts` - Drizzle schema (children, documents, timelineEntries) + auth models
- `shared/models/auth.ts` - Auth-related Drizzle schemas (users, sessions)
- `server/routes.ts` - API endpoints
- `server/storage.ts` - DatabaseStorage class with all CRUD operations
- `server/seed.ts` - Seed data for initial database population
- `server/db.ts` - Database connection
- `server/replit_integrations/auth/` - Replit Auth module
- `client/src/App.tsx` - Main app with routing and auth gating
- `client/src/pages/` - Page components (landing, dashboard, children-list, child-form, child-profile)
- `client/src/components/` - Reusable components (app-sidebar, theme-provider, theme-toggle)

## API Endpoints
- `GET /api/children` - List all children
- `GET /api/children/:id` - Get child by ID
- `POST /api/children` - Create child
- `PATCH /api/children/:id` - Update child
- `DELETE /api/children/:id` - Delete child
- `GET /api/children/:id/documents` - List documents for child
- `POST /api/children/:id/documents` - Upload document (multipart form)
- `DELETE /api/documents/:id` - Delete document
- `GET /api/children/:id/timeline` - Timeline entries for child
- `POST /api/children/:id/timeline` - Add timeline entry
- `GET /api/timeline/recent` - Recent timeline entries across all children
