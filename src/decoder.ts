// ============================================================================
// Squads TX Hashes - Offline Message Decoder
// ============================================================================
//
// Decodes a serialized Solana transaction message (Legacy or V0) entirely
// offline. No RPC calls, minimal SDK dependency (only bs58 for base58).
//
// Shows all instructions, account keys, and attempts to decode known
// instruction types (Squads, Compute Budget, System Program).
// ============================================================================

// @ts-ignore — bs58 has no type declarations
import bs58 from "bs58";
import {
  bytesToHex,
  KNOWN_PROGRAMS,
  SQUADS_PROGRAM_ID,
  DISCRIMINATOR_PROPOSAL_APPROVE,
  DISCRIMINATOR_PROPOSAL_REJECT,
  getTokenInfo,
} from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecodedMessage {
  version: "legacy" | "v0";
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  accountKeys: string[];
  recentBlockhash: string;
  instructions: DecodedInstruction[];
  addressTableLookups: DecodedAddressTableLookup[];
  rawHex: string;
  size: number;
}

export interface DecodedInstruction {
  programIdIndex: number;
  programId: string;
  programLabel: string | null;
  accountIndexes: number[];
  accounts: DecodedAccount[];
  data: Uint8Array;
  dataHex: string;
  decoded: string | null;
  decodedDetails?: Record<string, string>;
  innerInstructions?: DecodedInnerInstruction[];
}

/** Inner instruction from a vault_transaction_create embedded message. */
export interface DecodedInnerInstruction {
  programId: string;
  programLabel: string | null;
  accounts: string[];
  accountLabels?: string[];
  data: Uint8Array;
  dataHex: string;
  decoded: string | null;
}

export interface DecodedAccount {
  index: number;
  pubkey: string;
  writable: boolean;
  signer: boolean;
}

// ---------------------------------------------------------------------------
// Transaction Summary Types
// ---------------------------------------------------------------------------

export type InstructionSafety = "safe" | "review" | "unknown";

export interface TransactionSummary {
  actions: ActionSummary[];
  warnings: Warning[];
  outerInstructionSafety: InstructionSafety[];
  multisigPda?: string;
}

export interface ActionSummary {
  title: string;
  details: Record<string, string>;
  programId: string;
  programLabel: string | null;
}

export interface Warning {
  severity: "info" | "caution" | "danger";
  message: string;
}

export interface DecodedAddressTableLookup {
  accountKey: string;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

// ---------------------------------------------------------------------------
// Parser — reads bytes sequentially
// ---------------------------------------------------------------------------

class ByteReader {
  private offset = 0;
  constructor(private data: Uint8Array) {}

  get remaining(): number {
    return this.data.length - this.offset;
  }

  get position(): number {
    return this.offset;
  }

  readU8(): number {
    if (this.offset >= this.data.length) {
      throw new Error(`Unexpected end of data at offset ${this.offset}`);
    }
    return this.data[this.offset++];
  }

  readBytes(n: number): Uint8Array {
    if (this.offset + n > this.data.length) {
      throw new Error(
        `Unexpected end of data: need ${n} bytes at offset ${this.offset}, have ${this.remaining}`
      );
    }
    const result = this.data.slice(this.offset, this.offset + n);
    this.offset += n;
    return result;
  }

  readCompactU16(): number {
    let value = 0;
    let shift = 0;
    for (let i = 0; i < 3; i++) {
      const b = this.readU8();
      value |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return value;
      }
      shift += 7;
    }
    throw new Error(`Invalid compact-u16 at offset ${this.offset}`);
  }

  readPubkey(): string {
    const bytes = this.readBytes(32);
    return bs58.encode(bytes);
  }

  readU32LE(): number {
    const bytes = this.readBytes(4);
    return (
      bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)
    ) >>> 0;
  }

  readU64LE(): bigint {
    const lo = BigInt(this.readU32LE());
    const hi = BigInt(this.readU32LE());
    return (hi << 32n) | lo;
  }
}

// ---------------------------------------------------------------------------
// Decode logic
// ---------------------------------------------------------------------------

/**
 * Decode a serialized Solana transaction message (Legacy or V0).
 * Fully offline — no network calls.
 */
