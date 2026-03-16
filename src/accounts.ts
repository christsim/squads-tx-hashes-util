// ============================================================================
// Squads TX Hashes - Account Fetching & Resolution
// ============================================================================
//
// Reads Squads v4 on-chain accounts directly from Solana RPC.
// Includes smart address resolution (vault -> multisig PDA) and debug info.
// ============================================================================

import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  BATCH_SIZE,
  SQUADS_PROGRAM_ID,
  LAMPORTS_PER_SOL,
  DISCRIMINATOR_MULTISIG,
  DISCRIMINATOR_VAULT_TX,
  DISCRIMINATOR_CONFIG_TX,
  DISCRIMINATOR_PROPOSAL,
  DISCRIMINATOR_BATCH,
  DISCRIMINATOR_LABELS,
  KNOWN_PROGRAMS,
  bytesToHex,
} from "./constants";

// ---------------------------------------------------------------------------
// Types -- Debug / Inspection
// ---------------------------------------------------------------------------

export interface AccountInspection {
  address: string;
  exists: boolean;
  owner: string | null;
  ownerLabel: string | null;
  dataLength: number;
  lamports: number;
  solBalance: string;
  executable: boolean;
  discriminatorHex: string | null;
  accountType: string | null;
  rawDataHex: string | null; // first 256 bytes hex
  rawJson: string; // full getAccountInfo response summary
}

