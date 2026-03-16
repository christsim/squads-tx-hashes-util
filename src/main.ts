// ============================================================================
// Squads TX Hashes - Main Entry Point
// ============================================================================
//
// Wires the UI to the data-fetching and display modules.
// ============================================================================

import "./styles.css";

import { Connection, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  resolveMultisigPda,
  fetchMultisigInfo,
  fetchTransactionsWithProposals,
  computeScanRange,
  type MultisigInfo,
  type TransactionWithProposal,
} from "./accounts";
import {
  hashRawMessage,
} from "./hashes";
import {
  lookupApprovalHashes,
} from "./verify";
import {
  decodeMessage,
  hexToBytes,
  base64ToBytes,
} from "./decoder";
import {
  initTabs,
  initCreateKeyToggle,
  getFormValues,
  showLoading,
  hideLoading,
  showError,
  hideError,
  showResults,
  clearResults,
  clearDebugInfo,
  renderDebugInfo,
  renderMultisigInfo,
  renderTransactionList,
  renderTransactionDetail,
  renderLookupApprovalsButton,
  renderApprovalResults,
  renderDecodedMessage,
} from "./display";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentState: {
  connection: Connection;
  multisigPda: PublicKey;
  multisigInfo: MultisigInfo;
  transactions: TransactionWithProposal[];
} | null = null;

// ---------------------------------------------------------------------------
// Event Handlers — Online Mode
// ---------------------------------------------------------------------------

async function handleLoadMultisig(): Promise<void> {
  hideError();
  clearResults();
  clearDebugInfo();

  const values = getFormValues();
  if (!values) return;

  showLoading();

  try {
    const connection = new Connection(values.rpcUrl, "confirmed");

    const resolveResult = await resolveMultisigPda(
      connection,
      values.address,
      values.useCreateKey
    );

    renderDebugInfo(
      resolveResult.inspections,
      resolveResult.messages,
      resolveResult.inputType
    );

    if (!resolveResult.success || !resolveResult.multisigPda) {
      showError(resolveResult.error ?? "Could not resolve multisig address.");
      hideLoading();
      return;
    }

    const multisigPda = resolveResult.multisigPda;

    if (
      resolveResult.inputType !== "multisig" &&
      resolveResult.inputType !== "createKey"
    ) {
      resolveResult.messages.push(
        `Auto-resolved to multisig PDA: ${multisigPda.toBase58()}`
      );
      renderDebugInfo(
        resolveResult.inspections,
        resolveResult.messages,
        resolveResult.inputType
      );
    }

    const multisigInfo = await fetchMultisigInfo(connection, multisigPda);

    const { fromIndex, toIndex } = computeScanRange(
      multisigInfo,
      values.limit
    );

    let transactions: TransactionWithProposal[] = [];
    if (fromIndex <= toIndex && toIndex > 0n) {
      transactions = await fetchTransactionsWithProposals(
        connection,
        multisigPda,
        fromIndex,
        toIndex
      );
    }

    currentState = {
      connection,
      multisigPda,
      multisigInfo,
      transactions,
    };

    // Derive vault PDA (index 0) for Squads app link
    let vaultPda: string | undefined;
    try {
      const [vaultPdaKey] = multisig.getVaultPda({
        multisigPda,
        index: 0,
      });
      vaultPda = vaultPdaKey.toBase58();
    } catch {
      // ignore derivation errors
    }

    renderMultisigInfo(multisigInfo, vaultPda);
    renderTransactionList(
      transactions,
      multisigInfo.threshold,
      handleSelectTransaction
    );
    showResults();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    showError(message);
  } finally {
    hideLoading();
  }
}

function handleSelectTransaction(tx: TransactionWithProposal): void {
  if (!currentState) return;

  renderTransactionDetail(tx, currentState.multisigInfo.threshold);

  // Show "Lookup Approval Hashes" button for transactions with approvers
  if (tx.proposal && tx.proposal.approved.length > 0) {
    renderLookupApprovalsButton(tx, handleLookupApprovals);
  }
}

// ---------------------------------------------------------------------------
// Event Handlers — Approval Lookup
// ---------------------------------------------------------------------------

async function handleLookupApprovals(proposalPda: PublicKey): Promise<void> {
  if (!currentState) return;
  hideError();

  try {
    const results = await lookupApprovalHashes(
      currentState.connection,
      proposalPda
    );
    renderApprovalResults(results);
  } catch (err) {
    showError(
      `Failed to lookup approval hashes: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Event Handlers — Decode Serialized Message (Offline)
// ---------------------------------------------------------------------------

let currentDecodeFormat: "hex" | "base64" = "hex";

async function handleDecodeMessage(): Promise<void> {
  hideError();

  // Clear previous output immediately
  const resultEl = document.getElementById("decode-result");
  if (resultEl) {
    resultEl.innerHTML = "";
    resultEl.classList.add("hidden");
  }

  const inputEl = document.getElementById(
    "decode-input"
  ) as HTMLTextAreaElement | null;
  if (!inputEl) return;

  const input = inputEl.value.trim();
  if (!input) {
    showError("Please paste serialized message bytes.");
    return;
  }

  try {
    // Convert input to bytes
    let messageBytes: Uint8Array;
    if (currentDecodeFormat === "hex") {
      messageBytes = hexToBytes(input);
    } else {
      messageBytes = base64ToBytes(input);
    }

    if (messageBytes.length === 0) {
      showError("Input decoded to 0 bytes. Check the format.");
      return;
    }

    // Decode the message structure
    const decoded = decodeMessage(messageBytes);

    // Compute hash
    const hash = await hashRawMessage(messageBytes);

    // Render
    renderDecodedMessage(decoded, hash);
  } catch (err) {
    showError(
      `Decode failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init(): void {
  const versionEl = document.getElementById("app-version");
  if (versionEl) {
    versionEl.textContent = import.meta.env.VITE_APP_VERSION || "dev";
  }

  initTabs();
  initCreateKeyToggle();

  // Wire online form
  const onlineForm = document.getElementById(
    "online-form"
  ) as HTMLFormElement | null;
  if (onlineForm) {
    onlineForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleLoadMultisig();
    });
  }

  // Wire decode button
  const decodeBtn = document.getElementById(
    "decode-btn"
  ) as HTMLButtonElement | null;
  if (decodeBtn) {
    decodeBtn.addEventListener("click", handleDecodeMessage);
  }

  // Wire format toggle buttons
  const hexBtn = document.getElementById(
    "decode-fmt-hex"
  ) as HTMLButtonElement | null;
  const b64Btn = document.getElementById(
    "decode-fmt-base64"
  ) as HTMLButtonElement | null;
  if (hexBtn && b64Btn) {
    hexBtn.addEventListener("click", () => {
      currentDecodeFormat = "hex";
      hexBtn.classList.add("active");
      b64Btn.classList.remove("active");
    });
    b64Btn.addEventListener("click", () => {
      currentDecodeFormat = "base64";
      b64Btn.classList.add("active");
      hexBtn.classList.remove("active");
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
