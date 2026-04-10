import _blake2b from 'blake2b';
const blake2b = typeof _blake2b === 'function' ? _blake2b : (_blake2b as any).default || _blake2b;

export class RealityLimitAuth {
    private hardwareSeed: Uint8Array | null = null;

    constructor() { }

    public anchorToHardware(signatureData: string | Uint8Array) {
        if (typeof signatureData === 'string') {
            // Compress the actual hardware signature into a 32-byte pure info-theoretic mathematical seed
            const hash = blake2b(32);
            hash.update(new TextEncoder().encode(signatureData));
            this.hardwareSeed = hash.digest();
        } else {
            this.hardwareSeed = signatureData;
        }
    }

    private getMacKey(): Uint8Array {
        if (!this.hardwareSeed) {
            throw new Error("RealityLimit Fatal: Not anchored to hardware. You MUST call anchorToHardware() with a real silicon signature first. No simulations allowed.");
        }
        const hash = blake2b(32);
        hash.update(new TextEncoder().encode("RL_MAC_KEY_DERIVATION_REAL"));
        hash.update(this.hardwareSeed);
        return hash.digest();
    }

    private cwMac(key: Uint8Array, message: Uint8Array): Uint8Array {
        const hash = blake2b(32, key);
        hash.update(message);
        return hash.digest();
    }

    public createPacket(message: Uint8Array): Uint8Array {
        const macKey = this.getMacKey();
        const tag = this.cwMac(macKey, message);
        const packet = new Uint8Array(message.length + tag.length);
        packet.set(message);
        packet.set(tag, message.length);
        return packet;
    }

    public verifyPacket(packet: Uint8Array, expectedMessage: Uint8Array): boolean {
        if (packet.length < 32) return false;
        const tag = packet.slice(packet.length - 32);
        const msg = packet.slice(0, packet.length - 32);

        const macKey = this.getMacKey();
        const expectedTag = this.cwMac(macKey, msg);

        if (expectedTag.length !== tag.length) return false;
        let valid = true;
        for (let i = 0; i < tag.length; i++) {
            if (expectedTag[i] !== tag[i]) valid = false;
        }

        if (!valid) return false;

        if (msg.length !== expectedMessage.length) return false;
        for (let i = 0; i < msg.length; i++) {
            if (msg[i] !== expectedMessage[i]) return false;
        }

        return true;
    }
}
