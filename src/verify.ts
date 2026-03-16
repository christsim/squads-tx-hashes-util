// ============================================================================
// Squads TX Hashes - Transaction Verification
// ============================================================================
//
// Looks up on-chain transactions by signature or by proposal PDA history,
// extracts the serialized message bytes, and computes the SHA-256 hash.
// ============================================================================

import { Connection, PublicKey } from "@solana/web3.js";
import { hashRawMessage } from "./hashes";
import {
  SQUADS_PROGRAM_ID,
  DISCRIMINATOR_PROPOSAL_APPROVE,
  DISCRIMINATOR_PROPOSAL_REJECT,
  bytesToHex,
} from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionVerifyResult {
  signature: string;
  hash: string; // base58 SHA-256 of message bytes
  messageHex: string;
  messageSize: number;
  feePayer: string;
  blockhash: string;
  slot: number;
  blockTime: number | null;
  numInstructions: number;
  accountKeys: string[];
  isApproval: boolean;
  isRejection: boolean;
  approver: string | null; // member key if this is an approval/rejection
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesBytes(
  data: Uint8Array | number[],
  expected: Uint8Array,
  offset: number = 0
): boolean {
  if (data.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a single transaction by its signature.
 * Fetches the transaction from RPC, extracts message bytes, computes SHA-256 hash.
 */
export async function verifyTransactionSignature(
  connection: Connection,
  signature: string
): Promise<TransactionVerifyResult> {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx || !tx.transaction) {
    throw new Error(
      `Transaction not found: ${signature}. It may have expired or the RPC may not have it.`
    );
  }

  const message = tx.transaction.message;
  const messageBytes = message.serialize();
  const hash = await hashRawMessage(messageBytes);

  // Extract account keys
  const staticKeys = message.staticAccountKeys.map((k) => k.toBase58());
  const loadedWritable = tx.meta?.loadedAddresses?.writable?.map((k) =>
    k.toBase58()
  ) ?? [];
  const loadedReadonly = tx.meta?.loadedAddresses?.readonly?.map((k) =>
    k.toBase58()
  ) ?? [];
  const allKeys = [...staticKeys, ...loadedWritable, ...loadedReadonly];

  // Fee payer is always the first static account key
  const feePayer = staticKeys[0] ?? "unknown";

  // Extract blockhash
  const blockhash = message.recentBlockhash;

  // Check if this is a proposal_approve or proposal_reject
  let isApproval = false;
  let isRejection = false;
  let approver: string | null = null;

  const compiledInstructions = message.compiledInstructions;
  for (const ix of compiledInstructions) {
    const programKey =
      ix.programIdIndex < allKeys.length
        ? allKeys[ix.programIdIndex]
        : null;

    if (programKey !== SQUADS_PROGRAM_ID) continue;

    const ixData = ix.data;
    if (matchesBytes(ixData, DISCRIMINATOR_PROPOSAL_APPROVE)) {
      isApproval = true;
      // The member account is the second account in the instruction
      // (Squads order: multisig=0, member=1, proposal=2)
      if (ix.accountKeyIndexes.length >= 2) {
        const memberIdx = ix.accountKeyIndexes[1];
        approver =
          memberIdx < allKeys.length ? allKeys[memberIdx] : null;
      }
      break;
    }
    if (matchesBytes(ixData, DISCRIMINATOR_PROPOSAL_REJECT)) {
      isRejection = true;
      if (ix.accountKeyIndexes.length >= 2) {
        const memberIdx = ix.accountKeyIndexes[1];
        approver =
          memberIdx < allKeys.length ? allKeys[memberIdx] : null;
      }
      break;
    }
  }

  return {
    signature,
    hash,
    messageHex: bytesToHex(messageBytes),
    messageSize: messageBytes.length,
    feePayer,
    blockhash,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    numInstructions: compiledInstructions.length,
    accountKeys: allKeys,
    isApproval,
    isRejection,
    approver,
  };
}

/**
 * Look up all approval/rejection transactions for a proposal by scanning
 * the proposal PDA's transaction history.
 *
 * Returns one result per approval/rejection transaction found.
 */
export async function lookupApprovalHashes(
  connection: Connection,
  proposalPda: PublicKey
): Promise<TransactionVerifyResult[]> {
  // Fetch signatures for the proposal PDA
  const signatures = await connection.getSignaturesForAddress(proposalPda, {
    limit: 50,
  });

  if (signatures.length === 0) {
    return [];
  }

  const results: TransactionVerifyResult[] = [];

  // Process each transaction
  for (const sigInfo of signatures) {
    if (sigInfo.err) continue; // Skip failed transactions

    try {
      const result = await verifyTransactionSignature(
        connection,
        sigInfo.signature
      );

      // Only include approval and rejection transactions
      if (result.isApproval || result.isRejection) {
        results.push(result);
      }
    } catch {
      // Skip transactions we can't parse
      console.warn(
        `Failed to verify transaction ${sigInfo.signature}:`,
      );
    }
  }

  // Sort by slot (oldest first — chronological order)
  results.sort((a, b) => a.slot - b.slot);

  return results;
}
