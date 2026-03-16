// ============================================================================
// Squads TX Hashes - Constants
// ============================================================================

// ---------------------------------------------------------------------------
// Squads Program
// ---------------------------------------------------------------------------

/** Squads Multisig Program v4 ID */
export const SQUADS_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";

// ---------------------------------------------------------------------------
// Account Discriminators (first 8 bytes of account data)
// ---------------------------------------------------------------------------

export const DISCRIMINATOR_MULTISIG = [224, 116, 121, 186, 68, 161, 79, 236];
export const DISCRIMINATOR_VAULT_TX = [168, 250, 162, 100, 81, 14, 162, 207];
export const DISCRIMINATOR_CONFIG_TX = [94, 8, 4, 35, 113, 139, 139, 112];
export const DISCRIMINATOR_PROPOSAL = [26, 94, 189, 187, 116, 136, 53, 33];
export const DISCRIMINATOR_BATCH = [156, 194, 70, 44, 22, 88, 137, 44];

/** Convert a byte array to hex string (browser-safe, no Buffer dependency). */
export function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Map discriminator hex to human-readable name. */
export const DISCRIMINATOR_LABELS: Record<string, string> = {
  [bytesToHex(DISCRIMINATOR_MULTISIG)]: "Multisig",
  [bytesToHex(DISCRIMINATOR_VAULT_TX)]: "VaultTransaction",
  [bytesToHex(DISCRIMINATOR_CONFIG_TX)]: "ConfigTransaction",
  [bytesToHex(DISCRIMINATOR_PROPOSAL)]: "Proposal",
  [bytesToHex(DISCRIMINATOR_BATCH)]: "Batch",
};

// ---------------------------------------------------------------------------
// Well-Known Program IDs
// ---------------------------------------------------------------------------

export const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "System Program",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "Token Program",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb": "Token-2022 Program",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL": "Associated Token Program",
  "ComputeBudget111111111111111111111111111111": "Compute Budget Program",
  "Vote111111111111111111111111111111111111111": "Vote Program",
  "Stake11111111111111111111111111111111111111": "Stake Program",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr": "Memo Program",
  "Memo1UhkJBfCR6MNLVPvTRLYoLuitasPbRv5OjvLQ56M": "Memo Program (v1)",
  [SQUADS_PROGRAM_ID]: "Squads Multisig v4",
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter v6",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "Orca Whirlpool",
  "SysvarRecentB1ockHashes11111111111111111111": "Sysvar: Recent Blockhashes",
  "SysvarC1ock11111111111111111111111111111111": "Sysvar: Clock",
  "SysvarRent111111111111111111111111111111111": "Sysvar: Rent",
  "SysvarS1otHashes111111111111111111111111111": "Sysvar: Slot Hashes",
  "SysvarStakeHistory1111111111111111111111111": "Sysvar: Stake History",
};

/** Get a human-readable label for a program ID, or null if unknown. */
export function getProgramLabel(programId: string): string | null {
  return KNOWN_PROGRAMS[programId] ?? null;
}

// ---------------------------------------------------------------------------
// Instruction Discriminators (Anchor: first 8 bytes of SHA256("global:<name>"))
// ---------------------------------------------------------------------------

/** SHA256("global:proposal_approve") first 8 bytes */
export const DISCRIMINATOR_PROPOSAL_APPROVE = new Uint8Array([
  144, 37, 164, 136, 188, 216, 42, 248,
]);

/** SHA256("global:proposal_reject") first 8 bytes */
export const DISCRIMINATOR_PROPOSAL_REJECT = new Uint8Array([
  243, 62, 134, 156, 230, 106, 246, 135,
]);

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------

/** Default RPC URL (CORS-friendly public endpoint). */
export const DEFAULT_RPC_URL = "https://solana-rpc.publicnode.com";

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const PERMISSION_INITIATE = 1;
export const PERMISSION_VOTE = 2;
export const PERMISSION_EXECUTE = 4;

