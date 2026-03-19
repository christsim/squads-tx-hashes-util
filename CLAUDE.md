# CLAUDE.md — Project Context for AI Assistants

> **Keep this file updated** when adding new instructions, config actions, token listings,
> program IDs, types, files, or architecture changes. This is the single source of truth
> for onboarding a new AI session.

---

## Project Overview

**squads-tx-hashes-util** is an offline, zero-dependency tool for decoding serialized Solana
transaction messages and computing their SHA-256 message hashes. It is specifically designed
for **Squads Protocol v4** multisig transactions.

**Primary use case:** Hardware wallet verification. When a Ledger displays a "Message Hash"
during blind signing, users paste the raw serialized message bytes here, decode every
instruction to understand what the transaction does, and compare the computed hash against
the hardware wallet display.

**Design principles:**
- Fully offline (no RPC calls, no network at runtime)
- Zero runtime dependencies (only devDependencies: Vite, TypeScript, Vitest)
- Ships as a single self-contained HTML file (`dist/squads-tx-hashes.html`)
- Also available as a standalone JS library (`dist/squads-decoder.js`)

---

## File Map

### Source (`src/`)

| File | Description |
|------|-------------|
| `decoder.ts` | Core: message parsing, instruction decoding, config action decoding, vault message parsing, transaction summary generation, hex/base64 conversion |
| `constants.ts` | Program IDs, discriminators, known tokens (~100+), permissions bitmask helpers, token/program lookup functions |
| `display.ts` | DOM rendering layer: renders decoded messages, config actions, inner instructions, safety badges, hash reveal gate |
| `main.ts` | Browser entry point: event handlers, format toggle (hex/base64), calls decoder + display |
| `lib.ts` | Library entry point: re-exports all public APIs for npm package |
| `bs58.ts` | Pure-JS Base58 encode/decode using BigInt arithmetic |
| `hash-standalone.ts` | SHA-256 via Web Crypto API, returns base58-encoded hash |
| `styles.css` | Complete CSS for the single-page app |

### Tests (`tests/`)

| File | Description |
|------|-------------|
| `decoder.test.ts` | Hex/base64 conversion, V0/legacy message decoding, instruction decoding (System, Token, Compute Budget, Squads), config action decoding (all 7 variants), real transaction end-to-end tests |
| `bs58.test.ts` | Base58 encode/decode, roundtrip verification |
| `constants.test.ts` | bytesToHex, formatPermissions, getTokenInfo, getProgramLabel, KNOWN_TOKENS coverage |
| `hash-standalone.test.ts` | SHA-256 correctness, consistency, base58 output format |

### Config

| File | Description |
|------|-------------|
| `package.json` | Scripts: `dev`, `build`, `build:lib`, `build:all`, `test`, `test:watch` |
| `npm-package.json` | Template for published npm package (`squads-decoder`) |
| `tsconfig.json` | Main TS config: ES2020 target, strict mode, DOM lib |
| `tsconfig.lib.json` | Library TS config: emits `.d.ts` declarations only |
| `vite.config.ts` | HTML app build: uses `vite-plugin-singlefile` |
| `vite.config.lib.ts` | Library build: ES module, no minification |
| `index.html` | Root HTML template |

---

## Architecture

### Module Dependency Graph

```
index.html
  └── main.ts (browser entry)
        ├── styles.css
        ├── hash-standalone.ts → bs58.ts
        ├── decoder.ts → bs58.ts, constants.ts
        └── display.ts → constants.ts, decoder.ts (types)

lib.ts (library entry)
  ├── bs58.ts
  ├── decoder.ts → bs58.ts, constants.ts
  ├── hash-standalone.ts → bs58.ts
  └── constants.ts
```

### Data Flow

1. User pastes hex or base64 into textarea
2. `main.ts` converts to `Uint8Array` via `hexToBytes()` / `base64ToBytes()`
3. `decoder.ts` → `decodeMessage(bytes)` parses the full message:
   - Version detection (legacy vs V0)
   - Header, account keys, blockhash, instructions, address table lookups
   - Per-instruction decoding via `decodeInstructionData()` (dispatches by program ID)
   - For `vault_transaction_create`: extracts and decodes embedded inner instructions
   - For `config_transaction_create`: decodes `Vec<ConfigAction>` payload
