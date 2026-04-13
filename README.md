# RealityLimit Auth — Web Demo

> A fully working Next.js 15 reference implementation of the RealityLimit Transaction Authorization Protocol.

---

## What This Is

This is the **reference application** — not the SDK. It demonstrates exactly how to integrate `@realitylimit/core` into a real Next.js banking application.

It includes a complete flow:
- **Register** a hardware authenticator (FaceID / Windows Hello) — no passwords
- **Login** with physical biometric — hardware-verified session
- **Wire Transfer** — every transaction requires a fresh biometric hardware signature before execution

---

## How It Relates to the SDK

```
@realitylimit/core          ← The NPM package (the math)
        ↓
example/web-demo            ← This app (shows how to USE the math)
  ├── app/api/auth/         ← Your database + WebAuthn registration/login routes
  ├── app/api/protected/    ← Transaction authorization routes (the novel pattern)
  ├── lib/db.ts             ← MongoDB connection
  └── lib/models.ts         ← User + Challenge schema
```

Everything inside `lib/` and `app/api/` is **your application code**. You own it. The SDK (`@realitylimit/core`) powers the cryptographic verification with 3 function calls.

---

## Setup

### 1. Copy the environment file

```bash
cp .env.example .env
```

Edit `.env`:
```env
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/realitylimit
```

> **Required:** MongoDB must be running locally. Install from [mongodb.com](https://www.mongodb.com/try/download/community) or use a free Atlas cluster.

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** WebAuthn only works on `https://` or `http://localhost`. It will not work on a plain IP address or non-secure origin.

---

## API Route Map

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register/options` | POST | Generate WebAuthn registration challenge |
| `/api/auth/register/verify` | POST | Verify and store the new hardware credential |
| `/api/auth/login/options` | POST | Generate WebAuthn login challenge |
| `/api/auth/login/verify` | POST | Verify hardware signature and establish session |
| `/api/protected/options` | POST | Generate transaction challenge bound to an intent |
| `/api/protected/verify` | POST | Verify hardware signature and execute stored intent |

---

## SDK Usage in This App

### Backend — `@realitylimit/core/server`
```typescript
import { createTransactionOptions, verifyTransactionExecution } from '@realitylimit/core/server';

// Generate a FIDO challenge tied to an intent
const { options, expectedChallenge } = await createTransactionOptions(rpID, intent, userCredentials);

// Verify the physical silicon signature
const result = await verifyTransactionExecution(rpID, origin, attResp, challenge, credential);
```

### Frontend — `@realitylimit/core/browser`
```typescript
import { executeProtectedAction } from '@realitylimit/core/browser';

// Trigger the OS hardware prompt (FaceID / Windows Hello)
const attResp = await executeProtectedAction(fidoOptions);
```

---

## Security Boundary

This demo implements the full RealityLimit security model. For the complete attack scenario analysis, see:

- [`../../docs/transaction-flow-and-security.md`](../../docs/transaction-flow-and-security.md)
- [`../../SECURITY.md`](../../SECURITY.md)

---

## What Is Not in This Demo (v1.0.0 Gaps)

- No second-device registration UI *(schema supports multiple devices; UI not built)*
- No account recovery flow *(planned for v1.1.0)*
- No device de-registration endpoint *(planned for v1.1.0)*
- Balance is per-user only *(no real recipient balance update — demo scope)*

See [`../../spec/CHANGELOG.md`](../../spec/CHANGELOG.md) for the full roadmap.

---

## License
MIT
