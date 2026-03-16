// ============================================================================
// Base58 Encode / Decode — Pure JavaScript, Zero Dependencies
// ============================================================================
//
// Standard base58 encoding used by Bitcoin and Solana.
// Uses BigInt arithmetic for arbitrary precision.
// ============================================================================

const ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);
const ALPHABET_MAP = new Map<string, bigint>(
  ALPHABET.split("").map((c, i) => [c, BigInt(i)])
);

/** Encode a byte array to a base58 string. */
export function encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  // Count leading zero bytes (they become '1' characters)
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  // Convert bytes to a single BigInt
  let num = BigInt(0);
  for (const b of bytes) {
    num = num * 256n + BigInt(b);
  }

  // Convert BigInt to base58 digits
  let str = "";
  while (num > 0n) {
    str = ALPHABET[Number(num % BASE)] + str;
    num = num / BASE;
  }

  // Prepend '1' for each leading zero byte
  return "1".repeat(zeros) + str;
}

/** Decode a base58 string to a byte array. */
export function decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Count leading '1' characters (they become zero bytes)
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;

  // Convert base58 digits to a single BigInt
  let num = BigInt(0);
  for (const c of str) {
    const val = ALPHABET_MAP.get(c);
    if (val === undefined) {
      throw new Error(`Invalid base58 character: "${c}"`);
    }
    num = num * BASE + val;
  }

  // Convert BigInt to bytes
  const hex = num === 0n ? "" : num.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const byteLen = padded.length / 2;
  const result = new Uint8Array(zeros + byteLen);
  for (let i = 0; i < byteLen; i++) {
    result[zeros + i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }

  return result;
}
