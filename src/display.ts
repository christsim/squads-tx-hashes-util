// ============================================================================
// Squads TX Hashes - Display / UI Rendering
// ============================================================================
//
// Pure DOM manipulation layer. Offline only — no network dependencies.
// ============================================================================

import { KNOWN_PROGRAMS, getTokenInfo } from "./constants";
import {
  type DecodedMessage,
  type DecodedInnerInstruction,
  type InstructionSafety,
  type ConfigAction,
  generateTransactionSummary,
} from "./decoder";
import { formatPermissions } from "./constants";

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
// Error Display
// ---------------------------------------------------------------------------

export function showError(message: string): void {
  const errEl = $("error");
  errEl.innerHTML = "";
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

// ---------------------------------------------------------------------------
// Info Row Helper
// ---------------------------------------------------------------------------

function createInfoRow(label: string, value: string): HTMLElement {
  const row = el("div", "info-row");
  row.appendChild(el("span", "info-label", label));
  row.appendChild(el("span", "info-value mono", value));
  return row;
}

// ---------------------------------------------------------------------------
// Render: Decoded Message
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
    const hashDisplay = el("div", "hash-display");
    hashDisplay.appendChild(el("span", "hash-value", hash));
    hashDisplay.appendChild(createCopyButton(hash));
    card.appendChild(hashDisplay);
  } else {
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
      card.appendChild(renderCollapsedInstruction(i, ix, safety));
    } else {
      card.appendChild(renderExpandedInstruction(i, ix, safety));
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
        createInfoRow(
          "Writable Indexes",
          alt.writableIndexes.join(", ") || "(none)"
        )
      );
      block.appendChild(
        createInfoRow(
          "Readonly Indexes",
          alt.readonlyIndexes.join(", ") || "(none)"
        )
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
// Instruction Renderers
// ---------------------------------------------------------------------------

function revealHashIfReady(): void {
  const hiddenDiv = document.getElementById("hash-reveal");
  if (!hiddenDiv) return;

  let pending = parseInt(
    hiddenDiv.getAttribute("data-pending") ?? "0",
    10
  );
  pending--;

  if (pending <= 0) {
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

  if (ix.configActions && ix.configActions.length > 0) {
    const configContents = el("div", "vault-contents");
    configContents.appendChild(
      el("h4", undefined, "Config Transaction Actions")
    );

    for (let j = 0; j < ix.configActions.length; j++) {
      configContents.appendChild(renderConfigAction(j, ix.configActions[j]));
    }

    block.appendChild(configContents);
  }

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

function renderInstructionContent(
  ix: DecodedMessage["instructions"][0]
): HTMLElement {
  const block = el("div", "instruction-block");

  const progDisplay = ix.programLabel
    ? `${ix.programLabel} (${ix.programId})`
    : ix.programId;
  const progRow = createInfoRow("Program", progDisplay);
  progRow.querySelector(".info-value")!.appendChild(
    createCopyButton(ix.programId)
  );
  block.appendChild(progRow);

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

  if (ix.decodedDetails) {
    for (const [key, value] of Object.entries(ix.decodedDetails)) {
      block.appendChild(createInfoRow(key, value));
    }
  }

  if (ix.data.length > 0) {
    block.appendChild(el("h4", undefined, `Data (${ix.data.length} bytes)`));
    block.appendChild(el("div", "data-hex", ix.dataHex));
  }

  return block;
}

function renderInnerInstruction(
  index: number,
  inner: DecodedInnerInstruction
): HTMLElement {
  const block = el("div", "inner-ix-block");

  const titleText = `Instruction ${index + 1}`;
  const titleEl = el("div", "inner-ix-title");
  titleEl.appendChild(document.createTextNode(titleText));
  if (inner.decoded) {
    titleEl.appendChild(document.createTextNode(": "));
    titleEl.appendChild(el("span", "decoded-label", inner.decoded));
  }
  block.appendChild(titleEl);

  const progDisplay = inner.programLabel
    ? `${inner.programLabel} (${inner.programId})`
    : inner.programId;
  block.appendChild(createInfoRow("Program", progDisplay));

  if (inner.accounts.length > 0) {
    for (let i = 0; i < inner.accounts.length; i++) {
      const acc = inner.accounts[i];
      const label =
        inner.accountLabels && i < inner.accountLabels.length
          ? inner.accountLabels[i]
          : `Account ${i}`;
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", label));

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

  if (inner.data.length > 0) {
    block.appendChild(el("h4", undefined, `Data (${inner.data.length} bytes)`));
    block.appendChild(el("div", "data-hex", inner.dataHex));
  }

  return block;
}

function renderConfigAction(
  index: number,
  action: ConfigAction
): HTMLElement {
  const block = el("div", "inner-ix-block");

  const titleEl = el("div", "inner-ix-title");
  titleEl.appendChild(document.createTextNode(`Action ${index + 1}: `));
  titleEl.appendChild(el("span", "decoded-label", action.type));
  block.appendChild(titleEl);

  switch (action.type) {
    case "AddMember": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "New Member"));
      row.appendChild(el("span", "summary-detail-value", action.member.key));
      row.appendChild(createCopyButton(action.member.key));
      block.appendChild(row);

      const perms = formatPermissions(action.member.permissions);
      const permRow = el("div", "summary-detail-row");
      permRow.appendChild(el("span", "summary-detail-label", "Permissions"));
      permRow.appendChild(
        el(
          "span",
          "summary-detail-value",
          perms.length > 0 ? perms.join(", ") : `(mask: ${action.member.permissions})`
        )
      );
      block.appendChild(permRow);
      break;
    }

    case "RemoveMember": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "Member to Remove"));
      row.appendChild(el("span", "summary-detail-value", action.oldMember));
      row.appendChild(createCopyButton(action.oldMember));
      block.appendChild(row);
      break;
    }

    case "ChangeThreshold": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "New Threshold"));
      row.appendChild(
        el("span", "summary-detail-value", action.newThreshold.toString())
      );
      block.appendChild(row);
      break;
    }

    case "SetTimeLock": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "New Time Lock"));
      row.appendChild(
        el("span", "summary-detail-value", `${action.newTimeLock} seconds`)
      );
      block.appendChild(row);
      break;
    }

    case "AddSpendingLimit": {
      const mintInfo = getTokenInfo(action.mint);
      const mintDisplay = mintInfo
        ? `${action.mint} [${mintInfo.symbol}]`
        : action.mint;
      const amountDisplay = mintInfo
        ? `${Number(action.amount) / Math.pow(10, mintInfo.decimals)} ${mintInfo.symbol} (${action.amount.toLocaleString()} raw)`
        : action.amount.toLocaleString();

      const fields: [string, string][] = [
        ["Mint", mintDisplay],
        ["Amount", amountDisplay],
        ["Period", action.period],
        ["Vault Index", action.vaultIndex.toString()],
        ["Create Key", action.createKey],
      ];
      for (let i = 0; i < action.members.length; i++) {
        fields.push([`Member ${i + 1}`, action.members[i]]);
      }
      if (action.destinations.length === 0) {
        fields.push(["Destinations", "(any address)"]);
      } else {
        for (let i = 0; i < action.destinations.length; i++) {
          fields.push([`Destination ${i + 1}`, action.destinations[i]]);
        }
      }

      for (const [label, value] of fields) {
        const row = el("div", "summary-detail-row");
        row.appendChild(el("span", "summary-detail-label", label));
        row.appendChild(el("span", "summary-detail-value", value));
        row.appendChild(createCopyButton(value));
        block.appendChild(row);
      }
      break;
    }

    case "RemoveSpendingLimit": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "Spending Limit"));
      row.appendChild(
        el("span", "summary-detail-value", action.spendingLimit)
      );
      row.appendChild(createCopyButton(action.spendingLimit));
      block.appendChild(row);
      break;
    }

    case "SetRentCollector": {
      const row = el("div", "summary-detail-row");
      row.appendChild(el("span", "summary-detail-label", "Rent Collector"));
      const value = action.newRentCollector ?? "(none)";
      row.appendChild(el("span", "summary-detail-value", value));
      if (action.newRentCollector) {
        row.appendChild(createCopyButton(action.newRentCollector));
      }
      block.appendChild(row);
      break;
    }

    case "Unknown": {
      block.appendChild(
        createInfoRow("Variant", action.variant.toString())
      );
      if (action.raw) {
        block.appendChild(el("div", "data-hex", action.raw));
      }
      break;
    }
  }

  return block;
}