export function decodeMessage(messageBytes: Uint8Array): DecodedMessage {
  const reader = new ByteReader(messageBytes);

  // Detect version
  let version: "legacy" | "v0";
  const firstByte = messageBytes[0];
  if (firstByte & 0x80) {
    // Versioned message
    const versionNum = firstByte & 0x7f;
    if (versionNum !== 0) {
      throw new Error(`Unsupported message version: ${versionNum}`);
    }
    version = "v0";
    reader.readU8(); // consume version prefix
  } else {
    version = "legacy";
  }

  // Header
  const numRequiredSignatures = reader.readU8();
  const numReadonlySignedAccounts = reader.readU8();
  const numReadonlyUnsignedAccounts = reader.readU8();

  const header = {
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts,
  };

  // Account keys
  const numAccountKeys = reader.readCompactU16();
  const accountKeys: string[] = [];
  for (let i = 0; i < numAccountKeys; i++) {
    accountKeys.push(reader.readPubkey());
  }

  // Recent blockhash
  const recentBlockhash = reader.readPubkey();

  // Instructions
  const numInstructions = reader.readCompactU16();
  const instructions: DecodedInstruction[] = [];

  for (let i = 0; i < numInstructions; i++) {
    const programIdIndex = reader.readU8();
    const numAccounts = reader.readCompactU16();
    const accountIndexes: number[] = [];
    for (let j = 0; j < numAccounts; j++) {
      accountIndexes.push(reader.readU8());
    }
    const dataLen = reader.readCompactU16();
    const data = reader.readBytes(dataLen);

    const programId =
      programIdIndex < accountKeys.length
        ? accountKeys[programIdIndex]
        : `unknown(index ${programIdIndex})`;
    const programLabel = KNOWN_PROGRAMS[programId] ?? null;

    // Resolve accounts with flags
    const accounts: DecodedAccount[] = accountIndexes.map((idx) => ({
      index: idx,
      pubkey:
        idx < accountKeys.length
          ? accountKeys[idx]
          : `unknown(index ${idx})`,
      writable: isWritable(idx, header, numAccountKeys),
      signer: isSigner(idx, header),
    }));

    const decodedResult = decodeInstructionData(programId, data);

    instructions.push({
      programIdIndex,
      programId,
      programLabel,
      accountIndexes,
      accounts,
      data,
      dataHex: bytesToHex(data),
      decoded: decodedResult?.decoded ?? null,
      decodedDetails: decodedResult?.details,
      innerInstructions: decodedResult?.innerInstructions,
    });
  }

  // Address table lookups (V0 only)
  const addressTableLookups: DecodedAddressTableLookup[] = [];
  if (version === "v0" && reader.remaining > 0) {
    const numALTs = reader.readCompactU16();
    for (let i = 0; i < numALTs; i++) {
      const accountKey = reader.readPubkey();
      const numWritable = reader.readCompactU16();
      const writableIndexes: number[] = [];
      for (let j = 0; j < numWritable; j++) {
        writableIndexes.push(reader.readU8());
      }
      const numReadonly = reader.readCompactU16();
      const readonlyIndexes: number[] = [];
      for (let j = 0; j < numReadonly; j++) {
        readonlyIndexes.push(reader.readU8());
      }
      addressTableLookups.push({
        accountKey,
        writableIndexes,
        readonlyIndexes,
      });
    }
  }

  return {
    version,
    header,
    accountKeys,
    recentBlockhash,
    instructions,
    addressTableLookups,
    rawHex: bytesToHex(messageBytes),
    size: messageBytes.length,
  };
}

// ---------------------------------------------------------------------------
// Account flag helpers
// ---------------------------------------------------------------------------

function isSigner(
  index: number,
  header: { numRequiredSignatures: number }
): boolean {
  return index < header.numRequiredSignatures;
}

function isWritable(
  index: number,
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  },
  numAccountKeys: number
): boolean {
  if (index < header.numRequiredSignatures) {
    // Signer: writable if not in the read-only signed range
    const writableSignerEnd =
      header.numRequiredSignatures - header.numReadonlySignedAccounts;
    return index < writableSignerEnd;
  }
  // Non-signer: writable if not in the read-only unsigned range (at the end)
  const readonlyStart = numAccountKeys - header.numReadonlyUnsignedAccounts;
  return index < readonlyStart;
}

// ---------------------------------------------------------------------------
// Known instruction decoders
// ---------------------------------------------------------------------------

const COMPUTE_BUDGET_ID = "ComputeBudget111111111111111111111111111111";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOC_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Squads instruction discriminators
const DISC_VAULT_TX_CREATE = [48, 250, 78, 168, 208, 226, 218, 211];
const DISC_PROPOSAL_CREATE = [220, 60, 73, 224, 30, 108, 79, 159];
const DISC_VAULT_TX_EXECUTE = [194, 8, 161, 87, 153, 164, 25, 171];
const DISC_PROPOSAL_ACTIVATE = [11, 34, 92, 248, 154, 27, 51, 106];
const DISC_CONFIG_TX_CREATE = [155, 236, 87, 228, 137, 75, 81, 39];
const DISC_CONFIG_TX_EXECUTE = [114, 146, 244, 189, 252, 140, 36, 40];
const DISC_BATCH_CREATE = [194, 142, 141, 17, 55, 185, 20, 248];
const DISC_BATCH_ADD_TX = [89, 100, 224, 18, 69, 70, 54, 76];
const DISC_BATCH_EXECUTE_TX = [172, 44, 179, 152, 21, 127, 234, 180];
const DISC_MULTISIG_CREATE = [122, 77, 80, 159, 84, 88, 90, 197];
const DISC_MULTISIG_CREATE_V2 = [50, 221, 199, 93, 40, 245, 139, 233];
const DISC_SPENDING_LIMIT_USE = [16, 57, 130, 127, 193, 20, 155, 134];
const DISC_VAULT_TX_ACCOUNTS_CLOSE = [196, 71, 187, 176, 2, 35, 170, 165];
const DISC_PROPOSAL_ACCOUNTS_CLOSE = [203, 178, 200, 82, 239, 220, 79, 243];
const DISC_CONFIG_TX_ACCOUNTS_CLOSE = [80, 203, 84, 53, 151, 112, 187, 186];
const DISC_BATCH_ACCOUNTS_CLOSE = [218, 196, 7, 175, 130, 102, 11, 255];
const DISC_PROPOSAL_CANCEL = [27, 42, 127, 237, 38, 163, 84, 203];
const DISC_PROPOSAL_CANCEL_V2 = [205, 41, 194, 61, 220, 139, 16, 247];
const DISC_VAULT_TX_CREATE_V2 = [119, 52, 156, 16, 13, 240, 92, 10];

function matchesBytes(
  data: Uint8Array,
  expected: Uint8Array | number[]
): boolean {
  if (data.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>> 0
  );
}

