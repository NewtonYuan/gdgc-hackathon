# VERIFY//DENY

> “When records die, trust becomes law.”

A narrative deduction game inspired by _Papers, Please_ set in a post-blackout society where all digital records have been corrupted.

---

## Premise

A catastrophic blackout has destroyed most centralized digital infrastructure.

Governments collapsed overnight.  
Hospitals lost patient records.  
Identity systems vanished.  
Employment databases became corrupted.

You are one of the last remaining **Digital Records Officers** operating a partially recovered government terminal.

People arrive one by one claiming:

- identities
- professions
- access rights
- ownership
- authority

Using fragmented records and previous testimonies, you must decide:

## VERIFY or DENY

---

## Core Gameplay Loop

1. Read surviving database fragments
2. Analyze the NPC’s claim
3. Compare contradictions and evidence
4. Choose:
   - ✅ VERIFY
   - ❌ DENY
5. Gain new information if correct
6. Use that information for future decisions

Each verified person expands the surviving database.

Each mistake destabilizes society further.

---

## Features

- Sequential deduction gameplay
- Branching information chains
- Corrupted database system
- Escalating ambiguity
- Narrative consequences
- Retro CRT-inspired interface
- Black + dark red dystopian aesthetic

---

## Example Scenario

### Database Snapshot

| Name        | Role     | District | Status    |
| ----------- | -------- | -------- | --------- |
| Sarah Chen  | Nurse    | Sector 4 | Verified  |
| Marcus Hale | Engineer | Sector 2 | Missing   |
| Lina Torres | Security | ???      | Corrupted |

---

### Incoming NPC

> “I’m Marcus Hale. Power engineer from Sector 2.”

The player must determine:

- Does the database support this?
- Are there contradictions?
- Is he trustworthy?

---

## Visual Direction

The game uses:

- black backgrounds
- dark red highlights
- CRT terminal effects
- corrupted UI elements
- glitch overlays
- low-light dystopian styling

Inspired by:

- _Papers, Please_
- _Do Not Feed the Monkeys_
- _Beholder_
- retro government terminals

---

## Tech Stack

- React
- TypeScript
- Tailwind CSS
- Vite

---

## Team Goal

Build a short but highly immersive narrative deduction experience suitable for a 4-minute hackathon presentation.

The focus is:

- atmosphere
- tension
- deduction
- player trust decisions

---

## Theme Alignment

The game explores:

- Identity without records
- Trust without institutions
- Society after digital collapse
- Human verification replacing centralized systems

---

## Running Locally

```bash
npm install
npm run dev
```

---

## Styling Notes

Primary palette:

- Background: near-black
- Accent: dark crimson red
- Text: muted gray
- Warning states: bright red

Recommended Tailwind tones:

- `bg-zinc-950`
- `bg-black`
- `text-zinc-300`
- `text-red-700`
- `border-red-900`

---

## Tagline

> “The database remembers fragments.  
> You decide what survives.”
