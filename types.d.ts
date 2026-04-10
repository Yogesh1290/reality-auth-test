declare module 'blake2b' {
    export default function blake2b(outlen: number, key?: Uint8Array | null, salt?: Uint8Array | null, personal?: Uint8Array | null): any;
}