/** Convert a permission bitmask to a list of human-readable permission names. */
export function formatPermissions(mask: number): string[] {
  const perms: string[] = [];
  if (mask & PERMISSION_INITIATE) perms.push("Initiate");
  if (mask & PERMISSION_VOTE) perms.push("Vote");
  if (mask & PERMISSION_EXECUTE) perms.push("Execute");
  return perms;
}

// ---------------------------------------------------------------------------
// Solana Constants
// ---------------------------------------------------------------------------

export const LAMPORTS_PER_SOL = 1_000_000_000;

// ---------------------------------------------------------------------------
// Known Token Mints (top ~100 by market cap / usage)
// ---------------------------------------------------------------------------

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}

/** Map of token mint address -> token info for well-known Solana tokens. */
export const KNOWN_TOKENS: Record<string, TokenInfo> = {
  // Native / Wrapped SOL
  "So11111111111111111111111111111111111111112": { symbol: "SOL", name: "Wrapped SOL", decimals: 9 },

  // Stablecoins
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USD", decimals: 6 },
  "USDSwr9ApdHk5bvJKMjXLj5GZHGHm6FC9HSmCFXe7fw": { symbol: "USDS", name: "USDS", decimals: 6 },
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": { symbol: "PYUSD", name: "PayPal USD", decimals: 6 },
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": { symbol: "WIF", name: "dogwifhat", decimals: 6 },

  // Major DeFi / Infrastructure
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", name: "Marinade Staked SOL", decimals: 9 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", name: "Lido Staked SOL", decimals: 9 },
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "JitoSOL", name: "Jito Staked SOL", decimals: 9 },
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1": { symbol: "bSOL", name: "BlazeStake Staked SOL", decimals: 9 },
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v": { symbol: "jupSOL", name: "Jupiter Staked SOL", decimals: 9 },
  "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A": { symbol: "hSOL", name: "Helius Staked SOL", decimals: 9 },
  "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp": { symbol: "LST", name: "Liquid Staking Token", decimals: 9 },
  "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7": { symbol: "vSOL", name: "The Vault SOL", decimals: 9 },
  "edge86g9cVz87xcpKpy3J77vbp4wYd9idEV562CCntt": { symbol: "edgeSOL", name: "Edgevana Staked SOL", decimals: 9 },
  "inf5goPhMa4DPEPJn4JcJhMbk3jp3RsivTwRmWF3vVN": { symbol: "INF", name: "Infinity (Sanctum)", decimals: 9 },

  // Governance / Protocol Tokens
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": { symbol: "JUP", name: "Jupiter", decimals: 6 },
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": { symbol: "PYTH", name: "Pyth Network", decimals: 6 },
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": { symbol: "RNDR", name: "Render Token", decimals: 8 },
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux": { symbol: "HNT", name: "Helium", decimals: 8 },
  "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns": { symbol: "IOT", name: "Helium IOT", decimals: 6 },
  "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6": { symbol: "MOBILE", name: "Helium Mobile", decimals: 6 },
  "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m": { symbol: "MPLX", name: "Metaplex", decimals: 6 },
  "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey": { symbol: "MNDE", name: "Marinade", decimals: 9 },
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL": { symbol: "JTO", name: "Jito", decimals: 9 },
  "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6": { symbol: "TNSR", name: "Tensor", decimals: 9 },
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk": { symbol: "WEN", name: "Wen", decimals: 5 },
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ": { symbol: "W", name: "Wormhole", decimals: 6 },
  "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y": { symbol: "SHDW", name: "Shadow Token", decimals: 9 },
  "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7D": { symbol: "DRIFT", name: "Drift", decimals: 6 },
  "KMNo3nJsBXfcFuFMoP3yUZjTFtQFRBZ3WeAkdBSNnpk": { symbol: "KMNO", name: "Kamino", decimals: 6 },

  // Memecoins
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", name: "Bonk", decimals: 5 },
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": { symbol: "POPCAT", name: "Popcat", decimals: 9 },
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5": { symbol: "MEW", name: "cat in a dogs world", decimals: 5 },
  "A8C3xuqscfmyLrte3VVY3lEkn7Jh7z86Kj9VPEETAmPa": { symbol: "PENGU", name: "Pudgy Penguins", decimals: 6 },
  "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu": { symbol: "CLOUD", name: "Cloud", decimals: 9 },
  "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs": { symbol: "GRASS", name: "Grass", decimals: 9 },
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82": { symbol: "BOME", name: "Book of Meme", decimals: 6 },

  // DeFi Tokens
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", name: "Wrapped Ether (Wormhole)", decimals: 8 },
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": { symbol: "wBTC", name: "Wrapped BTC (Wormhole)", decimals: 8 },
  "EzfnjRUKtc5vweE1GCLdHV4MkDQ3ebSpQXLobSKgQ9RB": { symbol: "SOL-PERP", name: "SOL Perpetual", decimals: 9 },
  "RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a": { symbol: "RLB", name: "Rollbit Coin", decimals: 2 },
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": { symbol: "ORCA", name: "Orca", decimals: 6 },
  "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt": { symbol: "SRM", name: "Serum", decimals: 6 },
  "RAYsTRZsJzhdSp7AQKVY9Vn1Q6bzR2HMcjDRsJ7CZFF": { symbol: "RAY", name: "Raydium", decimals: 6 },
  "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac": { symbol: "MNGO", name: "Mango", decimals: 6 },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": { symbol: "RAY", name: "Raydium (v1)", decimals: 6 },
  "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT": { symbol: "STEP", name: "Step Finance", decimals: 9 },

  // Bridges / Cross-chain
  "A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM": { symbol: "USDCet", name: "USDC (Wormhole Ethereum)", decimals: 6 },
  "Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1": { symbol: "USDTet", name: "USDT (Wormhole Ethereum)", decimals: 6 },

  // Gaming / NFT
  "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx": { symbol: "ATLAS", name: "Star Atlas", decimals: 8 },
  "poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk": { symbol: "POLIS", name: "Star Atlas DAO", decimals: 8 },
  "DUST1111111111111111111111111111111111111111": { symbol: "DUST", name: "DUST Protocol", decimals: 9 },

  // Misc
  "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7": { symbol: "NOS", name: "Nosana", decimals: 6 },
  "BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K": { symbol: "IO", name: "io.net", decimals: 8 },
  "EchesyfXePKdLtoiZSL8pBe8Myovy9p5XT5a7pE7BkgB": { symbol: "PRCL", name: "Parcl", decimals: 6 },
  "6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU": { symbol: "tBTC", name: "tBTC (Wormhole)", decimals: 8 },
  "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": { symbol: "JLP", name: "Jupiter LP", decimals: 6 },
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm": { symbol: "INF", name: "Socean Infinity", decimals: 9 },
  "7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBBjY5i8PcYA7Rl": { symbol: "GMT", name: "STEPN", decimals: 9 },
  "AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB": { symbol: "GST", name: "STEPN Green Satoshi", decimals: 9 },
  "SLNDpmoWTVADgEdndyvWzroNKDlCE4X5hSFJiyGPBho": { symbol: "SLND", name: "Solend", decimals: 6 },
  "kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6": { symbol: "KIN", name: "Kin", decimals: 5 },
  "EKRk77VmRU4KLXES1KTa5kLejkvNYSMNDFT6TBf4pJai": { symbol: "NEON", name: "Neon EVM", decimals: 9 },
  "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC": { symbol: "PONKE", name: "Ponke", decimals: 9 },
  "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN": { symbol: "MOTHER", name: "Mother Iggy", decimals: 6 },
  "DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ": { symbol: "DUST", name: "DUST Protocol", decimals: 9 },
  "3psH1Mj1f7yUfaD5gh6Zj7epE8hhrMkMETgv5TshQA4o": { symbol: "CROWN", name: "Crown", decimals: 9 },

  // Sanctum LST tokens
  "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs": { symbol: "bonkSOL", name: "Bonk Staked SOL", decimals: 9 },
  "picobAEvs6w7QEknPce34wAE4gknZA9v5tTonnmHYdX": { symbol: "picoSOL", name: "picoSOL", decimals: 9 },
  "Comp4ssDzXcLeu2MnLuGNNFC4cmLPMng8qWHPvzAMU1h": { symbol: "compassSOL", name: "Compass SOL", decimals: 9 },
  "LAinEtNLgpmCP9Rvsf5Hn8W6EhNiKLZQv1sFR23h2Ep": { symbol: "laineSOL", name: "Laine Staked SOL", decimals: 9 },
  "pathdXw4He1Xk3eX84pDdDZnGKEme3GivBamGCVPZ5a": { symbol: "pathSOL", name: "Pathfinders SOL", decimals: 9 },

  // xStocks (Tokenized Equities by Backed/xStocks.com) — Token-2022, 8 decimals
  "XsHtf5RpxsQ7jeJ9ivNewouZKJHbPxhPoEy6yYvULr7": { symbol: "ABTx", name: "Abbott xStock", decimals: 8 },
  "XswbinNKyPmzTa5CskMbCPvMW6G5CMnZXZEeQSSQoie": { symbol: "ABBVx", name: "AbbVie xStock", decimals: 8 },
  "XsTTtPA5V19YwHKDv4xeVXNM6kdsQNJvg3MyWkRUckt": { symbol: "PALLx", name: "abrdn Physical Palladium xStock", decimals: 8 },
  "Xst6eFD4YT6sz9RLMysN9SyvaZWtraSdVJQGu5ZkAme": { symbol: "PPLTx", name: "abrdn Physical Platinum xStock", decimals: 8 },
  "Xs5UJzmCRQ8DWZjskExdSQDnbE6iLkRu2jjrRAB1JSU": { symbol: "ACNx", name: "Accenture xStock", decimals: 8 },
  "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN": { symbol: "GOOGLx", name: "Alphabet xStock", decimals: 8 },
  "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg": { symbol: "AMZNx", name: "Amazon xStock", decimals: 8 },
  "XsaQTCgebC2KPbf27KUhdv5JFvHhQ4GDAPURwrEhAzb": { symbol: "AMBRx", name: "Amber xStock", decimals: 8 },
  "XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF": { symbol: "AMDx", name: "AMD xStock", decimals: 8 },
  "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp": { symbol: "AAPLx", name: "Apple xStock", decimals: 8 },
  "XsPdAVBi8Zc1xvv53k4JcMrQaEDTgkGqKYeh7AYgPHV": { symbol: "APPx", name: "AppLovin xStock", decimals: 8 },
  "Xs3ZFkPYT2BN7qBMqf1j1bfTeTm1rFzEFSsQ1z3wAKU": { symbol: "AZNx", name: "AstraZeneca xStock", decimals: 8 },
  "XswsQk4duEQmCbGzfqUUWYmi7pV7xpJ9eEmLHXCaEQP": { symbol: "BACx", name: "Bank of America xStock", decimals: 8 },
  "Xs6B6zawENwAbWVi7w92rjazLuAr5Az59qgWKcNb45x": { symbol: "BRK.Bx", name: "Berkshire Hathaway xStock", decimals: 8 },
  "XsPLBFy59Q3hY59KLAJur8QyvziMF4xUxGTxXqXE7cT": { symbol: "BTBTx", name: "Bit Digital xStock", decimals: 8 },
  "XsvHMmbDcd14DHHW16PkxPGW7ks77ehxUv1E9Zmxgj4": { symbol: "BTGOx", name: "BitGo xStock", decimals: 8 },
  "XsrBCwaH8c46xiqXBChzobgufRKxQxAWUWbndgBNzFn": { symbol: "BMNRx", name: "Bitmine xStock", decimals: 8 },
  "XsgSaSvNSqLTtFuyWPBhK9196Xb9Bbdyjj4fH3cPJGo": { symbol: "AVGOx", name: "Broadcom xStock", decimals: 8 },
  "XsNNMt7WTNA2sV3jrb1NNfNgapxRF5i4i6GcnTRRHts": { symbol: "CVXx", name: "Chevron xStock", decimals: 8 },
  "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1": { symbol: "CRCLx", name: "Circle xStock", decimals: 8 },
  "Xsr3pdLQyXvDJBFgpR5nexCEZwXvigb8wbPYp4YoNFf": { symbol: "CSCOx", name: "Cisco xStock", decimals: 8 },
  "XsaBXg8dU5cPM6ehmVctMkVqoiRG2ZjMo1cyBJ3AykQ": { symbol: "KOx", name: "Coca-Cola xStock", decimals: 8 },
  "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu": { symbol: "COINx", name: "Coinbase xStock", decimals: 8 },
  "XsvKCaNsxg2GN8jjUmq71qukMJr7Q1c5R2Mk9P8kcS8": { symbol: "CMCSAx", name: "Comcast xStock", decimals: 8 },
  "XsFnZawJdLdXfBSEt5Vw29K5vdBiHotdPLjUPafpfHs": { symbol: "IEMGx", name: "Core MSCI Emerging Markets xStock", decimals: 8 },
  "Xs7xXqkcK7K8urEqGg52SECi79dRp2cEKKuYjUePYDw": { symbol: "CRWDx", name: "CrowdStrike xStock", decimals: 8 },
  "Xseo8tgCZfkHxWS9xbFYeKFyMSbWEvZGFV1Gh53GtCV": { symbol: "DHRx", name: "Danaher xStock", decimals: 8 },
  "Xs2yquAgsHByNzx68WJC55WHjHBvG9JsMB7CWjTLyPy": { symbol: "DFDVx", name: "DFDV xStock", decimals: 8 },
  "Xsnuv4omNoHozR6EEW5mXkw8Nrny5rB3jVfLqi6gKMH": { symbol: "LLYx", name: "Eli Lilly xStock", decimals: 8 },
  "XsaHND8sHyfMfsWPj6kSdd5VwvCayZvjYgKmmcNL5qh": { symbol: "XOMx", name: "Exxon Mobil xStock", decimals: 8 },
  "Xsf9mBktVB9BSU5kf4nHxPq5hCBJ2j2ui3ecFGxPRGc": { symbol: "GMEx", name: "GameStop xStock", decimals: 8 },
  "XsybfiKkD4UmjkAGT2uR8X2sq9AWFtvGJM2KTffoALZ": { symbol: "COPXx", name: "Global X Copper Miners xStock", decimals: 8 },
  "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re": { symbol: "GLDx", name: "Gold xStock", decimals: 8 },
  "XsgaUyp4jd1fNBCxgtTKkW64xnnhQcvgaxzsbAq5ZD1": { symbol: "GSx", name: "Goldman Sachs xStock", decimals: 8 },
  "XszjVtyhowGjSC5odCqBpW1CtXXwXjYokymrk7fGKD3": { symbol: "HDx", name: "Home Depot xStock", decimals: 8 },
  "XsRbLZthfABAPAfumWNEJhPyiKDW6TvDVeAeW7oKqA2": { symbol: "HONx", name: "Honeywell xStock", decimals: 8 },
  "XshPgPdXFRWB8tP1j82rebb2Q9rPgGX37RuqzohmArM": { symbol: "INTCx", name: "Intel xStock", decimals: 8 },
  "XspwhyYPdWVM8XBHZnpS9hgyag9MKjLRyE3tVfmCbSr": { symbol: "IBMx", name: "IBM xStock", decimals: 8 },
  "XsxAd6okt8y1RRK6gNg7iJaqiWNiq5Md5EDf3ZrF2dm": { symbol: "SLVx", name: "iShares Silver Trust xStock", decimals: 8 },
  "XsGVi5eo1Dh2zUpic4qACcjuWGjNv8GCt3dm5XcX6Dn": { symbol: "JNJx", name: "Johnson & Johnson xStock", decimals: 8 },
  "XsMAqkcKsUewDrzVkait4e5u4y8REgtyS7jWgCpLV2C": { symbol: "JPMx", name: "JPMorgan Chase xStock", decimals: 8 },
  "XsAiRejKuvLAdq9KtedrMSrabz7SWdzKoVK6Qgac1Ki": { symbol: "KRAQx", name: "KRAQ xStock", decimals: 8 },
  "XsSr8anD1hkvNMu8XQiVcmiaTP7XGvYu7Q58LdmtE8Z": { symbol: "LINx", name: "Linde xStock", decimals: 8 },
  "XsuxRGDzbLjnJ72v74b7p9VY6N66uYgTCyfwwRjVCJA": { symbol: "MRVLx", name: "Marvell xStock", decimals: 8 },
  "XsApJFV9MAktqnAc6jqzsHVujxkGm9xcSUffaBoYLKC": { symbol: "MAx", name: "Mastercard xStock", decimals: 8 },
  "XsqE9cRRpzxcGKDXj1BJ7Xmg4GRhZoyY1KpmGSxAWT2": { symbol: "MCDx", name: "McDonald's xStock", decimals: 8 },
  "XsDgw22qRLTv5Uwuzn6T63cW69exG41T6gwQhEK22u2": { symbol: "MDTx", name: "Medtronic xStock", decimals: 8 },
  "XsnQnU7AdbRZYe2akqqpibDdXjkieGFfSkbkjX1Sd1X": { symbol: "MRKx", name: "Merck xStock", decimals: 8 },
  "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu": { symbol: "METAx", name: "Meta xStock", decimals: 8 },
  "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX": { symbol: "MSFTx", name: "Microsoft xStock", decimals: 8 },
  "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ": { symbol: "MSTRx", name: "MicroStrategy xStock", decimals: 8 },
  "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ": { symbol: "QQQx", name: "Nasdaq xStock", decimals: 8 },
  "XsEH7wWfJJu2ZT3UCFeVfALnVA6CP5ur7Ee11KmzVpL": { symbol: "NFLXx", name: "Netflix xStock", decimals: 8 },
  "XsfAzPzYrYjd4Dpa9BU3cusBsvWfVB9gBcyGC87S57n": { symbol: "NVOx", name: "Novo Nordisk xStock", decimals: 8 },
  "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh": { symbol: "NVDAx", name: "NVIDIA xStock", decimals: 8 },
  "XsGtpmjhmC8kyjVSWL4VicGu36ceq9u55PTgF8bhGv6": { symbol: "OPENx", name: "Opendoor xStock", decimals: 8 },
  "XsjFwUPiLofddX5cWFHW35GCbXcSu1BCUGfxoQAQjeL": { symbol: "ORCLx", name: "Oracle xStock", decimals: 8 },
  "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4": { symbol: "PLTRx", name: "Palantir xStock", decimals: 8 },
  "Xsv99frTRUeornyvCfvhnDesQDWuvns1M852Pez91vF": { symbol: "PEPx", name: "PepsiCo xStock", decimals: 8 },
  "XsAtbqkAP1HJxy7hFDeq7ok6yM43DQ9mQ1Rh861X8rw": { symbol: "PFEx", name: "Pfizer xStock", decimals: 8 },
  "Xsba6tUnSjDae2VcopDB6FGGDaxRrewFCDa5hKn5vT3": { symbol: "PMx", name: "Philip Morris xStock", decimals: 8 },
  "XsYdjDjNUygZ7yGKfQaB6TxLh2gC6RRjzLtLAGJrhzV": { symbol: "PGx", name: "Procter & Gamble xStock", decimals: 8 },
  "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg": { symbol: "HOODx", name: "Robinhood xStock", decimals: 8 },
  "XsbELVbLGBkn7xfMfyYuUipKGt1iRUc2B7pYRvFTFu3": { symbol: "IWMx", name: "Russell 2000 xStock", decimals: 8 },
  "XsyZcb97BzETAqi9BoP2C9D196MiMNBisGMVNje2Thz": { symbol: "IJRx", name: "S&P Small Cap xStock", decimals: 8 },
  "XsczbcQ3zfcgAEt9qHQES8pxKAVG5rujPSHQEXi4kaN": { symbol: "CRMx", name: "Salesforce xStock", decimals: 8 },
  "XsWAnFM77x6YvpdaZoos79R12o4Yj4r7EVkaTWddzhU": { symbol: "SCHFx", name: "Schwab International Equity xStock", decimals: 8 },
  "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W": { symbol: "SPYx", name: "S&P 500 xStock", decimals: 8 },
  "Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH": { symbol: "STRCx", name: "Strategy PP Variable xStock", decimals: 8 },
  "XsqBC5tcVQLYt8wqGCHRnAUUecbRYXoJCReD6w7QEKp": { symbol: "TBLLx", name: "TBLL xStock", decimals: 8 },
  "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB": { symbol: "TSLAx", name: "Tesla xStock", decimals: 8 },
  "Xs8drBWy3Sd5QY3aifG9kt9KFs2K3PGZmx7jWrsrk57": { symbol: "TMOx", name: "Thermo Fisher xStock", decimals: 8 },
  "XscE4GUcsYhcyZu5ATiGUMmhxYa1D5fwbpJw4K6K4dp": { symbol: "TONXx", name: "TON xStock", decimals: 8 },
  "XsjQP3iMAaQ3kQScQKthQpx9ALRbjKAjQtHg6TFomoc": { symbol: "TQQQx", name: "TQQQ xStock", decimals: 8 },
  "XszvaiXGPwvk2nwb3o9C1CX4K6zH8sez11E6uyup6fe": { symbol: "UNHx", name: "UnitedHealth xStock", decimals: 8 },
  "XsEdDDTcVGJU6nvdRdVnj53eKTrsCkvtrVfXGmUK68V": { symbol: "VTx", name: "Vanguard Total World xStock", decimals: 8 },
  "XsssYEQjzxBCFgvYFFNuhJFBeHNdLWYeUSP8F45cDr9": { symbol: "VTIx", name: "Vanguard xStock", decimals: 8 },
  "XsqgsbXwWogGJsNcVZ3TyVouy2MbTkfCFhCGGGcQZ2p": { symbol: "VZx", name: "Verizon xStock", decimals: 8 },
  "Xs151QeqTCiuKtinzfRATnUESM2xTU6V9Wy8Vy538ci": { symbol: "Vx", name: "Visa xStock", decimals: 8 },
  "XRTnFKtpy8YXPE8TGd6bhNMyng9SdGaLKZNbapQoH8h": { symbol: "XRT", name: "xStocks Rewards Token", decimals: 8 },
};

/** Look up a token by its mint address. Returns null if unknown. */
export function getTokenInfo(mintAddress: string): TokenInfo | null {
  return KNOWN_TOKENS[mintAddress] ?? null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default number of transactions to scan. */
export const DEFAULT_TX_LIMIT = 20;

/** Maximum number of accounts to fetch in a single getMultipleAccountsInfo call. */
export const BATCH_SIZE = 100;
