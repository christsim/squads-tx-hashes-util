// ============================================================================
// Squads TX Hashes - Hash Computation
// ============================================================================
//
// Reconstructs the exact Solana V0 transaction message for proposal_approve
// or proposal_reject, then SHA-256 hashes and base58-encodes it.
//
// This is what the Ledger displays as "Message Hash" during blind signing.
//
// Trust-minimized: we serialize the message byte-by-byte with no SDK
// dependency for the serialization itself.
// ============================================================================

import { PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { encode as bs58Encode, decode as bs58Decode } from "./bs58";
import {
  SQUADS_PROGRAM_ID,
  DISCRIMINATOR_PROPOSAL_APPROVE,
  DISCRIMINATOR_PROPOSAL_REJECT,
  bytesToHex,
} from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoteOperation = "approve" | "reject";

export interface ProposalVoteMessageParams {
  operation: VoteOperation;
  memberPubkey: string;
  multisigPda: string;
  transactionIndex: bigint;
  recentBlockhash: string;
  memo?: string;
  feePayer?: string;
  computeUnitLimit?: number;
  computeUnitPrice?: number;
}

export interface HashResult {
  hash: string; // base58-encoded SHA-256 — what the Ledger shows
  messageBytes: Uint8Array; // raw serialized V0 message
  messageHex: string; // hex for debugging
  messageSize: number;
  proposalPda: string; // derived proposal PDA (base58)
  operation: VoteOperation;
}

// ---------------------------------------------------------------------------
// Low-level Helpers
// ---------------------------------------------------------------------------

/** Encode a number as Solana's compact-u16 (1-3 bytes). */
function encodeCompactU16(value: number): Uint8Array {
  if (value < 0 || value > 0xffff) {
    throw new Error(`compact-u16 value out of range: ${value}`);
  }

  if (value < 0x80) {
    return new Uint8Array([value]);
  } else if (value < 0x4000) {
    return new Uint8Array([(value & 0x7f) | 0x80, (value >> 7) & 0xff]);
  } else {
    return new Uint8Array([
      (value & 0x7f) | 0x80,
      ((value >> 7) & 0x7f) | 0x80,
      (value >> 14) & 0xff,
    ]);
  }
}

/** Concatenate multiple Uint8Arrays. */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/** SHA-256 hash using Web Crypto API. */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // Copy to a plain ArrayBuffer to satisfy TypeScript's strict BufferSource typing
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(hashBuffer);
}

// ---------------------------------------------------------------------------
// Instruction Data Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize the instruction data for proposal_approve or proposal_reject.
 *
 * Layout:
 *   - 8 bytes: instruction discriminator
 *   - COption<utf8String>: memo
 *     - No memo: 1 byte (0x00)
 *     - With memo: 1 byte (0x01) + 4 bytes LE string length + UTF-8 bytes
 */
function serializeProposalVoteData(
  discriminator: Uint8Array,
  memo?: string
): Uint8Array {
  if (!memo || memo.length === 0) {
    // No memo: discriminator + COption::None (0x00)
    return concatBytes(discriminator, new Uint8Array([0]));
  }

  // With memo: discriminator + COption::Some + u32_le(len) + utf8 bytes
  const memoBytes = new TextEncoder().encode(memo);
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, memoBytes.length, true);

  return concatBytes(
    discriminator,
    new Uint8Array([1]), // COption::Some
    lenBytes,
    memoBytes
  );
}

// ---------------------------------------------------------------------------
// Compute Budget Instruction Serialization
// ---------------------------------------------------------------------------

const COMPUTE_BUDGET_PROGRAM_ID =
  "ComputeBudget111111111111111111111111111111";

/** SetComputeUnitLimit: discriminator 0x02 + u32_le(units) = 5 bytes */
function serializeSetComputeUnitLimit(units: number): Uint8Array {
  const data = new Uint8Array(5);
  data[0] = 0x02;
  new DataView(data.buffer).setUint32(1, units, true);
  return data;
}

