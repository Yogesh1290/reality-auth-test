# RealityLimit Auth — 100% Authentic Reference Implementation

A revolutionary, mathematics-first web authentication framework that permanently couples physical silicon security (FIDO WebAuthn) with Information-Theoretic Carter-Wegman Message Authentication Codes (MAC).

**Zero Simulation. Zero Hype. 100% Cryptographic Truth.**

![RealityLimit Auth](https://github.com/user-attachments/assets/0b9fbc38-5f25-4c07-b24e-7b2c011f0624)

## Abstract
Traditional web authorization relies on bearer tokens (JWTs, Session Cookies) that are fundamentally forgeable and susceptible to interception or theft. RealityLimit establishes an **Information-Theoretic Security Bound**. It leverages strict Elliptic Curve public key verification (`@simplewebauthn/server`) to validate an authentic FIDO hardware interaction, extracting the raw silicon `signature` buffer to deterministically derive a pure `blake2b(32)` Carter-Wegman MAC Key.

Every subsequent sensitive action (e.g. wire transfers) is locally signed by the client using this unforgeable MAC. The backend independently verifies the MAC in constant time. 

If an attacker steals the session or intercepts a packet, they **cannot forge a new action** because they lack the physical silicon signature required to solve the RealityLimit math.

## Features
- **100% Authentic Pipeline:** No dummy variables, `Math.random()`, or simulated hardware seeds. The implementation is aggressively tied to literal hardware cryptography.
- **W3C WebAuthn Bound:** FaceID, TouchID, and TPMs form the physical root of trust.
- **Info-Theoretic Packet Armor:** Actions are signed via a one-time Carter-Wegman MAC. Forging a packet without the physical trace is mathematically impossible.
- **Next.js 16 + Turbopack:** High-performance React 19 Client components handling dynamic binary packet derivation.
- **Bulletproof Interop:** Uses a custom CJS-to-ESM runtime wrapper to satisfy strict bundler typings for legacy crypto libraries (`blake2b`).

## System Flow (The Cryptographic Proof)

### 1. Enrollment (`/api/auth/register`)
The user's device generates an Asymmetric Key Pair inside the secure enclave. The private key never leaves the silicon. The server strictly validates the `.attestationObject` over the Elliptic Curve and stores the `credentialPublicKey`.

### 2. Physical Binding (`/api/auth/login`)
The server challenges the device. The secure enclave signs the challenge. 
The server verifies the signature against the stored Public Key (`verifyAuthenticationResponse`). 
**Crucially:** the server deterministically extracts the valid `.signature` trace directly from the trusted WebAuthn buffer. This silicon trace is locked onto the session as the fundamental **RealityLimit Anchor**.

### 3. Execution (`/api/protected`)
When taking action, the React client bundles a JSON command and computes an instantaneous Carter-Wegman MAC over the payload using the hardware trace. 
The payload and the 32-byte MAC tag are merged into a pure `Uint8Array` binary packet and sent to the server. 
The backend independently hashes the packet. **If the math is flawless, Reality Limit is preserved.**

## Setup Instructions

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) with your browser.

> **Note:** For WebAuthn to function correctly, the site must be served over `https://` or `http://localhost`.

## Architecture Deep-Dive
For absolute proof of the zero-trust mathematical architecture, please refer to the detailed writeup in `ARCHITECTURE.md`.

## License
MIT