function readU64LE(data: Uint8Array, offset: number): bigint {
  const lo = BigInt(readU32LE(data, offset));
  const hi = BigInt(readU32LE(data, offset + 4));
  return (hi << 32n) | lo;
}

interface DecodedIxResult {
  decoded: string;
  details?: Record<string, string>;
  innerInstructions?: DecodedInnerInstruction[];
  accountLabels?: string[];
}

function decodeInstructionData(
  programId: string,
  data: Uint8Array
): DecodedIxResult | null {
  // Squads Multisig
  if (programId === SQUADS_PROGRAM_ID) {
    return decodeSquadsInstruction(data);
  }

  // Compute Budget
  if (programId === COMPUTE_BUDGET_ID) {
    return decodeComputeBudget(data);
  }

  // System Program
  if (programId === SYSTEM_PROGRAM_ID) {
    return decodeSystemProgram(data);
  }

  // Token Program / Token-2022 Program (same instruction format)
  if (programId === TOKEN_PROGRAM_ID || programId === TOKEN_2022_PROGRAM_ID) {
    return decodeTokenProgram(data);
  }

  // Associated Token Program
  if (programId === ASSOC_TOKEN_PROGRAM_ID) {
    return decodeAssociatedTokenProgram(data);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Squads instruction decoder
// ---------------------------------------------------------------------------

function decodeSquadsInstruction(data: Uint8Array): DecodedIxResult | null {
  if (data.length < 8) return null;

  // proposal_approve
  if (matchesBytes(data, DISCRIMINATOR_PROPOSAL_APPROVE)) {
    const memo = decodeMemoField(data, 8);
    return {
      decoded: `proposal_approve${memo.text}`,
      details: memo.value ? { Memo: memo.value } : undefined,
    };
  }

  // proposal_reject
  if (matchesBytes(data, DISCRIMINATOR_PROPOSAL_REJECT)) {
    const memo = decodeMemoField(data, 8);
    return {
      decoded: `proposal_reject${memo.text}`,
      details: memo.value ? { Memo: memo.value } : undefined,
    };
  }

  // vault_transaction_create
  if (matchesBytes(data, DISC_VAULT_TX_CREATE)) {
    return decodeVaultTransactionCreate(data);
  }

  // proposal_create
  if (matchesBytes(data, DISC_PROPOSAL_CREATE)) {
    return decodeProposalCreate(data);
  }

  // vault_transaction_execute
  if (matchesBytes(data, DISC_VAULT_TX_EXECUTE)) {
    return { decoded: "vault_transaction_execute" };
  }

  // proposal_activate
  if (matchesBytes(data, DISC_PROPOSAL_ACTIVATE)) {
    return { decoded: "proposal_activate" };
  }

  // config_transaction_create
  if (matchesBytes(data, DISC_CONFIG_TX_CREATE)) {
    return { decoded: "config_transaction_create" };
  }

  // config_transaction_execute
  if (matchesBytes(data, DISC_CONFIG_TX_EXECUTE)) {
    return { decoded: "config_transaction_execute" };
  }

  // batch_create
  if (matchesBytes(data, DISC_BATCH_CREATE)) {
    return { decoded: "batch_create" };
  }

  // batch_add_transaction
  if (matchesBytes(data, DISC_BATCH_ADD_TX)) {
    return { decoded: "batch_add_transaction" };
  }

  // batch_execute_transaction
  if (matchesBytes(data, DISC_BATCH_EXECUTE_TX)) {
    return { decoded: "batch_execute_transaction" };
  }

  // multisig_create
  if (matchesBytes(data, DISC_MULTISIG_CREATE)) {
    return { decoded: "multisig_create" };
  }

  // multisig_create_v2
  if (matchesBytes(data, DISC_MULTISIG_CREATE_V2)) {
    return { decoded: "multisig_create_v2" };
  }

  // spending_limit_use
  if (matchesBytes(data, DISC_SPENDING_LIMIT_USE)) {
    return { decoded: "spending_limit_use" };
  }

  // vault_transaction_accounts_close
  if (matchesBytes(data, DISC_VAULT_TX_ACCOUNTS_CLOSE)) {
    return { decoded: "vault_transaction_accounts_close" };
  }

  // proposal_accounts_close
  if (matchesBytes(data, DISC_PROPOSAL_ACCOUNTS_CLOSE)) {
    return { decoded: "proposal_accounts_close" };
  }

  // config_transaction_accounts_close
  if (matchesBytes(data, DISC_CONFIG_TX_ACCOUNTS_CLOSE)) {
    return { decoded: "config_transaction_accounts_close" };
  }

  // batch_accounts_close
  if (matchesBytes(data, DISC_BATCH_ACCOUNTS_CLOSE)) {
    return { decoded: "batch_accounts_close" };
  }

  // proposal_cancel
  if (matchesBytes(data, DISC_PROPOSAL_CANCEL)) {
    return { decoded: "proposal_cancel" };
  }

  // proposal_cancel_v2
  if (matchesBytes(data, DISC_PROPOSAL_CANCEL_V2)) {
    return { decoded: "proposal_cancel_v2" };
  }

  // vault_transaction_create_v2
  if (matchesBytes(data, DISC_VAULT_TX_CREATE_V2)) {
    return decodeVaultTransactionCreate(data);
  }

  // Unknown Squads instruction
  return {
    decoded: `Squads instruction (discriminator: ${bytesToHex(data.slice(0, 8))})`,
  };
}

// ---------------------------------------------------------------------------
// vault_transaction_create decoder
// ---------------------------------------------------------------------------

/**
 * vault_transaction_create data layout:
 *   [0..7]   discriminator (8 bytes)
 *   [8]      vault_index (u8)
 *   [9]      ephemeral_signers (u8)
 *   [10..13] transaction_message_len (u32 LE)
 *   [14..]   transaction_message (raw bytes)
 *   [...]    memo (COption<utf8String>)
 *
 * The transaction_message is a Squads VaultTransactionMessage:
 *   [0]      numSigners (u8)
 *   [1]      numWritableSigners (u8)
 *   [2]      numWritableNonSigners (u8)
 *   [3]      numAccountKeys (u8)
 *   [4..]    accountKeys (numAccountKeys × 32 bytes)
 *   [...]    numInstructions (u8)
 *   [...]    instructions (compiled format)
 */
function decodeVaultTransactionCreate(
  data: Uint8Array
): DecodedIxResult {
  const details: Record<string, string> = {};
  let innerInstructions: DecodedInnerInstruction[] | undefined;

  if (data.length < 14) {
    return {
      decoded: "vault_transaction_create (truncated)",
      details,
    };
  }

  const vaultIndex = data[8];
  const ephemeralSigners = data[9];
  const msgLen = readU32LE(data, 10);

  details["Vault Index"] = vaultIndex.toString();
  details["Ephemeral Signers"] = ephemeralSigners.toString();
  details["Message Size"] = `${msgLen} bytes`;

  if (data.length < 14 + msgLen) {
    return {
      decoded: `vault_transaction_create (vault: ${vaultIndex}, message truncated)`,
      details,
    };
  }

  const msgBytes = data.slice(14, 14 + msgLen);

  // Parse the Squads VaultTransactionMessage
  try {
    const parsed = decodeSquadsVaultMessage(msgBytes);
    details["Inner Signers"] = parsed.numSigners.toString();
    details["Inner Writable Signers"] =
      parsed.numWritableSigners.toString();
    details["Inner Writable Non-Signers"] =
      parsed.numWritableNonSigners.toString();
    details["Inner Account Keys"] = parsed.accountKeys.length.toString();
    details["Inner Instructions"] = parsed.instructions.length.toString();

    innerInstructions = parsed.instructions;
  } catch {
    details["Inner Message"] = "Failed to parse";
  }

  // Memo after the message
  const memoOffset = 14 + msgLen;
  const memo = decodeMemoField(data, memoOffset);
  if (memo.value) {
    details["Memo"] = memo.value;
  }

  const ixCount = innerInstructions?.length ?? "?";
  return {
    decoded: `vault_transaction_create (vault: ${vaultIndex}, ${ixCount} inner ix${memo.text})`,
    details,
    innerInstructions,
  };
}

interface ParsedVaultMessage {
  numSigners: number;
  numWritableSigners: number;
  numWritableNonSigners: number;
  accountKeys: string[];
  instructions: DecodedInnerInstruction[];
}

/**
 * Parse a Squads VaultTransactionMessage (the embedded message inside
 * vault_transaction_create).
 *
 * Format:
 *   u8: numSigners
 *   u8: numWritableSigners
 *   u8: numWritableNonSigners
 *   u8: numAccountKeys
 *   [numAccountKeys × 32 bytes]: account keys
 *   u8: numInstructions
 *   for each instruction:
 *     u8: programIdIndex
 *     u8: numAccountIndexes
 *     [numAccountIndexes × u8]: account indexes
 *     u16 LE: dataLen
 *     [dataLen bytes]: data
 */
function decodeSquadsVaultMessage(
  msgBytes: Uint8Array
): ParsedVaultMessage {
  const reader = new ByteReader(msgBytes);

  const numSigners = reader.readU8();
  const numWritableSigners = reader.readU8();
  const numWritableNonSigners = reader.readU8();
  const numAccountKeys = reader.readU8();

  const accountKeys: string[] = [];
  for (let i = 0; i < numAccountKeys; i++) {
    accountKeys.push(reader.readPubkey());
  }

  const numInstructions = reader.readU8();
  const instructions: DecodedInnerInstruction[] = [];

  for (let i = 0; i < numInstructions; i++) {
    const programIdIndex = reader.readU8();
    const numAccIndexes = reader.readU8();
    const accIndexes: number[] = [];
    for (let j = 0; j < numAccIndexes; j++) {
      accIndexes.push(reader.readU8());
    }
    // Data length is u16 LE in Squads inner message format
    const dataLenLo = reader.readU8();
    const dataLenHi = reader.readU8();
    const dataLen = dataLenLo | (dataLenHi << 8);
    const ixData = reader.readBytes(dataLen);

    const progId =
      programIdIndex < accountKeys.length
        ? accountKeys[programIdIndex]
        : `unknown(index ${programIdIndex})`;
    const progLabel = KNOWN_PROGRAMS[progId] ?? null;

    const accounts = accIndexes.map((idx) =>
      idx < accountKeys.length ? accountKeys[idx] : `unknown(index ${idx})`
    );

    // Try to decode the inner instruction data
    const innerDecoded = decodeInstructionData(progId, ixData);

    // Enrich account labels with token names where applicable
    let enrichedLabels = innerDecoded?.accountLabels;
    if (enrichedLabels) {
      enrichedLabels = enrichedLabels.map((label, idx) => {
        if (label === "Mint" && idx < accounts.length) {
          const tokenInfo = getTokenInfo(accounts[idx]);
          if (tokenInfo) {
            return `Mint [${tokenInfo.symbol}]`;
          }
        }
        return label;
      });
    }

    instructions.push({
      programId: progId,
      programLabel: progLabel,
      accounts,
      accountLabels: enrichedLabels,
      data: ixData,
      dataHex: bytesToHex(ixData),
      decoded: innerDecoded?.decoded ?? null,
    });
  }

  return {
    numSigners,
    numWritableSigners,
    numWritableNonSigners,
    accountKeys,
    instructions,
  };
}

// ---------------------------------------------------------------------------
// proposal_create decoder
// ---------------------------------------------------------------------------

/**
 * proposal_create data layout:
 *   [0..7]   discriminator (8 bytes)
 *   [8..15]  transaction_index (u64 LE)
 *   [16]     draft (bool: 0x00 or 0x01)
 */
function decodeProposalCreate(data: Uint8Array): DecodedIxResult {
  if (data.length < 17) {
    return { decoded: "proposal_create (truncated)" };
  }

  const txIndex = readU64LE(data, 8);
  const draft = data[16] !== 0;

  return {
    decoded: `proposal_create (tx: ${txIndex}, draft: ${draft})`,
    details: {
      "Transaction Index": txIndex.toString(),
      Draft: draft ? "Yes" : "No",
    },
  };
}

// ---------------------------------------------------------------------------
// Compute Budget decoder
// ---------------------------------------------------------------------------

function decodeComputeBudget(data: Uint8Array): DecodedIxResult | null {
  if (data.length >= 5 && data[0] === 0x02) {
    const units = readU32LE(data, 1);
    return {
      decoded: `SetComputeUnitLimit: ${units.toLocaleString()} units`,
      details: { "Compute Units": units.toLocaleString() },
    };
  }
  if (data.length >= 9 && data[0] === 0x03) {
    const price = readU64LE(data, 1);
    return {
      decoded: `SetComputeUnitPrice: ${price.toLocaleString()} microlamports`,
      details: { "Price (microlamports)": price.toLocaleString() },
    };
  }
  if (data.length >= 5 && data[0] === 0x00) {
    const units = readU32LE(data, 1);
    return {
      decoded: `RequestUnitsDeprecated: ${units.toLocaleString()}`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// System Program decoder
// ---------------------------------------------------------------------------

function decodeSystemProgram(data: Uint8Array): DecodedIxResult | null {
  if (data.length < 4) return null;

  const ixType = readU32LE(data, 0);

  switch (ixType) {
    case 0x00: {
      // CreateAccount: u32 discriminator + u64 lamports + u64 space + 32-byte owner
      if (data.length >= 52) {
        const lamports = readU64LE(data, 4);
        const space = readU64LE(data, 12);
        const owner = bs58.encode(data.slice(20, 52));
        const sol = Number(lamports) / 1_000_000_000;
        return {
          decoded: `CreateAccount (${sol} SOL, ${space} bytes)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString(),
            Space: space.toString(),
            Owner: owner,
          },
        };
      }
      return { decoded: "CreateAccount" };
    }

    case 0x01:
      // Assign
      return { decoded: "Assign" };

    case 0x02: {
      // Transfer: u32 discriminator + u64 lamports
      if (data.length >= 12) {
        const lamports = readU64LE(data, 4);
        const sol = Number(lamports) / 1_000_000_000;
        return {
          decoded: `Transfer: ${lamports.toLocaleString()} lamports (${sol} SOL)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString(),
          },
        };
      }
      return { decoded: "Transfer" };
    }

    case 0x03:
      // CreateAccountWithSeed
      return { decoded: "CreateAccountWithSeed" };

    case 0x04:
      // AdvanceNonceAccount (no additional data beyond discriminator)
      return { decoded: "AdvanceNonceAccount" };

    case 0x05: {
      // WithdrawNonceAccount: u32 discriminator + u64 lamports
      if (data.length >= 12) {
        const lamports = readU64LE(data, 4);
        const sol = Number(lamports) / 1_000_000_000;
        return {
          decoded: `WithdrawNonceAccount: ${lamports.toLocaleString()} lamports (${sol} SOL)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString(),
          },
        };
      }
      return { decoded: "WithdrawNonceAccount" };
    }

    case 0x06: {
      // InitializeNonceAccount: u32 discriminator + 32-byte authority pubkey
      if (data.length >= 36) {
        const authority = bs58.encode(data.slice(4, 36));
        return {
          decoded: "InitializeNonceAccount",
          details: { Authority: authority },
        };
      }
      return { decoded: "InitializeNonceAccount" };
    }

    case 0x07: {
      // AuthorizeNonceAccount: u32 discriminator + 32-byte new authority
      if (data.length >= 36) {
        const newAuthority = bs58.encode(data.slice(4, 36));
        return {
          decoded: "AuthorizeNonceAccount",
          details: { "New Authority": newAuthority },
        };
      }
      return { decoded: "AuthorizeNonceAccount" };
    }

    case 0x09:
      // Allocate
      return { decoded: "Allocate" };

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Token Program decoder (works for both Token and Token-2022)
// ---------------------------------------------------------------------------

function decodeTokenProgram(data: Uint8Array): DecodedIxResult | null {
  if (data.length < 1) return null;

  const ixType = data[0];

  switch (ixType) {
    case 0x01: // InitializeAccount
      return {
        decoded: "InitializeAccount",
        accountLabels: ["Account", "Mint", "Owner", "Rent Sysvar"],
      };

    case 0x03: {
      // Transfer: u8 discriminator + u64 amount
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Transfer: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Destination Token Account", "From (Wallet)"],
        };
      }
      return {
        decoded: "Transfer",
        accountLabels: ["Source Token Account", "Destination Token Account", "From (Wallet)"],
      };
    }

    case 0x04: {
      // Approve: u8 discriminator + u64 amount
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Approve: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Delegate", "Owner / Signer"],
        };
      }
      return {
        decoded: "Approve",
        accountLabels: ["Source Token Account", "Delegate", "Owner / Signer"],
      };
    }

    case 0x05: // Revoke
      return {
        decoded: "Revoke",
        accountLabels: ["Source Token Account", "Owner / Signer"],
      };

    case 0x07: {
      // MintTo: u8 discriminator + u64 amount
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `MintTo: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Mint", "Destination Token Account", "Owner / Signer"],
        };
      }
      return {
        decoded: "MintTo",
        accountLabels: ["Mint", "Destination Token Account", "Owner / Signer"],
      };
    }

    case 0x08: {
      // Burn: u8 discriminator + u64 amount
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Burn: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Mint", "Owner / Signer"],
        };
      }
      return {
        decoded: "Burn",
        accountLabels: ["Source Token Account", "Mint", "Owner / Signer"],
      };
    }

    case 0x09: // CloseAccount
      return {
        decoded: "CloseAccount",
        accountLabels: ["Token Account", "Destination (Wallet)", "Owner / Signer"],
      };

    case 0x0a: // FreezeAccount
      return {
        decoded: "FreezeAccount",
        accountLabels: ["Token Account", "Mint", "Freeze Authority"],
      };

    case 0x0b: // ThawAccount
      return {
        decoded: "ThawAccount",
        accountLabels: ["Token Account", "Mint", "Freeze Authority"],
      };

    case 0x0c: {
      // TransferChecked: u8 discriminator + u64 amount + u8 decimals
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `TransferChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: {
            Amount: humanAmount.toString(),
            "Raw Amount": amount.toString(),
            Decimals: decimals.toString(),
          },
          accountLabels: ["Source Token Account", "Mint", "Destination Token Account", "From (Wallet)"],
        };
      }
      return {
        decoded: "TransferChecked",
        accountLabels: ["Source Token Account", "Mint", "Destination Token Account", "From (Wallet)"],
      };
    }

    case 0x0d: {
      // ApproveChecked: u8 discriminator + u64 amount + u8 decimals
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `ApproveChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: {
            Amount: humanAmount.toString(),
            "Raw Amount": amount.toString(),
            Decimals: decimals.toString(),
          },
          accountLabels: ["Source Token Account", "Mint", "Delegate", "Owner / Signer"],
        };
      }
      return {
        decoded: "ApproveChecked",
        accountLabels: ["Source Token Account", "Mint", "Delegate", "Owner / Signer"],
      };
    }

    case 0x0e: {
      // MintToChecked: u8 discriminator + u64 amount + u8 decimals
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `MintToChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: { Amount: humanAmount.toString(), Decimals: decimals.toString() },
          accountLabels: ["Mint", "Destination Token Account", "Mint Authority"],
        };
      }
      return {
        decoded: "MintToChecked",
        accountLabels: ["Mint", "Destination Token Account", "Mint Authority"],
      };
    }

    case 0x0f: {
      // BurnChecked: u8 discriminator + u64 amount + u8 decimals
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `BurnChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: { Amount: humanAmount.toString(), Decimals: decimals.toString() },
          accountLabels: ["Source Token Account", "Mint", "Owner / Signer"],
        };
      }
      return {
        decoded: "BurnChecked",
        accountLabels: ["Source Token Account", "Mint", "Owner / Signer"],
      };
    }

    case 0x06: // SetAuthority
      return {
        decoded: "SetAuthority",
        accountLabels: ["Token Account", "Current Authority"],
      };

    case 0x11: // SyncNative
      return {         decoded: "SyncNative", accountLabels: ["Token Account"] };

    default:
      return { decoded: `Token instruction ${ixType}` };
  }
}

