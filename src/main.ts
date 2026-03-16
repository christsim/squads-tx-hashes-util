// ============================================================================
// Squads TX Hashes - Main Entry Point
// ============================================================================
//
// Offline-only: decodes serialized Solana transaction messages and computes
// the SHA-256 message hash. Zero runtime dependencies.
// ============================================================================

import "./styles.css";

import { hashRawMessage } from "./hash-standalone";
import { decodeMessage, hexToBytes, base64ToBytes } from "./decoder";
import { showError, hideError, renderDecodedMessage } from "./display";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentDecodeFormat: "hex" | "base64" = "hex";

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

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
  // Version display
  const versionEl = document.getElementById("app-version");
  if (versionEl) {
    versionEl.textContent = import.meta.env.VITE_APP_VERSION || "dev";
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
