// ============================================================================
// Squads TX Hashes - Display / UI Rendering
// ============================================================================
//
// Pure DOM manipulation layer. No business logic.
// ============================================================================

import { PublicKey } from "@solana/web3.js";
import { formatPermissions, getProgramLabel, bytesToHex, KNOWN_PROGRAMS, getTokenInfo } from "./constants";
import {
  type MultisigInfo,
  type TransactionWithProposal,
  type ProposalStatusKind,
  type VaultTransactionInfo,
  type ConfigTransactionInfo,
  type AccountInspection,
  isPending,
  isCompleted,
} from "./accounts";
import { type TransactionVerifyResult } from "./verify";
import {
  type DecodedMessage,
  type DecodedInnerInstruction,
  type TransactionSummary,
  type InstructionSafety,
  generateTransactionSummary,
} from "./decoder";

// ---------------------------------------------------------------------------
// DOM Helpers
// ---------------------------------------------------------------------------

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function el(
  tag: string,
  className?: string,
  text?: string
): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function clear(element: HTMLElement): void {
  element.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Address Formatting
// ---------------------------------------------------------------------------

export function truncateAddress(pubkey: PublicKey | string, chars: number = 4): string {
  const addr = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

function fullAddress(pubkey: PublicKey | string): string {
  return typeof pubkey === "string" ? pubkey : pubkey.toBase58();
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

function createCopyButton(text: string): HTMLElement {
  const btn = el("button", "copy-btn", "Copy");
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1500);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1500);
    }
  });
  return btn;
}

// ---------------------------------------------------------------------------
// Loading / Error / Results Visibility
// ---------------------------------------------------------------------------

export function showLoading(): void {
  $("loading").classList.remove("hidden");
  $("error").classList.add("hidden");
  $("results").classList.add("hidden");
  const btn = document.getElementById("load-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
}

export function hideLoading(): void {
  $("loading").classList.add("hidden");
  const btn = document.getElementById("load-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = false;
}

export function showError(message: string): void {
  const errEl = $("error");
  errEl.innerHTML = "";
  // Support multiline error messages (split by \n)
  const lines = message.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) errEl.appendChild(document.createElement("br"));
    errEl.appendChild(document.createTextNode(lines[i]));
  }
  errEl.classList.remove("hidden");
}

export function hideError(): void {
  $("error").classList.add("hidden");
}

export function showResults(): void {
  $("results").classList.remove("hidden");
}

export function clearResults(): void {
  clear($("multisig-info"));
  clear($("transaction-list"));
  clear($("transaction-detail"));
  $("results").classList.add("hidden");
  clearDebugInfo();
}

export function clearDebugInfo(): void {
  const debugEl = $("debug-info");
  clear(debugEl);
  debugEl.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Debug Info
// ---------------------------------------------------------------------------

export function renderDebugInfo(
  inspections: AccountInspection[],
  messages: string[],
  inputType: string
): void {
  const container = $("debug-info");
  clear(container);

  // Use <details> for collapsible, collapsed by default
  const details = document.createElement("details");
  details.className = "debug-card";

  const summary = document.createElement("summary");
  summary.textContent = "Debug Info";
  details.appendChild(summary);

  const content = el("div", "debug-content");

  // Input type
  content.appendChild(createDebugRow("Input Type", inputType));

  // Resolution log
  if (messages.length > 0) {
    content.appendChild(el("h3", undefined, "Resolution Log"));
    const msgList = el("ul", "debug-messages");
    for (const msg of messages) {
      const li = el("li", undefined, msg);
      msgList.appendChild(li);
    }
    content.appendChild(msgList);
  }

  // Account inspections
  for (const insp of inspections) {
    content.appendChild(el("h3", undefined, `Account: ${insp.address}`));

    const inspBlock = el("div", "debug-inspection");

    inspBlock.appendChild(createDebugRow("Address", insp.address));
    inspBlock.appendChild(createDebugRow("Exists", insp.exists ? "Yes" : "No"));

    if (insp.exists) {
      inspBlock.appendChild(
        createDebugRow(
          "Owner",
          insp.ownerLabel
            ? `${insp.ownerLabel} (${insp.owner})`
            : insp.owner ?? "unknown"
        )
      );
      inspBlock.appendChild(
        createDebugRow("Data Length", `${insp.dataLength} bytes`)
      );
      inspBlock.appendChild(
        createDebugRow(
          "Lamports",
          `${insp.lamports.toLocaleString()} (${insp.solBalance})`
        )
      );
      inspBlock.appendChild(
        createDebugRow("Executable", insp.executable ? "Yes" : "No")
      );

      if (insp.discriminatorHex) {
        inspBlock.appendChild(
          createDebugRow("Discriminator", insp.discriminatorHex)
        );
      }
      if (insp.accountType) {
        inspBlock.appendChild(
          createDebugRow("Account Type", insp.accountType)
        );
      }

      // Raw data hex
      if (insp.rawDataHex) {
        const rawTitle = el(
          "h4",
          undefined,
          `Raw Data (first ${Math.min(256, insp.dataLength)} bytes)`
        );
        rawTitle.style.fontSize = "0.75rem";
        rawTitle.style.marginTop = "8px";
        rawTitle.style.color = "#92400e";
        inspBlock.appendChild(rawTitle);
        inspBlock.appendChild(el("div", "debug-raw", insp.rawDataHex));
      }
    }

    // Raw JSON
    const jsonTitle = el("h4", undefined, "Account Summary JSON");
    jsonTitle.style.fontSize = "0.75rem";
    jsonTitle.style.marginTop = "8px";
    jsonTitle.style.color = "#92400e";
    inspBlock.appendChild(jsonTitle);
    inspBlock.appendChild(el("div", "debug-raw", insp.rawJson));

    content.appendChild(inspBlock);
  }

  details.appendChild(content);
  container.appendChild(details);
  container.classList.remove("hidden");
}

function createDebugRow(label: string, value: string): HTMLElement {
  const row = el("div", "debug-row");
  row.appendChild(el("span", "debug-label", label));
  row.appendChild(el("span", "debug-value", value));
  return row;
}

// ---------------------------------------------------------------------------
// Tab Management
// ---------------------------------------------------------------------------

export function initTabs(): void {
  const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Deactivate all
      tabButtons.forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll<HTMLElement>(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Activate clicked
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      if (tabId) {
        $(tabId).classList.add("active");
      }

      clearResults();
      hideError();
    });
  });
}

