# Project Name：VERIFIED

A post-collapse identity verification prototype that uses NFC cards, local records, and human review to rebuild trust after all centralized digital records are lost.


## Overview

`VERIFIED` is a hackathon project set in a world where a solar flare has destroyed the digital systems. 

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

### Prerequisites

- Node.js 18+ recommended

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
|   +-- data.py                # Seed script for records.db
|   `-- records.db             # Unified citizen, submission, document, and connection database
+-- preloaded_information/
|   +-- data.json
|   `-- nfc_readme.md
+-- public/
|   +-- favicon.svg
|   +-- icons.svg
|   +-- icons/
|   `-- images/
+-- src/
|   +-- components/
|   |   `-- GraphTab.tsx
|   +-- lib/
|   |   `-- graphData.ts
|   +-- realtime/
|   |   +-- AdminGraphView.tsx
|   |   +-- AdminLayout.tsx
|   |   +-- AdminRealtimeView.tsx
|   |   +-- AdminSubmissionOverview.tsx
|   |   +-- AdminView.tsx
|   |   +-- CitizensView.tsx
|   |   +-- RealtimeViews.tsx
|   |   `-- UploadView.tsx
|   +-- App.tsx
|   +-- App.css
|   +-- index.css
|   `-- main.tsx
+-- uploads/                  # Uploaded applicant documents served by Express
+-- dist/                     # Production build output
+-- vite.config.ts            # Vite, React, Tailwind, and dev proxy config
+-- server.mjs                # Express API, uploads, graph API, WebSocket server
+-- package.json
`-- README.md
```

## How It Works

- Applicants use `/upload` to enter identity details, attach supporting documents, and generate a portable NFC identity payload.

- The Express backend stores the submission in the  `data/records.db` database and saves uploaded files under `uploads/`.

- The upload flow can write the applicant payload to an NFC card when Web NFC is available.

- Admins use `/admin` to inspect uploaded submissions.They can approve, deny, or delete records. Approval changes the citizen verification state in `records.db`;

- The realtime verifier is split across two views:

  `/admin/realtime`, `/admin/desktop`, or `/desktop` opens the desktop verification console.
  `/checker` opens the phone checker view.

- The phone checker scans or receives NFC JSON and sends the scan event through WebSocket. The desktop console receives the scan, reviews the matching record, and sends a verdict back to the checker in real time.

- Relationship graph

    `/admin/graph` renders a 3D relationship graph from the same `records.db` dataset.


- Realtime trust score


    The score is based on:

        50% relationship signals: connection count, total connection strength, and relationship diversity
        30% document completeness
        20% personal information completeness



## Notes

- The project is designed as a prototype for a hackathon scenario, so some flows are intentionally narrative-driven and optimized for demo value.
- Web NFC support is limited and typically works best on Android Chrome-compatible devices.
