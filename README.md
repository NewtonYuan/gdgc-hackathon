# Project Name：VERIFY

A post-collapse identity verification prototype that uses NFC cards, local records, and human review to rebuild trust after all centralized digital records are lost.


## Overview

`VERIFY` is a hackathon project set in a world where a solar flare has destroyed the digital systems. 

To solve the collapse of trust after centralized identity systems failed, the project explores a human-centered verification workflow.

- citizens submit identity details and supporting documents
- the system writes a portable NFC identity payload
- admins review submissions and assign a decision
- a checker device scans the card and receives a live verification result
- a relationship graph helps operators inspect trust signals inside the recovered citizen dataset

It normally proves identity, ownership, and authority.


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
npm run dev
```

This starts:

- the Express server for APIs and WebSocket communication
- the Vite development server for the frontend

### *Build for production

```bash
npm run build
```

### *Preview the production build

```bash
npm run preview
```

### Main routes

- `/` - landing page
- `/upload` - applicant upload and NFC write flow
- `/admin` - admin submissions dashboard
- `/desktop` - desktop verifier view
- `/checker` - phone checker view
- `/admin/graph` - 3D verified citizen relationship graph

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

## How It Work


## Notes

- The project is designed as a prototype for a hackathon scenario, so some flows are intentionally narrative-driven and optimized for demo value.
- Web NFC support is limited and typically works best on Android Chrome-compatible devices.