// ---------------------------------------------------------------------------
// CreateKey Toggle
// ---------------------------------------------------------------------------

export function initCreateKeyToggle(): void {
  const checkbox = $("use-create-key") as HTMLInputElement;
  const label = $("address-label");
  const input = $("multisig-address") as HTMLInputElement;

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      label.textContent = "Create Key";
      input.placeholder = "Enter createKey public key";
    } else {
      label.textContent = "Multisig Address";
      input.placeholder = "Enter multisig PDA address";
    }
  });
}

// ---------------------------------------------------------------------------
// Form Values
// ---------------------------------------------------------------------------

export interface FormValues {
  rpcUrl: string;
  address: string;
  useCreateKey: boolean;
  limit: number;
}

export function getFormValues(): FormValues | null {
  const rpcUrl = ($("rpc-url") as HTMLInputElement).value.trim();
  if (!rpcUrl) {
    showError("Please enter a Solana RPC URL.");
    return null;
  }

  // Basic URL validation
  try {
    new URL(rpcUrl);
  } catch {
    showError("Invalid RPC URL format. Please enter a valid URL (e.g., https://solana-rpc.publicnode.com).");
    return null;
  }

  const address = ($("multisig-address") as HTMLInputElement).value.trim();
  if (!address) {
    showError("Please enter an address.");
    return null;
  }

  // Basic base58 validation
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    showError("Invalid Solana address format. Expected a base58-encoded public key.");
    return null;
  }

  const useCreateKey = ($("use-create-key") as HTMLInputElement).checked;

  const limitInput = ($("tx-limit") as HTMLInputElement).value;
  const limit = parseInt(limitInput, 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    showError("Transaction limit must be between 1 and 100.");
    return null;
  }

  return { rpcUrl, address, useCreateKey, limit };
}

// ---------------------------------------------------------------------------
// Render: Multisig Info
// ---------------------------------------------------------------------------

export function renderMultisigInfo(
  info: MultisigInfo,
  vaultPda?: string
): void {
  const container = $("multisig-info");
  clear(container);

  const card = el("div", "info-card");

  // Title
  card.appendChild(el("h2", undefined, "Multisig Info"));

  // Squads App Link
  if (vaultPda) {
    const squadsLink = document.createElement("a");
    squadsLink.href = `https://app.squads.so/squads/${vaultPda}/home`;
    squadsLink.target = "_blank";
    squadsLink.rel = "noopener";
    squadsLink.className = "explorer-link";
    squadsLink.textContent = "Open in Squads App";
    squadsLink.style.display = "block";
    squadsLink.style.marginBottom = "12px";
    squadsLink.style.fontSize = "0.85rem";
    card.appendChild(squadsLink);
  }

  // Address
  const addressRow = createInfoRow("Address", fullAddress(info.address));
  addressRow
    .querySelector(".info-value")!
    .appendChild(createCopyButton(fullAddress(info.address)));
  card.appendChild(addressRow);

  // Create Key
  card.appendChild(
    createInfoRow("Create Key", fullAddress(info.createKey))
  );

  // Config Authority
  const configAuth = PublicKey.default.equals(info.configAuthority)
    ? "None (autonomous)"
    : fullAddress(info.configAuthority);
  card.appendChild(createInfoRow("Config Authority", configAuth));

  // Threshold
  const voterCount = info.members.filter((m) => m.permissionMask & 2).length;
  card.appendChild(
    createInfoRow("Threshold", `${info.threshold} of ${voterCount} voters`)
  );

  // Time Lock
  const timeLockStr =
    info.timeLock === 0 ? "None" : formatTimeLock(info.timeLock);
  card.appendChild(createInfoRow("Time Lock", timeLockStr));

  // Transaction Index
  card.appendChild(
    createInfoRow("Transaction Index", info.transactionIndex.toString())
  );

  // Stale Transaction Index
  card.appendChild(
    createInfoRow("Stale After Index", info.staleTransactionIndex.toString())
  );

  // Rent Collector
  if (info.rentCollector) {
    card.appendChild(
      createInfoRow("Rent Collector", fullAddress(info.rentCollector))
    );
  }

  // Members Table
  const membersTitle = el("h3", undefined, `Members (${info.members.length})`);
  membersTitle.style.marginTop = "16px";
  membersTitle.style.marginBottom = "8px";
  membersTitle.style.fontSize = "0.9rem";
  card.appendChild(membersTitle);
  card.appendChild(renderMembersTable(info.members));

  container.appendChild(card);
}