/** SetComputeUnitPrice: discriminator 0x03 + u64_le(microlamports) = 9 bytes */
function serializeSetComputeUnitPrice(microLamports: number): Uint8Array {
  const data = new Uint8Array(9);
  data[0] = 0x03;
  // Write as u64 LE (use two u32 writes since DataView has no setUint64)
  new DataView(data.buffer).setUint32(1, microLamports & 0xffffffff, true);
  new DataView(data.buffer).setUint32(
    5,
    Math.floor(microLamports / 0x100000000),
    true
  );
  return data;
}

// ---------------------------------------------------------------------------
// Compiled Instruction Helper
// ---------------------------------------------------------------------------

interface CompiledIx {
  programIdIndex: number;
  accountIndexes: number[];
  data: Uint8Array;
}

function serializeCompiledInstruction(ix: CompiledIx): Uint8Array {
  return concatBytes(
    new Uint8Array([ix.programIdIndex]),
    encodeCompactU16(ix.accountIndexes.length),
    new Uint8Array(ix.accountIndexes),
    encodeCompactU16(ix.data.length),
    ix.data
  );
}

// ---------------------------------------------------------------------------
// V0 Message Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a complete Solana V0 message for a proposal_approve or
 * proposal_reject instruction, optionally including Compute Budget instructions.
 *
 * The serialized format:
 *   [0x80]                          V0 prefix
 *   [header: 3 bytes]
 *   [compact-u16: numKeys]
 *   [keys: numKeys x 32 bytes]
 *   [blockhash: 32 bytes]
 *   [compact-u16: numInstructions]
 *   [instruction...]
 *   [compact-u16: numALTs = 0]
 */
