# RealityLimit Auth — Security Audit Documentation

**Target Domain:** `https://reality-auth-test.vercel.app`
**Architecture:** Zero-Token, FIDO2/WebAuthn Hardware Bound Protocol
**Database:** MongoDB Atlas

This document outlines the complete API surface area, architectural security mechanisms, and a theoretical threat model for the RealityLimit Protocol. It is designed specifically for white-hat Penetration Testers and security auditors.

---

## 🔒 The Zero-Trust Architecture Rules
1. **No Cookies / No JWTs**: This system is entirely stateless. We do not use Session Cookies, JWT Bearer Tokens, or local storage.
2. **Hardware Piggybacking**: We do not possess standalone read-only endpoints (e.g., no `GET /balance`). Sensitive data is exclusively returned as a "piggybacked" payload strictly during the exact millisecond a hardware biometric signature succeeds.
3. **Intent-Bound Challenges**: FIDO challenges are strictly mapped to the action (e.g., "add-device", "wire-transfer $500"). Replay attacks are mathematically prevented because challenges are consumed upon completion and tied to specific payloads.

---

## 📡 Protected API Surface (Hardware Verification Required)

### 1. High-Value Transaction (Wire Transfer)
**Options Endpoint:** `POST /api/protected/options`
- **Payload:** `{ userId: string, intent: { amount: string, toAddress: string } }`

**Execution Endpoint:** `POST /api/protected/verify`
- **Payload:** `{ userId: string, attResp: AuthenticationCredential }`

### 2. Dashboard Login (Read-Only Data Retrieval)
**Options Endpoint:** `POST /api/auth/login/options`
**Execution Endpoint:** `POST /api/auth/login/verify`

### 3. Add a Cross-Device Passkey
**Options Endpoint:** `POST /api/auth/devices/add/options`
**Execution Endpoint:** `POST /api/auth/devices/add/verify`

### 4. Remove a Device
**Execution Endpoint:** `DELETE /api/auth/devices/remove`

### 5. Generate Account Recovery Code
**Execution Endpoint:** `POST /api/auth/recovery/generate/verify`

---

## 🗄️ Database Schemas (MongoDB)

### **User Collection**
```javascript
{
  userId: String (Unique),
  balance: Number (Default 125000),
  recoveryCodeHash: String (SHA-256),
  credentials: [
    {
      credentialID: String,
      credentialPublicKey: Buffer (Core Math Key),
      counter: Number (Replay Prevention),
      transports: [String],
      deviceName: String
    }
  ]
}
```

### **Challenge Collection** (Volatility)
```javascript
{
  userId: String,
  challenge: String (Base64URL FIDO Challenge),
  intent: String (JSON Payload - E.g. {"amount": "500"}),
  createdAt: Date (Expires strictly in 300 seconds)
}
```

---

## 🛡️ Penetration Testing Threat Model (Theoretical Attack Vectors)

Auditors should attempt the following theoretical attack vectors to validate the system's defenses. 

### 1. Broken Object Level Authorization (BOLA / IDOR)
*   **The Concept:** BOLA occurs when an application exposes a reference to an internal object (like a user `balance`) and fails to verify if the requesting user is authorized to access it. An attacker changes a parameter like `?userId=user1` to `?userId=admin`.
*   **Audit Objective:** Attempt to fetch the balance or device list without triggering the FIDO prompt.
*   **Mitigation Strategy:** RealityLimit mitigates this via **Hardware Piggybacking**. Standalone read endpoints do not exist. Data is only attached to the successful cryptographic response of `/api/auth/login/verify`. 

### 2. Replay Attacks
*   **The Concept:** An attacker intercepts a legitimate, signed network payload (e.g., a wire transfer approval) and resends it later to duplicate the action.
*   **Audit Objective:** Capture the `attResp` payload during a login or wire transfer using Burp Suite. Attempt to resend the exact same JSON payload 60 seconds later.
*   **Mitigation Strategy:** RealityLimit uses cryptographic challenges (nonces). The server generates a unique `challenge` stored in MongoDB. The hardware enclave signs this specific challenge. Upon verification, the `Challenge.deleteOne()` method destroys the nonce. A replay attempt fails because the server expects a new challenge that no longer exists in the DB.

### 3. Cross-Site Scripting (XSS) & Session Hijacking
*   **The Concept:** Injecting malicious JavaScript into the application to steal session cookies, LocalStorage tokens, or JWTs. 
*   **Audit Objective:** Assume full XSS execution exists on the client. Attempt to extract a token that grants persistent read/write access.
*   **Mitigation Strategy:** The architecture is entirely stateless. There are no cookies or tokens to steal. An XSS payload can only read what is currently in volatile memory, but it cannot initiate a wire transfer because it cannot physically trigger the OS FaceID prompt to sign the required challenge.