function createInfoRow(label: string, value: string): HTMLElement {
  const row = el("div", "info-row");

  const labelEl = el("span", "info-label", label);
  const valueEl = el("span", "info-value mono", value);

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function renderMembersTable(
  members: { key: PublicKey; permissionMask: number }[]
): HTMLElement {
  const table = document.createElement("table");
  table.className = "members-table";

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const thKey = document.createElement("th");
  thKey.textContent = "Public Key";
  const thPerms = document.createElement("th");
  thPerms.textContent = "Permissions";
  headerRow.appendChild(thKey);
  headerRow.appendChild(thPerms);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  for (const member of members) {
    const tr = document.createElement("tr");

    const tdKey = document.createElement("td");
    tdKey.className = "mono";
    const keySpan = el("span", undefined, truncateAddress(member.key, 6));
    keySpan.title = fullAddress(member.key);
    keySpan.style.cursor = "help";
    tdKey.appendChild(keySpan);
    tdKey.appendChild(createCopyButton(fullAddress(member.key)));

    const tdPerms = document.createElement("td");
    const perms = formatPermissions(member.permissionMask);
    for (const perm of perms) {
      const badge = el("span", "permission-badge", perm);
      badge.classList.add(`permission-${perm.toLowerCase()}`);
      tdPerms.appendChild(badge);
    }

    tr.appendChild(tdKey);
    tr.appendChild(tdPerms);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  return table;
}

function formatTimeLock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return `${seconds}s (${parts.join(" ")})`;
}

// ---------------------------------------------------------------------------
// Render: Transaction List
// ---------------------------------------------------------------------------

export function renderTransactionList(
  transactions: TransactionWithProposal[],
  threshold: number,
  onSelect: (tx: TransactionWithProposal) => void
): void {
  const container = $("transaction-list");
  clear(container);

  if (transactions.length === 0) {
    container.appendChild(
      el("div", "no-transactions", "No transactions found in the scanned range.")
    );
    return;
  }

  const card = el("div", "info-card");
  card.appendChild(el("h2", undefined, "Transactions"));

  // Split into pending and completed
  const pending = transactions.filter(isPending);
  const completed = transactions.filter(isCompleted);
  // Anything not pending or completed (e.g., no proposal, "unknown")
  const other = transactions.filter((t) => !isPending(t) && !isCompleted(t));

  if (pending.length > 0) {
    card.appendChild(
      el("div", "tx-group-header", `Pending (${pending.length})`)
    );
    const list = el("div", "tx-list");
    for (const tx of pending) {
      list.appendChild(renderTransactionRow(tx, threshold, onSelect));
    }
    card.appendChild(list);
  }

  if (completed.length > 0) {
    card.appendChild(
      el("div", "tx-group-header", `Completed (${completed.length})`)
    );
    const list = el("div", "tx-list");
    for (const tx of completed) {
      list.appendChild(renderTransactionRow(tx, threshold, onSelect));
    }
    card.appendChild(list);
  }

  if (other.length > 0) {
    card.appendChild(
      el("div", "tx-group-header", `Other (${other.length})`)
    );
    const list = el("div", "tx-list");
    for (const tx of other) {
      list.appendChild(renderTransactionRow(tx, threshold, onSelect));
    }
    card.appendChild(list);
  }

  container.appendChild(card);
}

function renderTransactionRow(
  tx: TransactionWithProposal,
  threshold: number,
  onSelect: (tx: TransactionWithProposal) => void
): HTMLElement {
  const row = el("div", "tx-row");

  // Index
  row.appendChild(el("span", "tx-index", `#${tx.index.toString()}`));

  // Type badge
  row.appendChild(el("span", "tx-type", tx.type));

  // Status badge
  const status = tx.proposal?.status ?? "Draft";
  const statusBadge = el("span", "status-badge", status);
  statusBadge.classList.add(`status-${status.toLowerCase()}`);
  row.appendChild(statusBadge);

  // Reclaimed badge
  if (tx.reclaimed) {
    const reclaimedBadge = el("span", "status-badge", "Reclaimed");
    reclaimedBadge.classList.add("status-reclaimed");
    row.appendChild(reclaimedBadge);
  }

  // Creator (from transaction data if available)
  const creator = getCreator(tx);
  if (creator) {
    row.appendChild(el("span", "tx-creator", truncateAddress(creator, 4)));
  }

  // Approval progress
  const approved = tx.proposal?.approved.length ?? 0;
  row.appendChild(
    el("span", "tx-approval", `${approved}/${threshold} approved`)
  );

  // Click handler
  row.addEventListener("click", () => {
    // Remove selection from all rows
    document
      .querySelectorAll<HTMLElement>(".tx-row")
      .forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
    onSelect(tx);
  });

  return row;
}

function getCreator(tx: TransactionWithProposal): PublicKey | null {
  if (tx.transaction) {
    return tx.transaction.creator;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Render: Transaction Detail
// ---------------------------------------------------------------------------

export function renderTransactionDetail(
  tx: TransactionWithProposal,
  threshold: number
): void {
  const container = $("transaction-detail");
  clear(container);

  const card = el("div", "detail-card");

  // Title
  card.appendChild(
    el("h2", undefined, `Transaction #${tx.index.toString()} Details`)
  );

  // PDAs
  card.appendChild(createInfoRow("Transaction PDA", fullAddress(tx.transactionPda)));
  card.appendChild(createInfoRow("Proposal PDA", fullAddress(tx.proposalPda)));
  card.appendChild(createInfoRow("Type", tx.type.toUpperCase()));

  // Proposal Status
  if (tx.proposal) {
    renderProposalSection(card, tx.proposal, threshold);
  } else {
    card.appendChild(
      el("p", undefined, "No proposal account found (not yet created or closed).")
    );
  }

  // Transaction Content
  if (tx.reclaimed && !tx.transaction) {
    const reclaimedMsg = el("div", "instruction-block");
    reclaimedMsg.appendChild(
      el("h4", undefined, "Transaction Data Reclaimed")
    );
    reclaimedMsg.appendChild(
      el(
        "p",
        undefined,
        "The on-chain transaction account has been closed (reclaimed) after execution. " +
          "Transaction data is no longer available on-chain. " +
          "Proposal data (votes, status) may still be available above."
      )
    );
    card.appendChild(reclaimedMsg);
  } else if (tx.transaction) {
    if (tx.transaction.type === "vault") {
      renderVaultTransactionSection(card, tx.transaction as VaultTransactionInfo);
    } else if (tx.transaction.type === "config") {
      renderConfigTransactionSection(card, tx.transaction as ConfigTransactionInfo);
    }
  }

  container.appendChild(card);

  // Scroll into view
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderProposalSection(
  card: HTMLElement,
  proposal: {
    status: ProposalStatusKind;
    timestamp: bigint | null;
    approved: PublicKey[];
    rejected: PublicKey[];
    cancelled: PublicKey[];
  },
  threshold: number
): void {
  card.appendChild(el("h3", undefined, "Proposal Status"));

  // Status + timestamp
  const statusRow = el("div", "info-row");
  const statusBadge = el("span", "status-badge", proposal.status);
  statusBadge.classList.add(`status-${proposal.status.toLowerCase()}`);
  statusRow.appendChild(el("span", "info-label", "Status"));
  const statusValue = el("span", "info-value");
  statusValue.appendChild(statusBadge);
  if (proposal.timestamp !== null) {
    const date = new Date(Number(proposal.timestamp) * 1000);
    const timeStr = el("span", undefined, ` (${date.toISOString()})`);
    timeStr.style.fontSize = "0.78rem";
    timeStr.style.color = "#888";
    statusValue.appendChild(timeStr);
  }
  statusRow.appendChild(statusValue);
  card.appendChild(statusRow);

  // Approval progress
  card.appendChild(
    createInfoRow(
      "Approvals",
      `${proposal.approved.length} of ${threshold} required`
    )
  );

  // Approved by
  if (proposal.approved.length > 0) {
    card.appendChild(el("h3", undefined, "Approved By"));
    card.appendChild(renderVoteList(proposal.approved));
  }

  // Rejected by
  if (proposal.rejected.length > 0) {
    card.appendChild(el("h3", undefined, "Rejected By"));
    card.appendChild(renderVoteList(proposal.rejected));
  }

  // Cancelled by
  if (proposal.cancelled.length > 0) {
    card.appendChild(el("h3", undefined, "Cancelled By"));
    card.appendChild(renderVoteList(proposal.cancelled));
  }
}

function renderVoteList(keys: PublicKey[]): HTMLElement {
  const list = el("div", "vote-list");
  for (const key of keys) {
    const voteEl = el("span", "vote-key", truncateAddress(key, 6));
    voteEl.title = fullAddress(key);
    list.appendChild(voteEl);
  }
  return list;
}

function renderVaultTransactionSection(
  card: HTMLElement,
  vt: VaultTransactionInfo
): void {
  card.appendChild(el("h3", undefined, "Vault Transaction"));

  card.appendChild(
    createInfoRow("Creator", fullAddress(vt.creator))
  );
  card.appendChild(createInfoRow("Vault Index", vt.vaultIndex.toString()));
  card.appendChild(
    createInfoRow("Instructions", vt.message.instructions.length.toString())
  );
  card.appendChild(
    createInfoRow("Account Keys", vt.message.accountKeys.length.toString())
  );
  card.appendChild(
    createInfoRow("Signers", vt.message.numSigners.toString())
  );

  if (vt.message.addressTableLookups.length > 0) {
    card.appendChild(
      createInfoRow(
        "Address Table Lookups",
        vt.message.addressTableLookups.length.toString()
      )
    );
  }

  // Instructions
  for (let i = 0; i < vt.message.instructions.length; i++) {
    const ix = vt.message.instructions[i];
    const block = el("div", "instruction-block");

    block.appendChild(el("h4", undefined, `Instruction ${i + 1}`));

    // Program ID
    const programKey = vt.message.accountKeys[ix.programIdIndex];
    const programAddr = programKey ? fullAddress(programKey) : null;
    const knownLabel = programAddr ? getProgramLabel(programAddr) : null;
    const programDisplay = knownLabel
      ? `${knownLabel} (${programAddr})`
      : programAddr ?? `Index ${ix.programIdIndex}`;
    const programRow = createInfoRow("Program", programDisplay);
    if (programAddr) {
      programRow
        .querySelector(".info-value")!
        .appendChild(createCopyButton(programAddr));
    }
    block.appendChild(programRow);

    // Account keys used
    if (ix.accountIndexes.length > 0) {
      block.appendChild(
        el("h4", undefined, `Accounts (${ix.accountIndexes.length})`)
      );
      const accountList = el("ul", "account-list");
      for (const accIdx of ix.accountIndexes) {
        const accKey = vt.message.accountKeys[accIdx];
        const li = document.createElement("li");
        if (accKey) {
          li.textContent = fullAddress(accKey);
          li.title = `Index ${accIdx}`;
        } else {
          li.textContent = `Index ${accIdx} (lookup table)`;
        }
        accountList.appendChild(li);
      }
      block.appendChild(accountList);
    }

    // Data
    if (ix.data.length > 0) {
      block.appendChild(el("h4", undefined, `Data (${ix.data.length} bytes)`));
      const dataHex = el(
        "div",
        "data-hex",
        bytesToHex(ix.data)
      );
      block.appendChild(dataHex);
    } else {
      block.appendChild(el("h4", undefined, "Data (empty)"));
    }

    card.appendChild(block);
  }
}

function renderConfigTransactionSection(
  card: HTMLElement,
  ct: ConfigTransactionInfo
): void {
  card.appendChild(el("h3", undefined, "Config Transaction"));
  card.appendChild(createInfoRow("Creator", fullAddress(ct.creator)));
  card.appendChild(
    createInfoRow("Actions", ct.actions.length.toString())
  );

  for (let i = 0; i < ct.actions.length; i++) {
    const action = ct.actions[i];
    const block = el("div", "instruction-block");

    block.appendChild(
      el("h4", undefined, `Action ${i + 1}: ${action.description}`)
    );

    for (const [key, value] of Object.entries(action.details)) {
      block.appendChild(createInfoRow(key, value));
    }

    card.appendChild(block);
  }
}

// ---------------------------------------------------------------------------
// Render: Lookup Approval Hashes Button
// ---------------------------------------------------------------------------

export function renderLookupApprovalsButton(
  tx: TransactionWithProposal,
  onLookup: (proposalPda: PublicKey) => void
): void {
  const container = $("approval-hashes");
  clear(container);
  container.classList.remove("hidden");

  const card = el("div", "info-card");
  card.appendChild(
    el(
      "h2",
      undefined,
      `Approval Hashes — TX #${tx.index.toString()}`
    )
  );
  card.appendChild(
    el(
      "p",
      "form-hint",
      "Look up all on-chain approval/rejection transactions for this proposal and compute their message hashes."
    )
  );

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Lookup Approval Hashes";
  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = "Looking up...";
    onLookup(tx.proposalPda);
  });
  card.appendChild(btn);

  container.appendChild(card);
}

// ---------------------------------------------------------------------------
// Render: Approval Hashes Results Table
// ---------------------------------------------------------------------------

export function renderApprovalResults(
  results: TransactionVerifyResult[]
): void {
  const container = $("approval-hashes");
  clear(container);
  container.classList.remove("hidden");

  const card = el("div", "info-card");
  card.appendChild(el("h2", undefined, "Approval Transaction Hashes"));

  if (results.length === 0) {
    card.appendChild(
      el(
        "p",
        "no-transactions",
        "No approval or rejection transactions found on-chain for this proposal."
      )
    );
    container.appendChild(card);
    return;
  }

  card.appendChild(
    el(
      "p",
      "form-hint",
      `Found ${results.length} approval/rejection transaction(s).`
    )
  );

  // Table
  const table = document.createElement("table");
  table.className = "approval-table";

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const h of [
    "Type",
    "Approver",
    "Message Hash",
    "Blockhash",
    "Signature",
    "Time",
  ]) {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  for (const r of results) {
    const tr = document.createElement("tr");

    // Type
    const tdType = document.createElement("td");
    const typeBadge = el(
      "span",
      "status-badge",
      r.isApproval ? "Approve" : "Reject"
    );
    typeBadge.classList.add(
      r.isApproval ? "status-approved" : "status-rejected"
    );
    tdType.appendChild(typeBadge);
    tr.appendChild(tdType);

    // Approver
    const tdApprover = document.createElement("td");
    tdApprover.className = "mono-cell";
    if (r.approver) {
      const span = el(
        "span",
        undefined,
        truncateAddress(r.approver, 4)
      );
      span.title = r.approver;
      tdApprover.appendChild(span);
      tdApprover.appendChild(createCopyButton(r.approver));
    } else {
      tdApprover.textContent = "—";
    }
    tr.appendChild(tdApprover);

    // Message Hash
    const tdHash = document.createElement("td");
    tdHash.className = "mono-cell";
    const hashSpan = el(
      "span",
      undefined,
      truncateAddress(r.hash, 6)
    );
    hashSpan.title = r.hash;
    tdHash.appendChild(hashSpan);
    tdHash.appendChild(createCopyButton(r.hash));
    tr.appendChild(tdHash);

    // Blockhash
    const tdBh = document.createElement("td");
    tdBh.className = "mono-cell";
    const bhSpan = el(
      "span",
      undefined,
      truncateAddress(r.blockhash, 4)
    );
    bhSpan.title = r.blockhash;
    tdBh.appendChild(bhSpan);
    tr.appendChild(tdBh);

    // Signature
    const tdSig = document.createElement("td");
    tdSig.className = "mono-cell";
    const sigLink = document.createElement("a");
    sigLink.className = "explorer-link";
    sigLink.href = `https://solscan.io/tx/${r.signature}`;
    sigLink.target = "_blank";
    sigLink.rel = "noopener";
    sigLink.textContent = truncateAddress(r.signature, 4);
    sigLink.title = r.signature;
    tdSig.appendChild(sigLink);
    tdSig.appendChild(createCopyButton(r.signature));
    tr.appendChild(tdSig);

    // Time
    const tdTime = document.createElement("td");
    if (r.blockTime) {
      const date = new Date(r.blockTime * 1000);
      tdTime.textContent = date.toISOString().replace("T", " ").slice(0, 19);
    } else {
      tdTime.textContent = "—";
    }
    tr.appendChild(tdTime);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  card.appendChild(table);

  // Detail expansion: clicking a row shows full hash info below the table
  card.appendChild(el("h3", undefined, "Full Details"));
  card.appendChild(
    el("p", "form-hint", "Click a row above or see all hashes below:")
  );

  for (const r of results) {
    const detailBlock = el("div", "instruction-block");
    const label = r.isApproval ? "Approve" : "Reject";
    detailBlock.appendChild(
      el(
        "h4",
        undefined,
        `${label} by ${r.approver ? truncateAddress(r.approver, 6) : "unknown"}`
      )
    );

    detailBlock.appendChild(createInfoRow("Message Hash", r.hash));
    detailBlock
      .querySelector(".info-value")
      ?.appendChild(createCopyButton(r.hash));

    detailBlock.appendChild(
      createInfoRow("Signature", r.signature)
    );
    detailBlock.appendChild(
      createInfoRow("Blockhash", r.blockhash)
    );
    detailBlock.appendChild(
      createInfoRow("Fee Payer", r.feePayer)
    );
    detailBlock.appendChild(
      createInfoRow("Instructions", r.numInstructions.toString())
    );
    detailBlock.appendChild(
      createInfoRow("Message Size", `${r.messageSize} bytes`)
    );
    detailBlock.appendChild(
      createInfoRow("Slot", r.slot.toString())
    );
    if (r.blockTime) {
      const date = new Date(r.blockTime * 1000);
      detailBlock.appendChild(
        createInfoRow("Time", date.toISOString())
      );
    }

    card.appendChild(detailBlock);
  }

  container.appendChild(card);
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
// ---------------------------------------------------------------------------
// Render: Decoded Message (Offline Decoder)
// ---------------------------------------------------------------------------

export function renderDecodedMessage(
  decoded: DecodedMessage,
  hash: string
): void {
  const container = $("decode-result");
  clear(container);
  container.classList.remove("hidden");

  const summary = generateTransactionSummary(decoded);

  const card = el("div", "decoded-card");

  // Count pending approvals needed
  const unknownCount = summary.outerInstructionSafety.filter(
    (s) => s === "unknown"
  ).length;
  const hasSummary = summary.actions.length > 0;
  const totalPending = unknownCount + (hasSummary ? 1 : 0);

  // Hash display — hidden until all reviews are acknowledged
  card.appendChild(el("h2", undefined, "Message Hash"));

  if (totalPending === 0) {
    // All instructions are safe — show hash immediately
    const hashDisplay = el("div", "hash-display");
    hashDisplay.appendChild(el("span", "hash-value", hash));
    hashDisplay.appendChild(createCopyButton(hash));
    card.appendChild(hashDisplay);
  } else {
    // Hide hash until reviews complete
    const hiddenDiv = el("div", "hash-hidden");
    hiddenDiv.id = "hash-reveal";
    hiddenDiv.setAttribute("data-hash", hash);
    hiddenDiv.setAttribute("data-pending", totalPending.toString());
    hiddenDiv.textContent = `Review ${totalPending} item(s) below to reveal the message hash.`;
    card.appendChild(hiddenDiv);
  }

  // Fee payer
  if (decoded.accountKeys.length > 0) {
    const feePayerRow = createInfoRow("Fee Payer", decoded.accountKeys[0]);
    feePayerRow
      .querySelector(".info-value")!
      .appendChild(createCopyButton(decoded.accountKeys[0]));
    card.appendChild(feePayerRow);
  }

  // Multisig PDA (extracted from vault_transaction_create)
  if (summary.multisigPda) {
    const msRow = createInfoRow("Squads Multisig Account", summary.multisigPda);
    msRow
      .querySelector(".info-value")!
      .appendChild(createCopyButton(summary.multisigPda));
    card.appendChild(msRow);
  }

  // Disclaimer
  const disclaimer = el("div", "warning-banner warning-caution");
  disclaimer.appendChild(el("span", "warning-icon", "!!"));
  disclaimer.appendChild(
    el(
      "span",
      undefined,
      "DISCLAIMER: This tool decodes and displays transaction data for verification purposes only. " +
        "It cannot guarantee the safety or legitimacy of any transaction. " +
        "Always independently verify all destination addresses, amounts, and instructions. " +
        "Never sign a transaction you do not fully understand. USE AT YOUR OWN RISK."
    )
  );
  card.appendChild(disclaimer);

  // Transaction Summary (if vault transaction detected)
  if (summary.actions.length > 0) {
    const summaryCard = el("div", "summary-card");
    summaryCard.appendChild(
      el("h2", undefined, "Transaction Summary")
    );

    // Instruction overview
    const safeCount = summary.outerInstructionSafety.filter(
      (s) => s === "safe"
    ).length;
    const reviewCount = summary.outerInstructionSafety.filter(
      (s) => s === "review"
    ).length;
    const unkCount = summary.outerInstructionSafety.filter(
      (s) => s === "unknown"
    ).length;
    const totalIx = decoded.instructions.length;
    summaryCard.appendChild(
      createInfoRow(
        "Instructions",
        `${totalIx} total: ${safeCount} safe, ${reviewCount} to review, ${unkCount} unknown`
      )
    );

    // Anchor link to full instruction list
    const viewLink = document.createElement("a");
    viewLink.href = "#instruction-list";
    viewLink.className = "explorer-link";
    viewLink.textContent = "View all instructions below";
    viewLink.style.display = "block";
    viewLink.style.marginBottom = "12px";
    viewLink.style.fontSize = "0.82rem";
    summaryCard.appendChild(viewLink);

    for (const action of summary.actions) {
      const actionDiv = el("div", "summary-action");
      actionDiv.appendChild(
        el("div", "summary-action-title", action.title)
      );

      for (const [key, value] of Object.entries(action.details)) {
        if (key === "SOL") continue;
        const row = el("div", "summary-detail-row");
        row.appendChild(el("span", "summary-detail-label", key));
        const valSpan = el("span", "summary-detail-value", value);
        row.appendChild(valSpan);
        row.appendChild(createCopyButton(value));
        actionDiv.appendChild(row);
      }

      if (action.programLabel) {
        const row = el("div", "summary-detail-row");
        row.appendChild(el("span", "summary-detail-label", "Program"));
        row.appendChild(
          el("span", "summary-detail-value", action.programLabel)
        );
        actionDiv.appendChild(row);
      }

      summaryCard.appendChild(actionDiv);
    }

    // Review button for the transaction summary
    if (totalPending > 0) {
      const reviewBtn = document.createElement("button");
      reviewBtn.className = "review-btn";
      reviewBtn.textContent = "I have reviewed this transaction";
      reviewBtn.addEventListener("click", () => {
        reviewBtn.disabled = true;
        reviewBtn.textContent = "Reviewed";
        revealHashIfReady();
      });
      summaryCard.appendChild(reviewBtn);
    }

    card.appendChild(summaryCard);
  }

  // Warnings
  for (const warning of summary.warnings) {
    const banner = el("div", "warning-banner");
    banner.classList.add(`warning-${warning.severity}`);
    const icon =
      warning.severity === "danger"
        ? "!!"
        : warning.severity === "caution"
          ? "!"
          : "i";
    banner.appendChild(el("span", "warning-icon", icon));
    banner.appendChild(el("span", undefined, warning.message));
    card.appendChild(banner);
  }

  // Message overview
  card.appendChild(el("h3", undefined, "Message Overview"));

  const versionBadge = el(
    "span",
    "status-badge",
    decoded.version.toUpperCase()
  );
  versionBadge.classList.add("status-active");
  const versionRow = createInfoRow("Version", "");
  versionRow.querySelector(".info-value")!.textContent = "";
  versionRow.querySelector(".info-value")!.appendChild(versionBadge);
  card.appendChild(versionRow);

  card.appendChild(createInfoRow("Message Size", `${decoded.size} bytes`));
  card.appendChild(
    createInfoRow(
      "Header",
      `${decoded.header.numRequiredSignatures} signer(s), ` +
        `${decoded.header.numReadonlySignedAccounts} read-only signed, ` +
        `${decoded.header.numReadonlyUnsignedAccounts} read-only unsigned`
    )
  );

  const bhRow = createInfoRow("Blockhash", decoded.recentBlockhash);
  bhRow.querySelector(".info-value")!.appendChild(
    createCopyButton(decoded.recentBlockhash)
  );
  card.appendChild(bhRow);

  // Account Keys — full addresses
  card.appendChild(
    el("h3", undefined, `Account Keys (${decoded.accountKeys.length})`)
  );

  const keysTable = document.createElement("table");
  keysTable.className = "members-table";
  const kHead = document.createElement("thead");
  const kHeadRow = document.createElement("tr");
  for (const h of ["#", "Public Key", "Flags", "Label"]) {
    const th = document.createElement("th");
    th.textContent = h;
    kHeadRow.appendChild(th);
  }
  kHead.appendChild(kHeadRow);
  keysTable.appendChild(kHead);

  const kBody = document.createElement("tbody");
  const numKeys = decoded.accountKeys.length;
  const hdr = decoded.header;

  for (let i = 0; i < numKeys; i++) {
    const key = decoded.accountKeys[i];
    const signer = i < hdr.numRequiredSignatures;
    const writableSignerEnd =
      hdr.numRequiredSignatures - hdr.numReadonlySignedAccounts;
    const readonlyUnsignedStart =
      numKeys - hdr.numReadonlyUnsignedAccounts;
    const writable = signer
      ? i < writableSignerEnd
      : i < readonlyUnsignedStart;

    const tr = document.createElement("tr");
    const tdIdx = document.createElement("td");
    tdIdx.textContent = i.toString();
    tdIdx.style.fontWeight = "600";
    tr.appendChild(tdIdx);

    const tdKey = document.createElement("td");
    tdKey.className = "mono";
    tdKey.textContent = key;
    tdKey.style.wordBreak = "break-all";
    tdKey.style.fontSize = "0.78rem";
    tr.appendChild(tdKey);

    const tdFlags = document.createElement("td");
    const flagsDiv = el("span", "account-flags");
    if (signer)
      flagsDiv.appendChild(el("span", "flag-badge flag-signer", "Signer"));
    if (i === 0)
      flagsDiv.appendChild(el("span", "flag-badge flag-signer", "Fee Payer"));
    if (writable)
      flagsDiv.appendChild(el("span", "flag-badge flag-writable", "Writable"));
    else
      flagsDiv.appendChild(el("span", "flag-badge flag-readonly", "Read-only"));
    tdFlags.appendChild(flagsDiv);
    tr.appendChild(tdFlags);

    const tdLabel = document.createElement("td");
    const progLabel2 = KNOWN_PROGRAMS[key];
    const tokenInfo = getTokenInfo(key);
    tdLabel.textContent = progLabel2
      ? progLabel2
      : tokenInfo
        ? `${tokenInfo.symbol} (${tokenInfo.name})`
        : "";
    tdLabel.style.fontSize = "0.78rem";
    tdLabel.style.color = "#666";
    tr.appendChild(tdLabel);

    kBody.appendChild(tr);
  }
  keysTable.appendChild(kBody);
  card.appendChild(keysTable);

  // Instructions — with safety classification
  const ixHeading = el(
    "h3",
    undefined,
    `Instructions (${decoded.instructions.length})`
  );
  ixHeading.id = "instruction-list";
  card.appendChild(ixHeading);

  for (let i = 0; i < decoded.instructions.length; i++) {
    const ix = decoded.instructions[i];
    const safety = summary.outerInstructionSafety[i] ?? "unknown";

    if (safety === "safe") {
      // Render as collapsible <details>, collapsed by default
      card.appendChild(
        renderCollapsedInstruction(i, ix, safety)
      );
    } else {
      // Render expanded with full details
      card.appendChild(
        renderExpandedInstruction(i, ix, safety)
      );
    }
  }

  // Address Table Lookups
  if (decoded.addressTableLookups.length > 0) {
    card.appendChild(
      el(
        "h3",
        undefined,
        `Address Table Lookups (${decoded.addressTableLookups.length})`
      )
    );
    for (let i = 0; i < decoded.addressTableLookups.length; i++) {
      const alt = decoded.addressTableLookups[i];
      const block = el("div", "instruction-block");
      block.appendChild(el("h4", undefined, `Lookup Table ${i + 1}`));
      block.appendChild(createInfoRow("Account", alt.accountKey));
      block.appendChild(
        createInfoRow("Writable Indexes", alt.writableIndexes.join(", ") || "(none)")
      );
      block.appendChild(
        createInfoRow("Readonly Indexes", alt.readonlyIndexes.join(", ") || "(none)")
      );
      card.appendChild(block);
    }
  } else {
    card.appendChild(createInfoRow("Address Table Lookups", "0"));
  }

  // Raw hex
  card.appendChild(el("h3", undefined, "Raw Message (hex)"));
  card.appendChild(el("div", "hash-message-hex", decoded.rawHex));
  card.appendChild(createCopyButton(decoded.rawHex));

  container.appendChild(card);
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------------
// Instruction Renderers (for decoded message view)
// ---------------------------------------------------------------------------

/** Decrement the pending review counter and reveal the hash when all reviews are done. */
function revealHashIfReady(): void {
  const hiddenDiv = document.getElementById("hash-reveal");
  if (!hiddenDiv) return;

  let pending = parseInt(
    hiddenDiv.getAttribute("data-pending") ?? "0",
    10
  );
  pending--;

  if (pending <= 0) {
    // Reveal the hash
    const hash = hiddenDiv.getAttribute("data-hash") ?? "";
    const wrapper = el("div");
    const hashDisplay = el("div", "hash-display");
    hashDisplay.appendChild(el("span", "hash-value", hash));
    hashDisplay.appendChild(createCopyButton(hash));
    wrapper.appendChild(hashDisplay);

    const revealNote = el("div", "form-hint");
    revealNote.style.marginTop = "8px";
    revealNote.textContent =
      "By using this hash to verify your hardware wallet display, you acknowledge " +
      "that this tool is for informational purposes only and cannot detect all possible " +
      "attack vectors. USE AT YOUR OWN RISK.";
    wrapper.appendChild(revealNote);

    hiddenDiv.replaceWith(wrapper);
  } else {
    hiddenDiv.setAttribute("data-pending", pending.toString());
    hiddenDiv.textContent = `Review ${pending} item(s) below to reveal the message hash.`;
  }
}

function renderSafetyBadge(safety: InstructionSafety): HTMLElement {
  const labels: Record<InstructionSafety, string> = {
    safe: "Safe",
    review: "Review",
    unknown: "Unknown",
  };
  const badge = el("span", "safety-badge", labels[safety]);
  badge.classList.add(`safety-${safety}`);
  return badge;
}

/** Render a safe instruction as a collapsed <details> element. */
function renderCollapsedInstruction(
  index: number,
  ix: DecodedMessage["instructions"][0],
  safety: InstructionSafety
): HTMLElement {
  const details = document.createElement("details");
  details.className = "safe-instruction";

  const summary = document.createElement("summary");
  summary.appendChild(
    document.createTextNode(`Instruction ${index + 1} `)
  );
  summary.appendChild(renderSafetyBadge(safety));
  if (ix.decoded) {
    summary.appendChild(document.createTextNode(` ${ix.decoded}`));
  }
  details.appendChild(summary);

  const block = renderInstructionContent(ix);
  details.appendChild(block);
  return details;
}

/** Render a review/unknown instruction expanded with full details. */
function renderExpandedInstruction(
  index: number,
  ix: DecodedMessage["instructions"][0],
  safety: InstructionSafety
): HTMLElement {
  const wrapper = el("div");

  const titleEl = el("h4", undefined, `Instruction ${index + 1} `);
  titleEl.appendChild(renderSafetyBadge(safety));
  if (ix.decoded) {
    titleEl.appendChild(el("span", "decoded-label", ix.decoded));
  }

  const block = renderInstructionContent(ix);
  block.insertBefore(titleEl, block.firstChild);

  // For vault_transaction_create, render inner instructions prominently
  if (ix.innerInstructions && ix.innerInstructions.length > 0) {
    const vaultContents = el("div", "vault-contents");
    vaultContents.appendChild(
      el("h4", undefined, "Vault Transaction Contents")
    );

    for (let j = 0; j < ix.innerInstructions.length; j++) {
      const inner = ix.innerInstructions[j];
      vaultContents.appendChild(renderInnerInstruction(j, inner));
    }

    block.appendChild(vaultContents);
  }

  // Add review button for unknown instructions
  // (review instructions are covered by the Transaction Summary button)
  if (safety === "unknown") {
    const reviewBtn = document.createElement("button");
    reviewBtn.className = "review-btn";
    reviewBtn.textContent = "I accept the risk";
    reviewBtn.addEventListener("click", () => {
      reviewBtn.disabled = true;
      reviewBtn.textContent = "Accepted";
      revealHashIfReady();
    });
    block.appendChild(reviewBtn);
  }

  wrapper.appendChild(block);
  return wrapper;
}

/** Render the content of an instruction (program, accounts, details, data). */
function renderInstructionContent(
  ix: DecodedMessage["instructions"][0]
): HTMLElement {
  const block = el("div", "instruction-block");

  // Program
  const progDisplay = ix.programLabel
    ? `${ix.programLabel} (${ix.programId})`
    : ix.programId;
  const progRow = createInfoRow("Program", progDisplay);
  progRow.querySelector(".info-value")!.appendChild(
    createCopyButton(ix.programId)
  );
  block.appendChild(progRow);

  // Accounts — full addresses
  if (ix.accounts.length > 0) {
    block.appendChild(
      el("h4", undefined, `Accounts (${ix.accounts.length})`)
    );
    const accList = el("ul", "account-list");
    for (const acc of ix.accounts) {
      const li = document.createElement("li");
      li.style.wordBreak = "break-all";
      li.textContent = acc.pubkey;

      const flags = el("span", "account-flags");
      if (acc.signer)
        flags.appendChild(el("span", "flag-badge flag-signer", "Signer"));
      if (acc.writable)
        flags.appendChild(el("span", "flag-badge flag-writable", "W"));
      else
        flags.appendChild(el("span", "flag-badge flag-readonly", "R"));
      li.appendChild(flags);

      const knownLabel = KNOWN_PROGRAMS[acc.pubkey];
      if (knownLabel) {
        li.appendChild(document.createTextNode(` ${knownLabel}`));
      }
      accList.appendChild(li);
    }
    block.appendChild(accList);
  }

  // Decoded details
  if (ix.decodedDetails) {
    for (const [key, value] of Object.entries(ix.decodedDetails)) {
      block.appendChild(createInfoRow(key, value));
    }
  }

  // Data
  if (ix.data.length > 0) {
    block.appendChild(el("h4", undefined, `Data (${ix.data.length} bytes)`));
    block.appendChild(el("div", "data-hex", ix.dataHex));
  }

  return block;
}

/** Render an inner instruction (from vault_transaction_create) prominently. */
function renderInnerInstruction(
  index: number,
  inner: DecodedInnerInstruction
): HTMLElement {
  const block = el("div", "inner-ix-block");

  // Title with decoded label
  const titleText = `Instruction ${index + 1}`;
  const titleEl = el("div", "inner-ix-title");
  titleEl.appendChild(document.createTextNode(titleText));
  if (inner.decoded) {
    titleEl.appendChild(document.createTextNode(": "));
    titleEl.appendChild(el("span", "decoded-label", inner.decoded));
  }
  block.appendChild(titleEl);

  // Program — full address
  const progDisplay = inner.programLabel
    ? `${inner.programLabel} (${inner.programId})`
    : inner.programId;
  block.appendChild(createInfoRow("Program", progDisplay));

  // Accounts — full addresses with labels and token names
  if (inner.accounts.length > 0) {
    for (let i = 0; i < inner.accounts.length; i++) {
      const acc = inner.accounts[i];
      const label =
        inner.accountLabels && i < inner.accountLabels.length
          ? inner.accountLabels[i]
          : `Account ${i}`;
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", label));

      // Show token name next to the address if it's a known mint
      const accTokenInfo = getTokenInfo(acc);
      const displayText = accTokenInfo
        ? `${acc} [${accTokenInfo.symbol} - ${accTokenInfo.name}]`
        : acc;
      const valSpan = el("span", "summary-detail-value", displayText);
      row.appendChild(valSpan);
      row.appendChild(createCopyButton(acc));
      block.appendChild(row);
    }
  }

  // Data
  if (inner.data.length > 0) {
    block.appendChild(el("h4", undefined, `Data (${inner.data.length} bytes)`));
    block.appendChild(el("div", "data-hex", inner.dataHex));
  }

  return block;
}