// ---------------------------------------------------------------------------
// Associated Token Program decoder
// ---------------------------------------------------------------------------

function decodeAssociatedTokenProgram(data: Uint8Array): DecodedIxResult | null {
  // ATA instructions: 0x00 = Create, 0x01 = CreateIdempotent
  // Both have the same account layout and no additional data
  if (data.length === 0 || data[0] === 0x00) {
    return {
      decoded: "CreateAssociatedTokenAccount",
      accountLabels: ["Payer", "ATA", "Owner", "Mint", "System Program", "Token Program"],
    };
  }
  if (data[0] === 0x01) {
    return {
      decoded: "CreateAssociatedTokenAccountIdempotent",
      accountLabels: ["Payer", "ATA", "Owner", "Mint", "System Program", "Token Program"],
    };
  }
  if (data[0] === 0x02) {
    return {
      decoded: "RecoverNested",
      accountLabels: ["Nested ATA", "Token Mint (nested)", "Dest ATA", "Owner ATA", "Token Mint (owner)", "Owner", "Token Program"],
    };
  }
  return { decoded: `ATA instruction ${data[0]}` };
}

// ---------------------------------------------------------------------------
// Memo field decoder
// ---------------------------------------------------------------------------

/**
 * Decode the COption<utf8String> memo field starting at the given offset.
 */