function serializeV0Message(
  memberKey: PublicKey,
  feePayerKey: PublicKey,
  multisigPdaKey: PublicKey,
  proposalPdaKey: PublicKey,
  programIdKey: PublicKey,
  recentBlockhashBytes: Uint8Array,
  instructionData: Uint8Array,
  computeUnitLimit?: number,
  computeUnitPrice?: number
): Uint8Array {
  const sameFeePayer = feePayerKey.equals(memberKey);
  const hasComputeBudget =
    computeUnitLimit !== undefined || computeUnitPrice !== undefined;
  const cbProgramKey = hasComputeBudget
    ? new PublicKey(COMPUTE_BUDGET_PROGRAM_ID)
    : null;

  // Build account keys in compiled order:
  // 1. Writable signers (fee payer first)
  // 2. Read-only signers (none)
  // 3. Writable non-signers
  // 4. Read-only non-signers (multisig, programs)

  const accountKeys: Uint8Array[] = [];
  let numRequiredSignatures: number;
  let numReadonlyUnsigned: number;

  // Writable signers
  if (sameFeePayer) {
    accountKeys.push(memberKey.toBytes()); // 0
    numRequiredSignatures = 1;
  } else {
    accountKeys.push(feePayerKey.toBytes()); // 0
    accountKeys.push(memberKey.toBytes()); // 1
    numRequiredSignatures = 2;
  }

  // Writable non-signers
  const proposalIdx = accountKeys.length;
  accountKeys.push(proposalPdaKey.toBytes());

  // Read-only non-signers
  const multisigIdx = accountKeys.length;
  accountKeys.push(multisigPdaKey.toBytes());

  let cbProgramIdx = -1;
  if (cbProgramKey) {
    cbProgramIdx = accountKeys.length;
    accountKeys.push(cbProgramKey.toBytes());
  }

  const programIdx = accountKeys.length;
  accountKeys.push(programIdKey.toBytes());

  // Count read-only unsigned: multisig + programs
  numReadonlyUnsigned = hasComputeBudget ? 3 : 2; // multisig + CB program + Squads program

  const memberIdx = sameFeePayer ? 0 : 1;

  // Build instructions
  const instructions: CompiledIx[] = [];

  // Compute Budget instructions come first (if present)
  if (computeUnitLimit !== undefined && cbProgramIdx >= 0) {
    instructions.push({
      programIdIndex: cbProgramIdx,
      accountIndexes: [],
      data: serializeSetComputeUnitLimit(computeUnitLimit),
    });
  }
  if (computeUnitPrice !== undefined && cbProgramIdx >= 0) {
    instructions.push({
      programIdIndex: cbProgramIdx,
      accountIndexes: [],
      data: serializeSetComputeUnitPrice(computeUnitPrice),
    });
  }

  // Squads proposal vote instruction
  instructions.push({
    programIdIndex: programIdx,
    accountIndexes: [multisigIdx, memberIdx, proposalIdx],
    data: instructionData,
  });

  // Header
  const header = new Uint8Array([
    numRequiredSignatures,
    0, // numReadonlySignedAccounts
    numReadonlyUnsigned,
  ]);

  // Serialize all instructions
  const serializedInstructions = instructions.map(serializeCompiledInstruction);

  // Full V0 message
  return concatBytes(
    new Uint8Array([0x80]), // V0 prefix
    header,
    encodeCompactU16(accountKeys.length),
    ...accountKeys.map((k) => new Uint8Array(k)),
    recentBlockhashBytes,
    encodeCompactU16(instructions.length),
    ...serializedInstructions,
    encodeCompactU16(0) // 0 address table lookups
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Ledger message hash for a proposal_approve or proposal_reject.
 *
 * Returns the base58-encoded SHA-256 hash of the serialized V0 message,
 * which is what the Ledger displays as "Message Hash" during blind signing.
 */
export async function computeProposalVoteHash(
  params: ProposalVoteMessageParams
): Promise<HashResult> {
  // Parse inputs
  const memberKey = new PublicKey(params.memberPubkey);
  const multisigPdaKey = new PublicKey(params.multisigPda);
  const feePayerKey = params.feePayer
    ? new PublicKey(params.feePayer)
    : memberKey;
  const programIdKey = new PublicKey(SQUADS_PROGRAM_ID);

  // Decode blockhash from base58
  const recentBlockhashBytes = bs58Decode(params.recentBlockhash);
  if (recentBlockhashBytes.length !== 32) {
    throw new Error(
      `Invalid blockhash/nonce: expected 32 bytes, got ${recentBlockhashBytes.length}`
    );
  }

  // Derive proposal PDA
  const [proposalPda] = multisig.getProposalPda({
    multisigPda: multisigPdaKey,
    transactionIndex: params.transactionIndex,
  });

  // Select discriminator
  const discriminator =
    params.operation === "approve"
      ? DISCRIMINATOR_PROPOSAL_APPROVE
      : DISCRIMINATOR_PROPOSAL_REJECT;

  // Serialize instruction data
  const instructionData = serializeProposalVoteData(
    discriminator,
    params.memo
  );

  // Serialize the full V0 message
  const messageBytes = serializeV0Message(
    memberKey,
    feePayerKey,
    multisigPdaKey,
    proposalPda,
    programIdKey,
    new Uint8Array(recentBlockhashBytes),
    instructionData,
    params.computeUnitLimit,
    params.computeUnitPrice
  );

  // SHA-256 hash
  const hashBytes = await sha256(messageBytes);

  // Base58 encode
  const hash = bs58Encode(hashBytes);

  return {
    hash,
    messageBytes,
    messageHex: bytesToHex(messageBytes),
    messageSize: messageBytes.length,
    proposalPda: proposalPda.toBase58(),
    operation: params.operation,
  };
}

/**
 * Hash raw serialized message bytes directly.
 * For verifying transactions fetched from on-chain or pasted by the user.
 * Returns the base58-encoded SHA-256 hash.
 */
export async function hashRawMessage(
  messageBytes: Uint8Array
): Promise<string> {
  const hashBytes = await sha256(messageBytes);
  return bs58Encode(hashBytes);
}