4. `hash-standalone.ts` → `hashRawMessage(bytes)` computes SHA-256, returns base58
5. `display.ts` → `renderDecodedMessage(decoded, hash)` renders to DOM
   - Calls `generateTransactionSummary()` to classify instruction safety
   - Hash is hidden behind a review gate until user confirms all review items

---

## Key Types (all in `decoder.ts`)

### `DecodedMessage`
```
version: "legacy" | "v0"
header: { numRequiredSignatures, numReadonlySignedAccounts, numReadonlyUnsignedAccounts }
accountKeys: string[]                    // base58 pubkeys
recentBlockhash: string                  // base58
instructions: DecodedInstruction[]
addressTableLookups: DecodedAddressTableLookup[]
rawHex: string
size: number
```

### `DecodedInstruction`
```
programIdIndex: number
programId: string                        // base58
programLabel: string | null              // e.g. "Squads Multisig v4"
accountIndexes: number[]
accounts: DecodedAccount[]               // { index, pubkey, writable, signer }
data: Uint8Array
dataHex: string
decoded: string | null                   // human-readable name/details
decodedDetails?: Record<string, string>  // key-value pairs
innerInstructions?: DecodedInnerInstruction[]  // from vault_transaction_create
configActions?: ConfigAction[]           // from config_transaction_create
```

### `ConfigAction` (discriminated union)
```
| { type: "AddMember"; member: { key: string; permissions: number } }
| { type: "RemoveMember"; oldMember: string }
| { type: "ChangeThreshold"; newThreshold: number }
| { type: "SetTimeLock"; newTimeLock: number }
| { type: "AddSpendingLimit"; createKey, vaultIndex, mint, amount: bigint, period, members[], destinations[] }
| { type: "RemoveSpendingLimit"; spendingLimit: string }
| { type: "SetRentCollector"; newRentCollector: string | null }
| { type: "Unknown"; variant: number; raw: string }
```

### `TransactionSummary`
```
actions: ActionSummary[]                 // { title, details, programId, programLabel }
warnings: Warning[]                      // { severity: "info"|"caution"|"danger", message }
outerInstructionSafety: InstructionSafety[]  // "safe" | "review" | "unknown"
multisigPda?: string
```

### Other types
- `DecodedInnerInstruction` — programId, accounts, accountLabels, data, decoded
- `DecodedAccount` — index, pubkey, writable, signer
- `DecodedAddressTableLookup` — accountKey, writableIndexes, readonlyIndexes
- `TokenInfo` (constants.ts) — symbol, name, decimals
- `InstructionSafety` — `"safe" | "review" | "unknown"`

---

## Decoder Pipeline (12 stages)

1. **Input conversion** — `hexToBytes()` or `base64ToBytes()` → `Uint8Array`
2. **Version detection** — bit 7 of first byte: set = V0 (consume byte), unset = legacy
3. **Header** — 3 bytes: numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned
4. **Account keys** — compact-u16 count, then N × 32-byte pubkeys
5. **Blockhash** — 32 bytes
6. **Instructions** — compact-u16 count, each: programIdIndex(u8), accounts(compact-u16 + N×u8), data(compact-u16 + N bytes)
7. **Address table lookups** (V0 only) — compact-u16 count, each: pubkey(32), writableIndexes, readonlyIndexes
8. **Instruction dispatch** — by programId to specific decoders
9. **Squads discriminator matching** — first 8 bytes of data matched against known Anchor discriminators
10. **Vault message extraction** — `vault_transaction_create` embeds a full Solana message that gets parsed recursively
11. **Config action decoding** — `config_transaction_create` contains `Vec<ConfigAction>` with variant-based dispatch
12. **Summary generation** — `generateTransactionSummary()` classifies safety, generates warnings, produces action summaries

---

## Squads Instructions (21 total)

All use 8-byte Anchor discriminators (SHA256 of `"global:<instruction_name>"`, first 8 bytes).