function decodeMemoField(
  data: Uint8Array,
  offset: number
): { text: string; value: string | null } {
  if (offset >= data.length)
    return { text: " (no memo)", value: null };
  const optionByte = data[offset];
  if (optionByte === 0) return { text: " (no memo)", value: null };
  if (optionByte !== 1) return { text: "", value: null };

  if (offset + 5 > data.length)
    return { text: " (memo: <truncated>)", value: null };
  const len = readU32LE(data, offset + 1);
  if (offset + 5 + len > data.length)
    return { text: " (memo: <truncated>)", value: null };
  const memoBytes = data.slice(offset + 5, offset + 5 + len);
  const memoStr = new TextDecoder().decode(memoBytes);
  return { text: ` (memo: "${memoStr}")`, value: memoStr };
}

// ---------------------------------------------------------------------------
// Transaction Summary Generator
// ---------------------------------------------------------------------------

/** Known safe/expected Squads instruction names. */
const SAFE_INSTRUCTIONS = new Set([
  "proposal_approve",
  "proposal_reject",
  "proposal_create",
  "proposal_activate",
  "proposal_cancel",
  "proposal_cancel_v2",
  "vault_transaction_execute",
  "vault_transaction_accounts_close",
  "config_transaction_execute",
  "config_transaction_accounts_close",
  "batch_execute_transaction",
  "batch_accounts_close",
  "proposal_accounts_close",
]);

