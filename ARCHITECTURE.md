# RealityLimit Architecture: A Paradigm Shift in Web Authentication

## Introduction
The current standard for authenticated web application sessions relies almost entirely on bearer tokens (JWTs) or opaque session cookies. While transport layer security (TLS) protects these tokens in transit, their fundamental architecture is passive. If an attacker extracts a JWT from a browser via XSS, or captures a session cookie via a reverse proxy phishing attack (AiTM), the server cannot mathematically differentiate the attacker from the legitimate user. 

**RealityLimit Auth** introduces an architecture where the authentication state is actively, computationally bound to a physical root of trust on a per-packet basis, achieving an Information-Theoretic security bound against forgery.

## The Core Concept: Information-Theoretic Hardware Anchoring

RealityLimit completely abandons passive bearer token authorization for sensitive state mutations. Instead, it utilizes **W3C WebAuthn** not just for initial login, but as the fundamental cryptographic seed for a **Carter-Wegman Message Authentication Code (MAC)**.

### Phase 1: Elliptic Curve Validation (The Physical Anchor)
When a user authenticates via WebAuthn, their device's Secure Enclave (Apple) or TPM (Windows) generates an ECDSA or EdDSA signature over a server-provided challenge.

In a standard system, the server verifies this signature and issues a JWT. 
In RealityLimit, the server verifies the signature, and then **extracts the raw binary signature buffer** itself. This signature is completely unique to the combination of that specific user's physical hardware key, the timestamp, and the origin.

This binary sequence is mathematically deterministic and practically unforgeable without physical possession of the silicon. It becomes the **Hardware Anchor**.

### Phase 2: Key Derivation (blake2b)
The server and the React client both take this Hardware Anchor and feed it into a highly optimized hashing algorithm (`blake2b` configured for 32-byte output) accompanied by a derivation string. 

Because both the client and the server have access to the exact silicon trace (the client generated it, the server received and verified it), they both arrive at identical 32-byte Info-Theoretic MAC Keys in constant time, with zero network transmission of the key itself.

### Phase 3: The Carter-Wegman Protocol
When the client wishes to execute a sensitive action (e.g., a wire transfer):
1. **Payload Generation:** The application defines a tight JSON payload string.
2. **Binary Conversion:** The string is encoded to a `Uint8Array`.
3. **MAC Computation:** The `blake2b` function hashes the payload using the 32-byte Hardware derived MAC key.
4. **Packet Assembly:** The client appends the 32-byte MAC tag directly to the end of the payload array.

### Phase 4: Constant-Time Backend Verification
When the backend receives the `application/octet-stream` binary packet:
1. It slices the final 32 bytes off as the `Tag` and treats the remainder as the `Message`.
2. It fetches the validated Hardware Anchor for the session.
3. It derives the MAC Key.
4. It hashes the `Message` using the key to generate the `expectedTag`.
5. It executes a constant-time byte-by-byte comparison between the `Tag` and the `expectedTag`.

## The Cryptographic Impossibility of Forgery
If an attacker steals a user's session cookie, they can navigate the site. But the moment they attempt to execute a protected mutation (submitting the transfer form), they must sign the binary packet. 

Because the attacker's browser did not perform the physical WebAuthn ritual, their memory does not contain the `hardwareSignature`. They cannot derive the MAC key. Any packet they attempt to construct and send to the server will mathematically fail against the server's Carter-Wegman verification loop.

XSS, network sniffing, and AiTM proxy attacks are neutralized at the mathematical layer.

## Conclusion
RealityLimit represents the bleeding edge of zero-trust web topologies. By seamlessly merging the asymmetric power of WebAuthn with the symmetrical blinding speed of Carter-Wegman MACs, we permanently collapse the possibility of bearer-token spoofing.
