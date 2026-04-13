# RealityLimit Auth — Web Demo

> A fully working Next.js reference implementation of the RealityLimit Transaction Authorization Protocol.

---

> **👉 Looking for the SDK or the full protocol spec?**
>
> | Resource | Link |
> |---|---|
> | 🔐 **Main SDK & Protocol** | [github.com/Yogesh1290/RealityLimit-Auth](https://github.com/Yogesh1290/RealityLimit-Auth) |
> | 📦 **NPM Package** | [@realitylimit/core on npmjs.com](https://www.npmjs.com/package/@realitylimit/core) |
> | 🌐 **Live Demo** | [reality-auth-test.vercel.app](https://reality-auth-test.vercel.app) |
>
> This repo is the **example app only**. The main repo contains the SDK source, protocol spec, and documentation.

---

## What This Is

This is the **reference application** — not the SDK. It demonstrates exactly how to integrate `@realitylimit/core` into a real Next.js banking application.

It includes a complete flow:
- **Register** a hardware authenticator (FaceID / Windows Hello) — no passwords
- **Login** with physical biometric — hardware-verified session
- **Wire Transfer** — every transaction requires a fresh biometric hardware signature before execution
- **Multi-Device** — register multiple hardware keys per account
- **Account Recovery** — recover access using a pre-generated recovery code

---

## How It Relates to the SDK

```
@realitylimit/core            ← The NPM package (the cryptographic protocol)
        ↓
example/web-demo              ← This app (shows how to USE the protocol)
  ├── app/api/auth/           ← WebAuthn registration/login routes
  ├── app/api/protected/      ← Transaction authorization routes (the novel pattern)
  ├── app/api/auth/devices/   ← Multi-device management routes
  ├── app/api/auth/recovery/  ← Account recovery routes
  ├── lib/db.ts               ← MongoDB connection
  └── lib/models.ts           ← User + Challenge schema
```

Everything inside `lib/` and `app/api/` is **your application code**. The SDK powers the cryptographic verification with 3 function calls.

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
MONGODB_URI=mongodb+srv://...your-atlas-connection-string...
```

> **Required:** MongoDB Atlas free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** WebAuthn only works on `https://` or `http://localhost`.

---

## API Route Map

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/register/options` | POST | Generate WebAuthn registration challenge |
| `/api/auth/register/verify` | POST | Verify and store the new hardware credential |
| `/api/auth/login/options` | POST | Generate WebAuthn login challenge |
| `/api/auth/login/verify` | POST | Verify hardware signature and grant access |
| `/api/auth/devices/list` | GET | List all registered hardware devices |
| `/api/auth/devices/add/options` | POST | Generate challenge to add a new device |
| `/api/auth/devices/add/verify` | POST | Verify and register the new device |
| `/api/auth/devices/remove` | DELETE | Remove a registered device |
| `/api/auth/recovery/generate` | POST | Generate and store a recovery code |
| `/api/auth/recovery/verify` | POST | Verify recovery code and register new device |
| `/api/auth/balance` | GET | Fetch current user balance from DB |
| `/api/protected/options` | POST | Generate transaction challenge bound to an intent |
| `/api/protected/verify` | POST | Verify hardware signature and execute stored intent |

---

## SDK Usage

### Backend — `@realitylimit/core/server`
```typescript
import { verifyTransactionExecution } from '@realitylimit/core/server';

const result = await verifyTransactionExecution(rpID, origin, attResp, challenge, credential);
```

### Frontend — `@realitylimit/core/browser`
```typescript
import { executeProtectedAction } from '@realitylimit/core/browser';

// Triggers FaceID / Windows Hello on the user's device
const attResp = await executeProtectedAction(fidoOptions);
```

---

## Security Boundary

- Every transaction requires a **fresh FIDO2 hardware signature** — sessions and cookies authorize nothing
- Challenges are **single-use** and expire in 5 minutes
- The transaction intent is **server-stored** before the hardware prompt fires — client cannot tamper with amount or recipient
- Balance is **deducted server-side** only after hardware signature verification passes
- Recovery codes are **SHA-256 hashed** — never stored in plaintext

---

## License

Apache-2.0 © 2026 [Yogesh Singh](https://github.com/Yogesh1290)

See [LICENSE](./LICENSE) for full terms.