| Instruction | Discriminator (hex) | Detailed Decoding |
|---|---|---|
| `vault_transaction_create` | `30fa4ea8d0e2dad3` | Full inner message parsing |
| `vault_transaction_create_v2` | `77349c100df05c0a` | Full inner message parsing |
| `config_transaction_create` | `9bec57e4894b5127` | Full config action parsing |
| `proposal_create` | `dc3c49e01e6c4f9f` | transaction_index + draft flag |
| `proposal_approve` | `9025a488bcd82af8` | memo field |
| `proposal_reject` | `f33e869ce66af687` | memo field |
| `proposal_activate` | `0b225cf89a1b336a` | name only |
| `proposal_cancel` | `1b2a7fed26a354cb` | name only |
| `proposal_cancel_v2` | `cd29c23ddc8b10f7` | name only |
| `vault_transaction_execute` | `c208a15799a419ab` | name only |
| `config_transaction_execute` | `7292f4bdfc8c2428` | name only |
| `batch_create` | `c28e8d1137b914f8` | name only |
| `batch_add_transaction` | `5964e012454636ac` | name only |
| `batch_execute_transaction` | `ac2cb398157feab4` | name only |
| `multisig_create` | `7a4d509f54585ac5` | name only |
| `multisig_create_v2` | `32ddc75d28f58be9` | name only |
| `spending_limit_use` | `1039827fc1149b86` | name only |
| `vault_transaction_accounts_close` | `c447bbb00223aaa5` | name only |
| `proposal_accounts_close` | `cbb2c852efdc4ff3` | name only |
| `config_transaction_accounts_close` | `50cb54359770bbba` | name only |
| `batch_accounts_close` | `dac407af82660bff` | name only |

---

## Config Actions (7 variants)

Encoded inside `config_transaction_create` data as: discriminator(8) + actions_vec_len(u32 LE) + actions + optional_memo.

Each action: variant_byte(u8) + variant-specific data.

| Variant | Type | Binary Layout |
|---|---|---|
| 0 | AddMember | Pubkey(32) + permissions_mask(u8) |
| 1 | RemoveMember | Pubkey(32) |
| 2 | ChangeThreshold | u16 LE |
| 3 | SetTimeLock | u32 LE (seconds) |
| 4 | AddSpendingLimit | Pubkey(32) createKey + u8 vaultIndex + Pubkey(32) mint + u64 LE amount + u8 period(0=OneTime,1=Day,2=Week,3=Month) + Vec\<Pubkey\> members(u32 len + N×32) + Vec\<Pubkey\> destinations(u32 len + N×32) |
| 5 | RemoveSpendingLimit | Pubkey(32) |
| 6 | SetRentCollector | Option\<Pubkey\>(u8 tag: 0=None, 1=Some + 32 bytes) |

---

## Inner Instruction Decoders

### System Program (`11111111111111111111111111111111`)
Dispatch by u32 LE instruction type at offset 0.

| Type | Instruction | Fields Decoded |
|---|---|---|
| 0x00 | CreateAccount | lamports(u64), space(u64), owner(Pubkey) |
| 0x01 | Assign | name only |
| 0x02 | Transfer | lamports(u64) → SOL conversion |
| 0x03 | CreateAccountWithSeed | name only |
| 0x04 | AdvanceNonceAccount | name only |
| 0x05 | WithdrawNonceAccount | lamports(u64) → SOL conversion |
| 0x06 | InitializeNonceAccount | authority(Pubkey) |
| 0x07 | AuthorizeNonceAccount | new authority(Pubkey) |
| 0x09 | Allocate | name only |

### Token Program / Token-2022
Same decoder handles both programs. Dispatch by u8 at offset 0.

| Type | Instruction | Fields | Account Labels |
|---|---|---|---|
| 0x01 | InitializeAccount | — | Account, Mint, Owner, Rent Sysvar |
| 0x03 | Transfer | amount(u64) | Source, Destination, From (Wallet) |
| 0x04 | Approve | amount(u64) | Source, Delegate, Owner |
| 0x05 | Revoke | — | Source, Owner |
| 0x06 | SetAuthority | — | Token Account, Current Authority |
| 0x07 | MintTo | amount(u64) | Mint, Destination, Owner |
| 0x08 | Burn | amount(u64) | Source, Mint, Owner |
| 0x09 | CloseAccount | — | Token Account, Destination, Owner |
| 0x0a | FreezeAccount | — | Token Account, Mint, Freeze Authority |
| 0x0b | ThawAccount | — | Token Account, Mint, Freeze Authority |
| 0x0c | TransferChecked | amount(u64), decimals(u8), human amount | Source, Mint, Destination, From (Wallet) |
| 0x0d | ApproveChecked | amount(u64), decimals(u8) | Source, Mint, Delegate, Owner |
| 0x0e | MintToChecked | amount(u64), decimals(u8) | Mint, Destination, Mint Authority |
| 0x0f | BurnChecked | amount(u64), decimals(u8) | Source, Mint, Owner |
| 0x11 | SyncNative | — | Token Account |