const SAFE_PROGRAMS = new Set([
  COMPUTE_BUDGET_ID,
  SQUADS_PROGRAM_ID,
]);

/**
 * Generate a transaction summary with safety classifications and
 * human-readable action descriptions for the vault transaction contents.
 */
export function generateTransactionSummary(
  decoded: DecodedMessage
): TransactionSummary {
  const actions: ActionSummary[] = [];
  const warnings: Warning[] = [];
  const outerInstructionSafety: InstructionSafety[] = [];
  let multisigPda: string | undefined;

  /** System Program instructions considered safe as outer instructions. */
  const SAFE_SYSTEM_INSTRUCTIONS = new Set([
    "AdvanceNonceAccount",
  ]);

  for (const ix of decoded.instructions) {
    // Classify each outer instruction
    if (ix.programId === COMPUTE_BUDGET_ID) {
      // Compute Budget instructions are always safe boilerplate
      outerInstructionSafety.push("safe");
    } else if (ix.programId === SYSTEM_PROGRAM_ID) {
      // System Program — safe if it's a known boilerplate instruction
      const ixName = ix.decoded?.split(":")[0].split(" ")[0] ?? "";
      if (SAFE_SYSTEM_INSTRUCTIONS.has(ixName)) {
        outerInstructionSafety.push("safe");
      } else {
        outerInstructionSafety.push("unknown");
        warnings.push({
          severity: "caution",
          message: `Unexpected System Program instruction at outer level: ${ix.decoded ?? "unknown"}`,
        });
      }
    } else if (ix.programId === SQUADS_PROGRAM_ID && ix.decoded) {
      // Extract the instruction name (first word before any parentheses or details)
      const ixName = ix.decoded.split(" ")[0].split("(")[0];

      if (ixName === "vault_transaction_create" || ixName === "vault_transaction_create_v2" || ixName === "config_transaction_create") {
        // These contain the actual operations — mark for review
        outerInstructionSafety.push("review");

        // Extract multisig PDA from the first account of this instruction
        if (ix.accounts.length > 0) {
          multisigPda = ix.accounts[0].pubkey;
        }

        // Generate action summaries from inner instructions
        if (ix.innerInstructions) {
          for (const inner of ix.innerInstructions) {
            actions.push(generateActionSummary(inner));
          }

          // Cross-reference: find destination wallets from ATA creation instructions
          const ataToOwner: Record<string, string> = {};
          for (const inner of ix.innerInstructions) {
            if (
              inner.programId === ASSOC_TOKEN_PROGRAM_ID &&
              inner.decoded !== null &&
              inner.decoded.startsWith("CreateAssociatedTokenAccount") &&
              inner.accounts.length >= 3
            ) {
              const ata = inner.accounts[1]; // ATA address
              const owner = inner.accounts[2]; // Owner wallet
              ataToOwner[ata] = owner;
            }
          }

          // Enrich TransferChecked/Transfer actions with destination wallet
          if (Object.keys(ataToOwner).length > 0) {
            for (const action of actions) {
              const toTokenAccount = action.details["To (Token Account)"];
              if (toTokenAccount && ataToOwner[toTokenAccount]) {
                const newDetails: Record<string, string> = {};
                for (const [key, value] of Object.entries(action.details)) {
                  newDetails[key] = value;
                  if (key === "To (Token Account)") {
                    newDetails["To (Wallet)"] = ataToOwner[toTokenAccount];
                  }
                }
                action.details = newDetails;
              }
            }
          }
        }

        if (!ix.innerInstructions || ix.innerInstructions.length === 0) {
          warnings.push({
            severity: "danger",
            message: "Vault transaction has no inner instructions — this is unusual.",
          });
        } else if (ix.innerInstructions.length > 1) {
          warnings.push({
            severity: "info",
            message: `Vault transaction contains ${ix.innerInstructions.length} inner instructions. Review all of them.`,
          });
        }
      } else if (SAFE_INSTRUCTIONS.has(ixName)) {
        outerInstructionSafety.push("safe");
      } else {
        outerInstructionSafety.push("unknown");
        warnings.push({
          severity: "caution",
          message: `Unrecognized Squads instruction: ${ix.decoded}`,
        });
      }
    } else if (!SAFE_PROGRAMS.has(ix.programId)) {
      // Unknown program
      outerInstructionSafety.push("unknown");
      const label = ix.programLabel ?? ix.programId;
      warnings.push({
        severity: "danger",
        message: `Instruction uses program "${label}" which is not a recognized Squads or system program. Verify it is legitimate.`,
      });
    } else {
      outerInstructionSafety.push("unknown");
    }
  }

  // Check for large SOL transfers in actions
  for (const action of actions) {
    if (action.details["SOL"] !== undefined) {
      const sol = parseFloat(action.details["SOL"]);
      if (!isNaN(sol) && sol > 10) {
        warnings.push({
          severity: "caution",
          message: `Large transfer: ${sol} SOL. Double-check the amount.`,
        });
      }
    }
  }

  return { actions, warnings, outerInstructionSafety, multisigPda };
}