### 4. Adversary-in-the-Middle (AiTM) / Phishing
*   **The Concept:** An attacker creates a fake domain (`reality-auth-phish.com`) that proxies requests to the real server, tricking the user into logging in.
*   **Audit Objective:** Simulate a proxy environment with a different origin domain and attempt to pass the WebAuthn challenge.
*   **Mitigation Strategy:** The FIDO protocol mathematically binds the signature to the `rpID` (Relying Party ID) and `Origin`. If the browser is on `reality-auth-phish.com`, the hardware enclave signs that specific domain. When the server (expecting `reality-auth-test.vercel.app`) verifies the signature, the cryptographic math will reject it entirely.

### 5. Intent Spoofing (Transaction Forgery)
*   **The Concept:** Authenticating for one action, but having the server execute a different action.
*   **Audit Objective:** Initiate a login challenge, but attempt to pass the resulting `attResp` into the `/api/protected/verify` (wire transfer) endpoint.
*   **Mitigation Strategy:** The `Challenge` document in MongoDB includes an `intent` field. The verification endpoint strictly checks that the challenge being signed was meant for a wire transfer, not a generic login.

---

## 🛠️ Step-by-Step Beginner Hacking Guide

If you are new to Penetration Testing, follow these exact steps to attempt to bypass the RealityLimit architecture. You will primarily use **Burp Suite Community Edition** or your browser's built-in **Network Tab (F12)**.

### Test 1: BOLA / Data Exfiltration (The "Ghost GET" Attack)
*Target: Try to view someone else's balance without FaceID.*
1. Open the Developer Tools in your browser (F12) and go to the **Console** tab.
2. We know the database requires a `userId`. Let's assume you know someone's username is `user1`. 
3. Type this into the console and hit Enter:
   ```javascript
   fetch('/api/auth/balance?userId=user1').then(r => r.text()).then(console.log)
   ```
4. **Expected Result:** The server will return a `404 Not Found`. You cannot bypass the hardware because the standalone endpoint literally does not exist. 

### Test 2: The Replay Attack (Stealing the JSON)
*Target: Try to duplicate a wire-transfer by resending the exact same network packet.*
1. Download and start **Burp Suite Community Edition**. Configure your browser to proxy traffic through Burp (127.0.0.1:8080).
2. Go to the web app, login, and initiate a Wire Transfer for `$1`.
3. When FaceID pops up, scan your face.
4. Go into Burp Suite -> **Proxy** -> **HTTP history**. Find the `POST /api/protected/verify` request. 
5. Click on the request and hit `Ctrl+R` (Send to Repeater).
6. The request contains the massive JSON `attResp` (Authentication Response) signed by your iPhone. The server accepted this and deducted $1.
7. Go to the Repeater tab and click **Send** to replay the exact same request.
8. **Expected Result:** You will get a `400 Bad Request` or `401 Unauthorized` with the error `"Transaction challenge expired or missing"`. Why? Because the `challenge` nonce inside the JSON was destroyed in MongoDB the moment the first transfer succeeded. 

### Test 3: Intent Spoofing (The "Bait and Switch")
*Target: Try to use a "Login" signature to steal money.*
1. Keep Burp Suite open.
2. Go to the app and click **Login**. 
3. Scan your FaceID.
4. In Burp Suite, find the `POST /api/auth/login/verify` request. Copy the entire JSON body (which contains the `attResp` signature).
5. Now, go to Burp Suite Repeater. Change the URL at the top to `POST /api/protected/verify` (the Wire Transfer endpoint).
6. Paste the Login JSON body into this request and hit **Send**.
7. **Expected Result:** The server will reject it with `"Transaction challenge expired or missing"`. Even though the signature is mathematically valid, the database knows that the specific challenge you signed was bound to a "login" intent, but you are trying to submit it to a "wire-transfer" endpoint! 

### Test 4: XSS Token Theft (The Volatile Memory Trap)
*Target: Try to steal a session cookie.*
1. Open Chrome DevTools (F12) -> **Application** Tab.
2. Look under "Local Storage", "Session Storage", and "Cookies".
3. **Expected Result:** It is completely empty. There is absolutely nothing for your XSS script to steal. If you refresh the page, the volatile React memory vanishes, and the app forces you to scan FaceID again.

### Test 5: Mass Enumeration / DB Scraping (The "Wildcard" Attack)
*Target: Try to list every registered user or device in the database.*
1. Open the Developer Tools console (F12).
2. Many poorly designed APIs contain endpoints like `/api/users` or `/api/auth/devices/list` that dump data. Type this:
   ```javascript
   fetch('/api/auth/devices/list').then(r => r.text()).then(console.log)
   ```
3. Or try a NoSQL Injection trick on the login endpoint by passing `{ userId: { "$ne": null } }` instead of a string:
   ```javascript
   fetch('/api/auth/login/options', {
       method: 'POST',
       body: JSON.stringify({ userId: { "$ne": null } })
   }).then(r => r.text()).then(console.log)
   ```
4. **Expected Result:** The `list` endpoint throws a `404 Not Found` because we physically deleted it from the server (Hardware Piggybacking rules!). The NoSQL injection trick fails because the backend strictly compares `userId` as a mapped string for the hardware challenge, crashing any object-based queries. You cannot extract lists of users!
