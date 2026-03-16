# Squads TX Hashes

**Don't Trust, Verify!**

A single-page tool for decoding and verifying Solana transaction messages,
specifically designed for [Squads Protocol v4](https://squads.so) multisig transactions.

## Features

### Offline Mode (No Internet Required)

- **Decode serialized Solana transaction messages** (hex or base64)
- **Compute the SHA-256 message hash** displayed by hardware wallets (e.g., Ledger)
- **Decode all instructions** with human-readable labels for:
  - Squads v4 instructions (vault_transaction_create, proposal_approve/reject, etc.)
  - SPL Token / Token-2022 transfers (TransferChecked, with token names for 100+ known tokens)
  - System Program (Transfer, AdvanceNonceAccount, etc.)
  - Compute Budget (SetComputeUnitLimit, SetComputeUnitPrice)
  - Associated Token Account creation
- **Safety classification** -- instructions are marked as Safe, Review, or Unknown
- **Transaction summary** -- shows what the vault transaction actually does in plain English
- **Token name resolution** -- recognizes 100+ tokens including USDC, USDT, SOL, and xStocks tokenized equities
- **ATA to wallet resolution** -- extracts destination wallet addresses from ATA creation instructions

### Online Mode (Requires Internet)

- **Load Squads multisig info** from any Solana RPC (supports vault address auto-resolution)
- **Browse transactions** -- view pending and completed transactions with proposal status
- **Lookup approval hashes** -- find all on-chain approval transactions and compute their message hashes
- **Member display** -- shows all multisig members with permissions (Initiate/Vote/Execute)

## Usage

### Online

Visit: [https://christsim.github.io/squads-tx-hashes-util/](https://christsim.github.io/squads-tx-hashes-util/)

### Offline

1. Download `squads-tx-hashes.html` from the [latest release](https://github.com/christsim/squads-tx-hashes-util/releases/latest)
2. Verify the SHA-256 checksum: `shasum -a 256 squads-tx-hashes.html`
3. Open the file in any browser -- no internet connection required

## How to Verify a Transaction

1. When your hardware wallet shows a transaction to sign, it displays a **Message Hash**
2. Obtain the serialized transaction message (from your wallet software or browser dev tools)
3. Paste it into the **Offline** tab of this tool
4. The tool decodes all instructions and computes the message hash
5. Compare the hash with what your hardware wallet displays
6. **If they match** -- the transaction has not been tampered with
7. **If they don't match** -- DO NOT sign the transaction

## Disclaimer

**USE AT YOUR OWN RISK.** This tool is provided as-is for informational purposes only.
It does not guarantee the safety or legitimacy of any transaction. Always independently
verify all destination addresses, amounts, and instructions. Never sign a transaction
you do not fully understand. The authors accept no liability for any loss of funds.

## Development

```bash
# Install dependencies
npm install

# Development server (hot reload)
npm run dev

# Production build (single HTML file)
npm run build
# Output: dist/squads-tx-hashes.html
```

## License

[MIT](LICENSE)
