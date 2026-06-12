# CBM Guest Directory

A full-stack web application built for a homeless shelter to manage guest records, track check-ins, and enforce a structured ban system. Developed as a real-world project during my first year of college as a Computer Engineering student.

## Overview

The shelter previously had no centralized system for tracking guest bans — staff had no reliable way to know who was banned, for how long, or why. This application solves that problem and expands into a broader guest management and reporting platform.

## Features

### Guest Management
- Create and search guest profiles with name, alias, and photo
- Collect demographic data for grant reporting (gender, race/ethnicity, living situation, health condition, veteran status, date of birth)
- Photo upload via Supabase Storage
- Full edit mode on all guest profiles

### Ban System
- Issue bans with offense selection, custom duration, and staff notes
- Preset offense list organized by category (Violence, Theft, Substance Use, Policy Violation), each with a default ban duration
- Bans auto-expire when their end date passes
- Staff can lift bans early with documented reasons
- Full ban history on every guest profile
- Audit log records every action with the staff member who performed it

### Door Check
- Mobile-optimized screen for staff at the front entrance
- Event selection screen (Daily Bread, Dream Center Outreach) before checking guests in
- Real-time guest search with photo display
- Instantly shows whether a guest is banned with full ban details
- Logs check-ins to the database with event, time, and staff member
- Option to create a new guest profile if not found in the system

### Dashboard
- **Demographics tab** — breakdown charts for gender, race/ethnicity, living situation, health condition, and veteran status across all guests; CSV export for grant reporting
- **Guests tab** — search and browse all guest profiles
- **Bans tab** — search and filter active, lifted, and expired bans
- **Check-ins tab** — view check-in history grouped by event and date, filterable by day/week/month/year/all time; CSV export
- **Staff tab** — create and delete staff accounts (admin only)

### Access Control
- Role-based permissions: admin and staff roles
- Admins have full access including demographics, staff management, and settings
- Staff can manage guests, issue bans, and check in guests
- All routes protected — unauthenticated users are redirected to login

### Settings (Admin Only)
- Add and deactivate check-in events
- Add and remove offense categories and offenses

## Tech Stack

**Frontend**
- React 18 with Vite
- React Router for client-side navigation
- Tailwind CSS for styling

**Backend / Infrastructure**
- Supabase (PostgreSQL database, Auth, Storage, Edge Functions)
- Row Level Security policies for data protection
- Supabase Edge Functions (Deno) for secure server-side operations like account creation

**Deployment**
- Vercel (frontend)
- Supabase (backend, always-on)

## Database Schema

The application uses a relational PostgreSQL database with the following core tables:

- `guests` — guest profiles and demographic data
- `staff` — staff accounts linked to Supabase Auth
- `bans` — ban records with foreign keys to guests and staff
- `ban_offenses` — join table linking bans to one or more offenses
- `offenses` — offense types with default ban durations
- `offense_categories` — offense groupings
- `events` — check-in event types
- `check_ins` — individual check-in records
- `audit_log` — immutable record of all staff actions

## What I Built and Learned

This was my first full-stack project, built over the course of a summer while completing my first year of Computer Engineering. Starting from scratch, I:

- Designed a normalized relational database schema from requirements gathered directly from shelter staff
- Built a React frontend from the ground up, learning components, state management, hooks, and routing
- Integrated a real backend with authentication, file storage, and a REST API
- Implemented row-level security policies to enforce access control at the database level
- Deployed a production application accessible from any device

The project is actively used by the shelter and continues to be developed based on staff feedback.
