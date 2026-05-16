# Project Name

**records.io / VERIFY//DENY**

A post-collapse identity verification prototype that uses NFC cards, local records, and human review to rebuild trust after all centralized digital records are lost.

## Screenshot / GIF

<!-- Add project screenshot here -->
<!-- Example: ![Landing Page](./docs/screenshots/landing.png) -->

<!-- Add demo GIF here -->
<!-- Example: ![Demo GIF](./docs/screenshots/demo.gif) -->

## Overview

`records.io` is a hackathon project set in a world where a solar flare has wiped out the digital systems that normally prove identity, ownership, and authority.

Instead of relying on a central online registry, the project explores a more resilient verification workflow:

- citizens submit identity details and supporting documents
- the system writes a portable NFC identity payload
- admins review submissions and assign a decision
  Optional wording: verification coordinators review submissions and combine new claims with partially recovered legacy graph data before assigning a decision
  Note for team: keep the `admin` wording if you want the README to match the current UI and routes exactly; use the `verification coordinators` wording if you want the narrative to better reflect transitional trust rebuilding instead of centralized authority
- a checker device scans the card and receives a live verification result
- a relationship graph helps operators inspect trust signals inside a partially recovered legacy citizen graph

The current implementation combines a React frontend, a Node.js backend, SQLite-based local storage, WebSocket-based real-time communication, and a seeded citizen graph database for investigation and storytelling.

## Features

- NFC-oriented identity intake flow with form fields for name, phone, occupation, address, and uploaded documents
- Automatic submission storage in a local SQLite database powered by `sql.js`
- Admin dashboard for reviewing submissions and marking them as `verified`, `pending`, or `invalid`
- Real-time checker flow that sends scan events from a phone view to a desktop verifier through WebSockets
- 3D citizen relationship graph built with React Three Fiber and Drei
- Pre-seeded trust network database for citizens, occupations, documents, and connections
- Multi-view app routing for landing page, upload flow, admin dashboard, checker view, desktop verifier, and graph view
- Express-based API and static app hosting in a single project

## How It Works

1. A user opens `/upload`, enters identity details, and attaches supporting documents.
2. The app generates an NFC payload from the submitted identity data.
3. When Web NFC is available, the frontend writes that payload to an NFC card and sends the same submission to the backend.
4. The backend stores the new submission in `[database path]` and saves uploaded files under `uploads/`.
5. An admin opens `/admin` to review incoming submissions, inspect their details, and mark them as `verified`, `pending`, or `invalid`.
6. A checker device opens `/checker`, reads card data from the NFC payload, and sends a live scan event over WebSocket.
7. The desktop verifier at `/desktop` receives that scan, compares the scanned identity against reviewed submission records, and returns a live verdict back to the checker.
8. Investigators can open `/admin/graph` to inspect a reconstructed legacy trust graph loaded from `[database path]`.
9. The intended architecture is to consolidate these flows into a single database, but in the current project build the submission workflow and the recovered graph workflow still read from two separate databases while that bug remains unresolved.

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- WebSocket (`ws`)
- `sql.js`
- React Three Fiber
- Drei
- Three.js
- Tailwind CSS v4
- Multer

## Installation

### Prerequisites

- Node.js 18+ recommended
- npm

### Steps

```bash
npm install
```

## Usage

### Start the project

```bash
npm run dev
```

This starts:

- the Express server for APIs and WebSocket communication
- the Vite development server for the frontend

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Main routes

- `/` - landing page
- `/upload` - applicant upload and NFC write flow
- `/admin` - admin submissions dashboard
- `/desktop` - desktop verifier view
- `/checker` - phone checker view
- `/admin/graph` - 3D citizen relationship graph

## Project Structure

```text
gdgc-hackathon/
+-- data/
|   +-- data.py                # Seed script for verify_deny.db
|   +-- records.db             # Submission storage
|   `-- verify_deny.db         # Preloaded citizen and connection database
+-- preloaded_information/
|   +-- data.json
|   `-- nfc_readme.md
+-- public/
|   +-- favicon.svg
|   `-- icons/
+-- src/
|   +-- components/
|   |   `-- GraphTab.tsx
|   +-- lib/
|   |   `-- graphData.ts
|   +-- realtime/
|   |   +-- AdminGraphView.tsx
|   |   +-- AdminLayout.tsx
|   |   +-- AdminSubmissionOverview.tsx
|   |   +-- AdminView.tsx
|   |   +-- CitizensView.tsx
|   |   +-- DesktopAdminView.tsx
|   |   +-- RealtimeViews.tsx
|   |   `-- UploadView.tsx
|   +-- App.tsx
|   +-- App.css
|   +-- index.css
|   `-- main.tsx
+-- server.mjs                # Express API, uploads, graph API, WebSocket server
+-- package.json
`-- README.md
```

## Notes

- The project is designed as a prototype for a hackathon scenario, so some flows are intentionally narrative-driven and optimized for demo value.
- Web NFC support is limited and typically works best on Android Chrome-compatible devices.
- The seeded graph database is separate from the live upload submissions database.