function generateActionSummary(inner: DecodedInnerInstruction): ActionSummary {
  const programLabel = inner.programLabel ?? null;

  // System Program Transfer
  if (
    inner.programId === SYSTEM_PROGRAM_ID &&
    inner.decoded &&
    inner.decoded.startsWith("Transfer:")
  ) {
    const from = inner.accounts.length > 0 ? inner.accounts[0] : "unknown";
    const to = inner.accounts.length > 1 ? inner.accounts[1] : "unknown";

    // Parse lamports and SOL from decoded string
    const match = inner.decoded.match(
      /Transfer:\s*([\d,]+)\s*lamports\s*\(([\d.]+)\s*SOL\)/
    );
    const lamports = match ? match[1] : "?";
    const sol = match ? match[2] : "?";

    return {
      title: `Transfer ${sol} SOL`,
      details: {
        From: from,
        To: to,
        Amount: `${lamports} lamports (${sol} SOL)`,
        SOL: sol,
      },
      programId: inner.programId,
      programLabel,
    };
  }

  // Token TransferChecked
  if (
    (inner.programId === TOKEN_PROGRAM_ID ||
      inner.programId === TOKEN_2022_PROGRAM_ID) &&
    inner.decoded &&
    inner.decoded.startsWith("TransferChecked:")
  ) {
    // Account labels: Source, Mint, Destination, Authority
    const source = inner.accounts.length > 0 ? inner.accounts[0] : "unknown";
    const mint = inner.accounts.length > 1 ? inner.accounts[1] : "unknown";
    const destination = inner.accounts.length > 2 ? inner.accounts[2] : "unknown";
    const authority = inner.accounts.length > 3 ? inner.accounts[3] : "unknown";

    const tokenInfo = getTokenInfo(mint);

    const match = inner.decoded.match(
      /TransferChecked:\s*([\d.]+)\s*tokens\s*\(([\d,]+)\s*raw,\s*(\d+)\s*decimals\)/
    );
    const amount = match ? match[1] : "?";
    const rawAmount = match ? match[2] : "?";
    const decimals = match ? match[3] : "?";

    const tokenName = tokenInfo
      ? `${tokenInfo.symbol} (${tokenInfo.name})`
      : "unknown token";
    const mintDisplay = tokenInfo
      ? `${mint} [${tokenInfo.symbol}]`
      : mint;

    return {
      title: `Transfer ${amount} ${tokenInfo?.symbol ?? "tokens"}`,
      details: {
        "From (Wallet)": authority,
        "Source Token Account": source,
        "To (Token Account)": destination,
        Token: tokenName,
        Mint: mintDisplay,
        Amount: `${rawAmount} raw (${decimals} decimals) = ${amount}`,
      },
      programId: inner.programId,
      programLabel,
    };
  }

  // Token Transfer (unchecked)
  if (
    (inner.programId === TOKEN_PROGRAM_ID ||
      inner.programId === TOKEN_2022_PROGRAM_ID) &&
    inner.decoded &&
    inner.decoded.startsWith("Transfer:")
  ) {
    const source = inner.accounts.length > 0 ? inner.accounts[0] : "unknown";
    const destination = inner.accounts.length > 1 ? inner.accounts[1] : "unknown";
    const authority = inner.accounts.length > 2 ? inner.accounts[2] : "unknown";

    return {
      title: inner.decoded,
      details: {
        "From (Wallet)": authority,
        "Source Token Account": source,
        "To (Token Account)": destination,
      },
      programId: inner.programId,
      programLabel,
    };
  }

  // Unknown instruction — generic summary
  // Use account labels if available
  const details: Record<string, string> = {
    Program: inner.programLabel
      ? `${inner.programLabel} (${inner.programId})`
      : inner.programId,
  };

  for (let i = 0; i < inner.accounts.length; i++) {
    const label =
      inner.accountLabels && i < inner.accountLabels.length
        ? inner.accountLabels[i]
        : `Account ${i}`;
    details[label] = inner.accounts[i];
  }

  if (inner.data.length > 0) {
    details["Data Size"] = `${inner.data.length} bytes`;
  }

  return {
    title: inner.decoded ?? "Unknown operation",
    details,
    programId: inner.programId,
    programLabel,
  };
}

// ---------------------------------------------------------------------------
// Input conversion helpers
// ---------------------------------------------------------------------------

/** Convert a hex string to Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "").replace(/^0x/i, "");
  if (clean.length % 2 !== 0) {
    throw new Error("Hex string must have an even number of characters.");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}: "${clean.substring(i, i + 2)}"`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/** Convert a base64 string to Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  const binaryStr = atob(b64.trim());
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