export interface ResolveResult {
  success: boolean;
  multisigPda: PublicKey | null;
  inputType: "multisig" | "vault" | "createKey" | "squads-other" | "unknown";
  inspections: AccountInspection[];
  messages: string[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Types -- Multisig Data
// ---------------------------------------------------------------------------

export type ProposalStatusKind =
  | "Draft"
  | "Active"
  | "Rejected"
  | "Approved"
  | "Executing"
  | "Executed"
  | "Cancelled";

const PENDING_STATUSES: ProposalStatusKind[] = ["Draft", "Active", "Approved"];
const COMPLETED_STATUSES: ProposalStatusKind[] = [
  "Executed",
  "Rejected",
  "Cancelled",
];

export interface MultisigInfo {
  address: PublicKey;
  createKey: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  timeLock: number;
  transactionIndex: bigint;
  staleTransactionIndex: bigint;
  rentCollector: PublicKey | null;
  bump: number;
  members: MemberInfo[];
}

export interface MemberInfo {
  key: PublicKey;
  permissionMask: number;
}

export interface TransactionWithProposal {
  index: bigint;
  transactionPda: PublicKey;
  proposalPda: PublicKey;
  type: "vault" | "config" | "batch" | "unknown";
  transaction: VaultTransactionInfo | ConfigTransactionInfo | null;
  proposal: ProposalInfo | null;
  reclaimed: boolean;
}

export interface VaultTransactionInfo {
  type: "vault";
  creator: PublicKey;
  vaultIndex: number;
  ephemeralSignerBumps: Uint8Array;
  message: VaultMessageInfo;
}

export interface VaultMessageInfo {
  numSigners: number;
  numWritableSigners: number;
  numWritableNonSigners: number;
  accountKeys: PublicKey[];
  instructions: CompiledInstructionInfo[];
  addressTableLookups: AddressTableLookupInfo[];
}

export interface CompiledInstructionInfo {
  programIdIndex: number;
  accountIndexes: number[];
  data: Uint8Array;
}

export interface AddressTableLookupInfo {
  accountKey: PublicKey;
  writableIndexes: number[];
  readonlyIndexes: number[];
}

export interface ConfigTransactionInfo {
  type: "config";
  creator: PublicKey;
  actions: ConfigActionInfo[];
}

export interface ConfigActionInfo {
  kind: string;
  description: string;
  details: Record<string, string>;
}

export interface ProposalInfo {
  status: ProposalStatusKind;
  timestamp: bigint | null;
  approved: PublicKey[];
  rejected: PublicKey[];
  cancelled: PublicKey[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBigInt(value: number | { toString(): string }): bigint {
  return BigInt(value.toString());
}

function matchesDiscriminator(
  data: Buffer | Uint8Array,
  expected: number[]
): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

function getDiscriminatorHex(data: Buffer | Uint8Array): string | null {
  if (data.length < 8) return null;
  return bytesToHex(data.slice(0, 8));
}

function identifyAccountType(data: Buffer | Uint8Array): string | null {
  const hex = getDiscriminatorHex(data);
  if (!hex) return null;
  return DISCRIMINATOR_LABELS[hex] ?? null;
}

/**
 * Extract the first pubkey field after the 8-byte discriminator.
 * For Squads accounts (VaultTransaction, ConfigTransaction, Proposal, Batch),
 * the first 32 bytes after the discriminator is the multisig pubkey.
 * For Multisig, it's the createKey.
 */
function extractFirstPubkey(data: Buffer | Uint8Array): PublicKey | null {
  if (data.length < 40) return null; // 8 discriminator + 32 pubkey
  return new PublicKey(data.slice(8, 40));
}

// ---------------------------------------------------------------------------
// Account Inspection
// ---------------------------------------------------------------------------

/**
 * Inspect an account without attempting deserialization.
 * Returns raw debug info about the account.
 */
export async function inspectAccount(
  connection: Connection,
  address: PublicKey
): Promise<AccountInspection> {
  let accountInfo: AccountInfo<Buffer> | null = null;

  try {
    accountInfo = await connection.getAccountInfo(address);
  } catch (err) {
    return {
      address: address.toBase58(),
      exists: false,
      owner: null,
      ownerLabel: null,
      dataLength: 0,
      lamports: 0,
      solBalance: "0 SOL",
      executable: false,
      discriminatorHex: null,
      accountType: null,
      rawDataHex: null,
      rawJson: `RPC error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!accountInfo) {
    return {
      address: address.toBase58(),
      exists: false,
      owner: null,
      ownerLabel: null,
      dataLength: 0,
      lamports: 0,
      solBalance: "0 SOL",
      executable: false,
      discriminatorHex: null,
      accountType: null,
      rawDataHex: null,
      rawJson: "Account does not exist (getAccountInfo returned null)",
    };
  }

  const ownerStr = accountInfo.owner.toBase58();
  const ownerLabel = KNOWN_PROGRAMS[ownerStr] ?? null;
  const dataLength = accountInfo.data.length;
  const discriminatorHex =
    dataLength >= 8 ? getDiscriminatorHex(accountInfo.data) : null;
  const accountType =
    dataLength >= 8 ? identifyAccountType(accountInfo.data) : null;
  const rawDataHex =
    dataLength > 0
      ? bytesToHex(accountInfo.data.slice(0, Math.min(256, dataLength)))
      : null;

  const lamports = accountInfo.lamports;
  const sol = lamports / LAMPORTS_PER_SOL;

  return {
    address: address.toBase58(),
    exists: true,
    owner: ownerStr,
    ownerLabel,
    dataLength,
    lamports,
    solBalance: `${sol} SOL`,
    executable: accountInfo.executable,
    discriminatorHex,
    accountType,
    rawDataHex,
    rawJson: JSON.stringify(
      {
        owner: ownerStr,
        ownerLabel,
        lamports,
        dataLength,
        executable: accountInfo.executable,
        discriminator: discriminatorHex,
        accountType,
      },
      null,
      2
    ),
  };
}

// ---------------------------------------------------------------------------
// Vault -> Multisig PDA Resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to find the multisig PDA by scanning the vault's transaction history
 * for Squads program instructions and extracting the multisig account.
 */
async function findMultisigFromVault(
  connection: Connection,
  vaultAddress: PublicKey,
  messages: string[],
  inspections: AccountInspection[]
): Promise<PublicKey | null> {
  messages.push(`Scanning transaction history to find multisig PDA...`);

  // Step 1: Get recent signatures for this vault address
  let signatures;
  try {
    signatures = await connection.getSignaturesForAddress(vaultAddress, {
      limit: 10,
    });
  } catch (err) {
    messages.push(
      `Failed to fetch transaction history: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }

  if (signatures.length === 0) {
    messages.push(`No transaction history found for this vault address.`);
    return null;
  }

  messages.push(
    `Found ${signatures.length} transaction(s) involving this vault.`
  );

  // Step 2: Fetch each transaction and look for Squads program references
  const squadsProgId = SQUADS_PROGRAM_ID;

  for (const sigInfo of signatures) {
    let tx;
    try {
      tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      continue;
    }

    if (!tx?.meta || !tx.transaction) continue;

    const message = tx.transaction.message;

    // Get all account keys (static + loaded via ALTs)
    const staticKeys = message.staticAccountKeys;
    const loadedWritable =
      tx.meta.loadedAddresses?.writable ?? [];
    const loadedReadonly =
      tx.meta.loadedAddresses?.readonly ?? [];
    const allKeys = [
      ...staticKeys,
      ...loadedWritable,
      ...loadedReadonly,
    ];

    // Find the Squads program in account keys
    const squadsProgIdx = allKeys.findIndex(
      (key) => key.toBase58() === squadsProgId
    );

    if (squadsProgIdx === -1) continue;

    const shortSig = sigInfo.signature.slice(0, 16);
    messages.push(
      `Transaction ${shortSig}... involves Squads program.`
    );

    // Step 3: Scan instructions for ones targeting the Squads program
    const compiledInstructions = message.compiledInstructions;

    for (const ix of compiledInstructions) {
      if (ix.programIdIndex !== squadsProgIdx) continue;

      // In Squads instructions, the multisig PDA is typically the first account
      if (ix.accountKeyIndexes.length === 0) continue;

      const candidateIdx = ix.accountKeyIndexes[0];
      const candidateKey =
        candidateIdx < allKeys.length ? allKeys[candidateIdx] : null;

      if (!candidateKey) continue;

      // Skip if the candidate is the vault itself or the Squads program
      if (
        candidateKey.equals(vaultAddress) ||
        candidateKey.toBase58() === squadsProgId
      ) {
        continue;
      }

      messages.push(
        `Candidate multisig PDA: ${candidateKey.toBase58()}`
      );

      // Step 4: Verify it's actually a Multisig account
      const candidateInspection = await inspectAccount(
        connection,
        candidateKey
      );
      inspections.push(candidateInspection);

      if (
        !candidateInspection.exists ||
        candidateInspection.accountType !== "Multisig"
      ) {
        messages.push(
          `Candidate is not a Multisig account (type: ${candidateInspection.accountType ?? "unknown"}). Skipping.`
        );
        continue;
      }

      messages.push(
        `Confirmed: ${candidateKey.toBase58()} is a Squads Multisig account.`
      );

      // Step 5: Verify vault derivation matches (try indices 0-9)
      let matchedVaultIndex = -1;
      for (let idx = 0; idx < 10; idx++) {
        try {
          const [derivedVault] = multisig.getVaultPda({
            multisigPda: candidateKey,
            index: idx,
          });
          if (derivedVault.equals(vaultAddress)) {
            matchedVaultIndex = idx;
            break;
          }
        } catch {
          // ignore derivation errors
        }
      }

      if (matchedVaultIndex >= 0) {
        messages.push(
          `Vault address matches derivation at vault index ${matchedVaultIndex}.`
        );
      } else {
        messages.push(
          `Note: Vault derivation check did not match indices 0-9, but account IS a verified Multisig.`
        );
      }

      return candidateKey;
    }
  }

  messages.push(
    `Could not find multisig PDA in transaction history.`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Smart Address Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve an input address to a Squads Multisig PDA.
 * Handles: direct multisig PDA, vault address, createKey, other Squads account types.
 * Always returns debug info regardless of success/failure.
 */
export async function resolveMultisigPda(
  connection: Connection,
  inputAddress: string,
  useCreateKey: boolean
): Promise<ResolveResult> {
  const inspections: AccountInspection[] = [];
  const messages: string[] = [];

  let inputPubkey: PublicKey;
  try {
    inputPubkey = new PublicKey(inputAddress);
  } catch {
    return {
      success: false,
      multisigPda: null,
      inputType: "unknown",
      inspections,
      messages: [`Invalid public key: "${inputAddress}"`],
      error: `"${inputAddress}" is not a valid Solana public key (base58 format).`,
    };
  }

  // -----------------------------------------------------------------------
  // Path A: createKey mode -- derive the multisig PDA
  // -----------------------------------------------------------------------
  if (useCreateKey) {
    messages.push(`Using createKey mode. Input createKey: ${inputAddress}`);

    const [derivedPda] = multisig.getMultisigPda({ createKey: inputPubkey });
    messages.push(`Derived multisig PDA: ${derivedPda.toBase58()}`);

    // Also derive vault PDAs for reference
    for (let vaultIdx = 0; vaultIdx < 3; vaultIdx++) {
      try {
        const [vaultPda] = multisig.getVaultPda({
          multisigPda: derivedPda,
          index: vaultIdx,
        });
        messages.push(`  Vault ${vaultIdx} PDA: ${vaultPda.toBase58()}`);
      } catch {
        // ignore
      }
    }

    messages.push(`Inspecting derived multisig PDA...`);
    const inspection = await inspectAccount(connection, derivedPda);
    inspections.push(inspection);

    if (!inspection.exists) {
      return {
        success: false,
        multisigPda: null,
        inputType: "createKey",
        inspections,
        messages: [
          ...messages,
          `Derived multisig PDA does not exist on-chain.`,
          `Either the createKey is wrong or this multisig hasn't been created yet on this cluster.`,
        ],
        error:
          `No Multisig account found at derived PDA ${derivedPda.toBase58()}. ` +
          `The createKey "${inputAddress}" may be incorrect, or the multisig may not exist on this cluster.`,
      };
    }

    if (inspection.accountType === "Multisig") {
      messages.push(`Confirmed: derived PDA is a Squads Multisig account.`);
      return {
        success: true,
        multisigPda: derivedPda,
        inputType: "createKey",
        inspections,
        messages,
        error: null,
      };
    }

    return {
      success: false,
      multisigPda: null,
      inputType: "createKey",
      inspections,
      messages: [
        ...messages,
        `Derived PDA exists but is NOT a Squads Multisig account.`,
        `Account type: ${inspection.accountType ?? "unknown"}`,
        `Owner: ${inspection.ownerLabel ?? inspection.owner}`,
      ],
      error:
        `Derived PDA ${derivedPda.toBase58()} is not a Squads Multisig account. ` +
        `Owner: ${inspection.ownerLabel ?? inspection.owner}. ` +
        `The createKey may be incorrect.`,
    };
  }

  // -----------------------------------------------------------------------
  // Path B: direct address mode -- detect what kind of account this is
  // -----------------------------------------------------------------------
  messages.push(`Direct address mode. Inspecting: ${inputAddress}`);
  const inspection = await inspectAccount(connection, inputPubkey);
  inspections.push(inspection);

  if (!inspection.exists) {
    return {
      success: false,
      multisigPda: null,
      inputType: "unknown",
      inspections,
      messages: [...messages, `Account does not exist on-chain.`],
      error:
        `Account not found at ${inputAddress}. ` +
        `Please verify the address is correct and exists on this cluster.`,
    };
  }

  const squadsProgId = SQUADS_PROGRAM_ID;

  // -----------------------------------------------------------------------
  // Case 1: Account is owned by Squads program
  // -----------------------------------------------------------------------
  if (inspection.owner === squadsProgId) {
    messages.push(`Account is owned by Squads Multisig v4 program.`);

    if (inspection.accountType === "Multisig") {
      messages.push(`Confirmed: this is a Squads Multisig account.`);
      return {
        success: true,
        multisigPda: inputPubkey,
        inputType: "multisig",
        inspections,
        messages,
        error: null,
      };
    }

    // It's some other Squads account -- try to extract the multisig field
    const accountType = inspection.accountType ?? "unknown";
    messages.push(
      `This is a Squads ${accountType} account, not the Multisig config account.`
    );

    if (
      ["VaultTransaction", "ConfigTransaction", "Proposal", "Batch"].includes(
        accountType
      )
    ) {
      const rawAccountInfo = await connection.getAccountInfo(inputPubkey);
      if (rawAccountInfo && rawAccountInfo.data.length >= 40) {
        const extractedMultisig = extractFirstPubkey(rawAccountInfo.data);
        if (extractedMultisig) {
          messages.push(
            `Extracted multisig PDA from ${accountType} data: ${extractedMultisig.toBase58()}`
          );
          messages.push(`Inspecting extracted multisig PDA...`);

          const multisigInspection = await inspectAccount(
            connection,
            extractedMultisig
          );
          inspections.push(multisigInspection);

          if (
            multisigInspection.exists &&
            multisigInspection.accountType === "Multisig"
          ) {
            messages.push(
              `Confirmed: extracted address is a Squads Multisig account. Auto-resolving.`
            );
            return {
              success: true,
              multisigPda: extractedMultisig,
              inputType: "squads-other",
              inspections,
              messages,
              error: null,
            };
          }

          messages.push(
            `Extracted address exists but is not a Multisig. Type: ${multisigInspection.accountType ?? "unknown"}`
          );
        }
      }
    }

    return {
      success: false,
      multisigPda: null,
      inputType: "squads-other",
      inspections,
      messages,
      error:
        `This address is a Squads ${accountType} account, not the Multisig config account. ` +
        `Please enter the Multisig PDA address instead. ` +
        `You can find it in the Squads app by checking transaction details.`,
    };
  }

  // -----------------------------------------------------------------------
  // Case 2: Account is owned by System Program (possible vault)
  // -----------------------------------------------------------------------
  const systemProgram = "11111111111111111111111111111111";
  if (inspection.owner === systemProgram) {
    messages.push(
      `Account is owned by the System Program (regular wallet or Squads vault).`
    );
    messages.push(`Balance: ${inspection.solBalance}`);
    messages.push(
      `This could be a Squads vault address. Vault addresses are different from the multisig PDA.`
    );

    // Attempt: try the vault-check API (may or may not have CORS)
    let isSquadsVault = false;
    try {
      messages.push(`Checking Squads vault API...`);
      const vaultCheckUrl = `https://4fnetmviidiqkjzenwxe66vgoa0soerr.lambda-url.us-east-1.on.aws/isSquad/${inputAddress}`;
      const resp = await fetch(vaultCheckUrl);
      if (resp.ok) {
        const data = await resp.json();
        messages.push(`Vault API response: ${JSON.stringify(data)}`);
        if (data.isSquad) {
          isSquadsVault = true;
          messages.push(
            `Confirmed by Squads API: this IS a Squads vault (${data.version}).`
          );
        } else {
          messages.push(`Squads API says this is NOT a Squads vault.`);
        }
      } else {
        messages.push(`Vault API returned status ${resp.status}.`);
      }
    } catch (err) {
      messages.push(
        `Vault API check failed (likely CORS): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Attempt: scan transaction history to find the multisig PDA
    const resolvedMultisig = await findMultisigFromVault(
      connection,
      inputPubkey,
      messages,
      inspections
    );

    if (resolvedMultisig) {
      messages.push(
        `Auto-resolved vault to multisig PDA: ${resolvedMultisig.toBase58()}`
      );
      return {
        success: true,
        multisigPda: resolvedMultisig,
        inputType: "vault",
        inspections,
        messages,
        error: null,
      };
    }

    // If auto-resolve failed, show guidance
    const vaultGuidance = isSquadsVault
      ? `This address IS a confirmed Squads vault, but we could not auto-resolve the multisig PDA. `
      : `This address might be a Squads vault or a regular wallet. `;

    return {
      success: false,
      multisigPda: null,
      inputType: "vault",
      inspections,
      messages,
      error:
        `${vaultGuidance}` +
        `The multisig PDA (config account) is a different address from the vault.\n\n` +
        `To find the multisig PDA:\n` +
        `1. Open the Squads app and go to any transaction\n` +
        `2. Look at the transaction details -- the "multisig" field contains the PDA address\n` +
        `3. Or check the Squads API: the "multisig" field in the response has the correct address\n` +
        `4. If you know the createKey, check "Use createKey" above and enter it\n\n` +
        `Tip: The multisig PDA is owned by the Squads program (${SQUADS_PROGRAM_ID}), ` +
        `while vault addresses are owned by the System Program.`,
    };
  }

  // -----------------------------------------------------------------------
  // Case 3: Account owned by another program
  // -----------------------------------------------------------------------
  const ownerLabel = inspection.ownerLabel ?? inspection.owner;
  messages.push(`Account is owned by: ${ownerLabel}`);

  return {
    success: false,
    multisigPda: null,
    inputType: "unknown",
    inspections,
    messages: [
      ...messages,
      `This account is not owned by the Squads program.`,
    ],
    error:
      `This account is owned by ${ownerLabel}, not the Squads Multisig v4 program. ` +
      `Please enter a valid Squads multisig PDA address.`,
  };
}

// ---------------------------------------------------------------------------
// Multisig Info Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch and deserialize a Multisig account that has already been validated.
 */
export async function fetchMultisigInfo(
  connection: Connection,
  multisigPda: PublicKey
): Promise<MultisigInfo> {
  const account = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  return {
    address: multisigPda,
    createKey: account.createKey,
    configAuthority: account.configAuthority,
    threshold: account.threshold,
    timeLock: account.timeLock,
    transactionIndex: toBigInt(account.transactionIndex),
    staleTransactionIndex: toBigInt(account.staleTransactionIndex),
    rentCollector: account.rentCollector ?? null,
    bump: account.bump,
    members: account.members.map((m) => ({
      key: m.key,
      permissionMask: m.permissions.mask,
    })),
  };
}

// ---------------------------------------------------------------------------
// Scan Range
// ---------------------------------------------------------------------------

export function computeScanRange(
  info: MultisigInfo,
  limit: number
): { fromIndex: bigint; toIndex: bigint } {
  const toIndex = info.transactionIndex;

  if (toIndex === 0n) {
    return { fromIndex: 0n, toIndex: 0n };
  }

  const staleStart = info.staleTransactionIndex + 1n;
  const limitStart =
    toIndex - BigInt(limit) + 1n > 0n ? toIndex - BigInt(limit) + 1n : 1n;

  const fromIndex = staleStart > limitStart ? staleStart : limitStart;

  return { fromIndex, toIndex };
}

// ---------------------------------------------------------------------------
// Transaction Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch transactions and their proposals in a given index range.
 * Handles reclaimed (closed) accounts gracefully.
 */
export async function fetchTransactionsWithProposals(
  connection: Connection,
  multisigPda: PublicKey,
  fromIndex: bigint,
  toIndex: bigint
): Promise<TransactionWithProposal[]> {
  if (fromIndex > toIndex || toIndex === 0n) {
    return [];
  }

  const indices: bigint[] = [];
  const txPdas: PublicKey[] = [];
  const proposalPdas: PublicKey[] = [];

  for (let i = fromIndex; i <= toIndex; i++) {
    indices.push(i);

    const [txPda] = multisig.getTransactionPda({
      multisigPda,
      index: i,
    });
    txPdas.push(txPda);

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: i,
    });
    proposalPdas.push(proposalPda);
  }

  // Batch fetch all accounts
  const allPdas = [...txPdas, ...proposalPdas];
  const accountInfos = await batchGetMultipleAccounts(connection, allPdas);

  const txAccountInfos = accountInfos.slice(0, txPdas.length);
  const proposalAccountInfos = accountInfos.slice(txPdas.length);

  const results: TransactionWithProposal[] = [];

  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const txAccountInfo = txAccountInfos[i];
    const proposalAccountInfo = proposalAccountInfos[i];

    let type: TransactionWithProposal["type"] = "unknown";
    let transaction: VaultTransactionInfo | ConfigTransactionInfo | null = null;
    let proposal: ProposalInfo | null = null;
    let reclaimed = false;

    // Deserialize transaction
    if (txAccountInfo?.data) {
      try {
        const data = txAccountInfo.data;

        if (matchesDiscriminator(data, DISCRIMINATOR_VAULT_TX)) {
          type = "vault";
          const [vt] =
            multisig.accounts.VaultTransaction.fromAccountInfo(txAccountInfo);
          transaction = parseVaultTransaction(vt);
        } else if (matchesDiscriminator(data, DISCRIMINATOR_CONFIG_TX)) {
          type = "config";
          const [ct] =
            multisig.accounts.ConfigTransaction.fromAccountInfo(txAccountInfo);
          transaction = parseConfigTransaction(ct);
        } else if (matchesDiscriminator(data, DISCRIMINATOR_BATCH)) {
          type = "batch";
          transaction = null;
        }
      } catch (err) {
        console.warn(
          `Failed to deserialize transaction at index ${index}:`,
          err
        );
      }
    } else {
      // Transaction account doesn't exist -- likely reclaimed after execution
      reclaimed = true;
    }

    // Deserialize proposal
    if (proposalAccountInfo?.data) {
      try {
        const [p] =
          multisig.accounts.Proposal.fromAccountInfo(proposalAccountInfo);
        proposal = parseProposal(p);
      } catch (err) {
        console.warn(
          `Failed to deserialize proposal at index ${index}:`,
          err
        );
      }
    }

    // Always include — the index exists based on the multisig's transactionIndex.
    // Even if both accounts are reclaimed (null), we show the entry.
    results.push({
      index,
      transactionPda: txPdas[i],
      proposalPda: proposalPdas[i],
      type,
      transaction,
      proposal,
      reclaimed,
    });
  }

  // Sort by index descending (newest first)
  results.sort((a, b) =>
    b.index > a.index ? 1 : b.index < a.index ? -1 : 0
  );

  return results;
}

export function isPending(tx: TransactionWithProposal): boolean {
  if (!tx.proposal) return !tx.reclaimed;
  return PENDING_STATUSES.includes(tx.proposal.status);
}

export function isCompleted(tx: TransactionWithProposal): boolean {
  if (!tx.proposal) return tx.reclaimed;
  return COMPLETED_STATUSES.includes(tx.proposal.status);
}

// ---------------------------------------------------------------------------
// Internal Parsers
// ---------------------------------------------------------------------------

function parseVaultTransaction(vt: any): VaultTransactionInfo {
  const msg = vt.message;
  return {
    type: "vault",
    creator: vt.creator,
    vaultIndex: vt.vaultIndex,
    ephemeralSignerBumps: vt.ephemeralSignerBumps,
    message: {
      numSigners: msg.numSigners,
      numWritableSigners: msg.numWritableSigners,
      numWritableNonSigners: msg.numWritableNonSigners,
      accountKeys: msg.accountKeys,
      instructions: msg.instructions.map((ix: any) => ({
        programIdIndex: ix.programIdIndex,
        accountIndexes: Array.from(ix.accountIndexes),
        data:
          ix.data instanceof Uint8Array ? ix.data : new Uint8Array(ix.data),
      })),
      addressTableLookups: (msg.addressTableLookups || []).map((alt: any) => ({
        accountKey: alt.accountKey,
        writableIndexes: Array.from(alt.writableIndexes),
        readonlyIndexes: Array.from(alt.readonlyIndexes),
      })),
    },
  };
}

function parseConfigTransaction(ct: any): ConfigTransactionInfo {
  return {
    type: "config",
    creator: ct.creator,
    actions: ct.actions.map((action: any) => parseConfigAction(action)),
  };
}

function parseConfigAction(action: any): ConfigActionInfo {
  const kind: string = action.__kind;
  const details: Record<string, string> = {};
  let description = kind;

  switch (kind) {
    case "AddMember":
      description = "Add Member";
      details["Member"] = action.newMember.key.toBase58();
      details["Permissions"] = action.newMember.permissions.mask.toString();
      break;
    case "RemoveMember":
      description = "Remove Member";
      details["Member"] = action.oldMember.toBase58();
      break;
    case "ChangeThreshold":
      description = "Change Threshold";
      details["New Threshold"] = action.newThreshold.toString();
      break;
    case "SetTimeLock":
      description = "Set Time Lock";
      details["New Time Lock"] = `${action.newTimeLock}s`;
      break;
    case "AddSpendingLimit":
      description = "Add Spending Limit";
      details["Mint"] = action.mint.toBase58();
      details["Amount"] = action.amount.toString();
      details["Vault Index"] = action.vaultIndex.toString();
      break;
    case "RemoveSpendingLimit":
      description = "Remove Spending Limit";
      details["Spending Limit"] = action.spendingLimit.toBase58();
      break;
    case "SetRentCollector":
      description = "Set Rent Collector";
      details["Rent Collector"] = action.newRentCollector
        ? action.newRentCollector.toBase58()
        : "None";
      break;
  }

  return { kind, description, details };
}

function parseProposal(p: any): ProposalInfo {
  const status: ProposalStatusKind = p.status.__kind;
  let timestamp: bigint | null = null;

  if (p.status.timestamp !== undefined) {
    timestamp = toBigInt(p.status.timestamp);
  }

  return {
    status,
    timestamp,
    approved: p.approved,
    rejected: p.rejected,
    cancelled: p.cancelled,
  };
}

// ---------------------------------------------------------------------------
// Batch RPC Helper
// ---------------------------------------------------------------------------

async function batchGetMultipleAccounts(
  connection: Connection,
  addresses: PublicKey[]
): Promise<(AccountInfo<Buffer> | null)[]> {
  const results: (AccountInfo<Buffer> | null)[] = [];

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const infos = await connection.getMultipleAccountsInfo(batch);
    results.push(...infos);
  }

  return results;
}
