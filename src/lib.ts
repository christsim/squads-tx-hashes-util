// ============================================================================
// Squads Decoder — Standalone Library Entry Point
// ============================================================================
//
// Zero dependencies. Works in browsers and Node.js 16+.
// https://github.com/christsim/squads-tx-hashes-util
// MIT License — USE AT YOUR OWN RISK
//
// Usage:
//   import { decodeMessage, hashRawMessage, hexToBytes } from './squads-decoder.js';
//
//   const bytes = hexToBytes('80010002...');
//   const decoded = decodeMessage(bytes);
//   const hash = await hashRawMessage(bytes);
// ============================================================================

// Base58 encode/decode
export { encode as bs58Encode, decode as bs58Decode } from "./bs58";

// Message decoder
export {
  decodeMessage,
  generateTransactionSummary,
  hexToBytes,
  base64ToBytes,
  type DecodedMessage,
  type DecodedInstruction,
  type DecodedInnerInstruction,
  type DecodedAccount,
  type DecodedAddressTableLookup,
  type TransactionSummary,
  type ActionSummary,
  type InstructionSafety,
  type Warning,
} from "./decoder";

// Hash computation
export { hashRawMessage } from "./hash-standalone";

// Constants and lookups
export {
  bytesToHex,
  KNOWN_TOKENS,
  KNOWN_PROGRAMS,
  getTokenInfo,
  getProgramLabel,
  type TokenInfo,
} from "./constants";
