// ============================================================================
// Standalone Hash Computation — Zero Dependencies
// ============================================================================
//
// Computes the SHA-256 hash of serialized Solana transaction message bytes.
// Uses the Web Crypto API (built into browsers and Node.js 16+).
// Returns the hash as a base58-encoded string (what hardware wallets display).
// ============================================================================

import { encode } from "./bs58";

/** SHA-256 hash using the Web Crypto API. */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

/**
 * Compute the message hash for a serialized Solana transaction message.
 * Returns the base58-encoded SHA-256 hash — this is what hardware wallets
 * display as "Message Hash" during blind signing.
 */
export async function hashRawMessage(
  messageBytes: Uint8Array
): Promise<string> {
  const hashBytes = await sha256(messageBytes);
  return encode(hashBytes);
}