### Compute Budget (`ComputeBudget111111111111111111111111111111`)

| Type(u8) | Instruction | Fields |
|---|---|---|
| 0x00 | RequestUnitsDeprecated | units(u32) |
| 0x02 | SetComputeUnitLimit | units(u32) |
| 0x03 | SetComputeUnitPrice | microlamports(u64) |

### Associated Token Program (`ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`)

| Type(u8) | Instruction | Account Labels |
|---|---|---|
| 0x00/empty | CreateAssociatedTokenAccount | Payer, ATA, Owner, Mint, System, Token |
| 0x01 | CreateIdempotent | same |
| 0x02 | RecoverNested | Nested ATA, Token Mint, Dest ATA, Owner ATA, Token Mint, Owner, Token |

---

## Constants

### Known Program IDs (constants.ts)
System, Token, Token-2022, Associated Token, Compute Budget, Vote, Stake, Memo (v1+v2),
Squads v4, Jupiter v6, Orca Whirlpool, and several Sysvars.

### Squads Program ID
`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`

### Permission Bitmask
- `PERMISSION_INITIATE` = 1 (bit 0) — "Initiate" / "Proposer"
- `PERMISSION_VOTE` = 2 (bit 1) — "Vote" / "Voter"
- `PERMISSION_EXECUTE` = 4 (bit 2) — "Execute" / "Executor"
- All = 7 — "Almighty"

### Known Tokens (~100+)
Categories: Native/Wrapped SOL, Stablecoins (USDC/USDT/USDS/PYUSD), Liquid Staking
(mSOL/stSOL/JitoSOL/bSOL/jupSOL/etc.), Governance/Protocol tokens, Memecoins, DeFi,
Bridges, Gaming/NFT, Sanctum LSTs, xStocks tokenized equities (~80 tokens, all 8 decimals,
Token-2022).

### Account Discriminators
| Hex | Label |
|---|---|
| `e07479ba44a14fec` | Multisig |
| `a8faa264510ea2cf` | VaultTransaction |
| `5e080423718b8b70` | ConfigTransaction |
| `1a5ebdbb74883521` | Proposal |
| `9cc2462c1658892c` | Batch |

---

## Build System

| Command | Output | Description |
|---|---|---|
| `npm run build` | `dist/squads-tx-hashes.html` + `.sha256` | Single-file HTML app (all JS/CSS inlined) |
| `npm run build:lib` | `dist/squads-decoder.js` + `.sha256` + `.d.ts` files | ES module library for npm |
| `npm run build:all` | Both | Runs both builds |
| `npm run dev` | Dev server | Vite dev server with HMR |
| `npm test` | — | Vitest test runner |
| `npm run test:watch` | — | Vitest in watch mode |

---

## Conventions & Implementation Notes

- **Zero runtime dependencies** — everything is hand-rolled (Base58, SHA-256 via Web Crypto, byte parsing)
- **compact-u16 encoding** — Solana's variable-length integer encoding, used for array lengths in serialized messages
- **BigInt for u64** — all u64 values (amounts, lamports) use `bigint` to avoid JS number precision loss
- **Anchor discriminators** — first 8 bytes of SHA256(`"global:<snake_case_name>"`), used to identify Squads instructions
- **`ByteReader` class** — sequential reader with bounds checking, used throughout message parsing
- **Safety classification** — instructions classified as `safe` (compute budget, nonce advance, close accounts), `review` (vault/config transaction creates), or `unknown` (everything else)
- **Hash reveal gate** — the computed message hash is hidden until the user confirms they've reviewed all `review`/`unknown` instructions
- **Token enrichment** — TransferChecked instructions look up mint addresses in `KNOWN_TOKENS` to show human-readable amounts with token symbols
- **ATA cross-referencing** — when an ATA creation instruction precedes a transfer, the destination wallet address is extracted and shown alongside the token account address
