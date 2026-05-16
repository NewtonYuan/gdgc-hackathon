# VERIFY//DENY — NFC Identity Card System

## Project Context

This is a hackathon project for the **Solar Flare Digital Apocalypse** theme. A catastrophic solar flare has destroyed all centralized digital infrastructure — servers, databases, identity systems. Society must rebuild trust and verification from scratch.

Our solution is a **pre-disaster NFC identity card** (think: government-issued before the blackout) that stores a citizen's identity *cryptographically signed on the card itself*. Because the data and signature live on the physical card, identity remains verifiable even when every server in the world is dead.

The game **VERIFY//DENY** is the demo wrapper: a *Papers, Please*-style deduction game where the player is a Digital Records Officer at a recovered government terminal. People arrive presenting their NFC cards. The officer must decide whether to verify or deny each one based on the card's signed data, surviving database fragments, and web-of-trust connections to already-verified citizens.

The pitch in one line: **"The card is the record."**

---

## What This File Is For

This document gives Claude Code enough context to help build:

1. The **JSON payload schema** encoded on each NFC tag
2. The **signing logic** (pre-hackathon: generate signed citizen payloads)
3. The **verification logic** (in the React app: parse payloads, verify signatures, surface vouchers)
4. The **integration** between the Pico/PN532 NFC reader and the React frontend

---

## Hardware Setup

- **Raspberry Pi Pico** running CircuitPython
- **PN532 NFC module** wired to the Pico via I2C or SPI
- **NTAG215 NFC tags** (504 bytes user memory) — one per citizen
- Pico sends tag payloads to the host computer over **USB serial**
- React app reads serial via **Web Serial API**
- Two designated NFC tags act as **VERIFY** and **DENY** stamps for verdicts

---

## NFC Payload Schema

Each citizen's NFC tag contains a JSON blob with their signed identity data. Field names are abbreviated to fit within the 504-byte NTAG215 limit (after NDEF overhead, ~480 bytes usable).

### Schema

```json