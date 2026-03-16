/**
 * Compute the message hash for a serialized Solana transaction message.
 * Returns the base58-encoded SHA-256 hash — this is what hardware wallets
 * display as "Message Hash" during blind signing.
 */
export declare function hashRawMessage(messageBytes: Uint8Array): Promise<string>;
