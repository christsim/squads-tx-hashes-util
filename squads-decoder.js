/**
 * Squads Decoder
 * https://github.com/christsim/squads-tx-hashes-util
 * MIT License — USE AT YOUR OWN RISK
 * Zero dependencies. Works in browsers and Node.js 16+.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);
const ALPHABET_MAP = new Map(
  ALPHABET.split("").map((c, i) => [c, BigInt(i)])
);
function encode(bytes) {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let num = BigInt(0);
  for (const b of bytes) {
    num = num * 256n + BigInt(b);
  }
  let str = "";
  while (num > 0n) {
    str = ALPHABET[Number(num % BASE)] + str;
    num = num / BASE;
  }
  return "1".repeat(zeros) + str;
}
function decode(str) {
  if (str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;
  let num = BigInt(0);
  for (const c of str) {
    const val = ALPHABET_MAP.get(c);
    if (val === void 0) {
      throw new Error(`Invalid base58 character: "${c}"`);
    }
    num = num * BASE + val;
  }
  const hex = num === 0n ? "" : num.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  const byteLen = padded.length / 2;
  const result = new Uint8Array(zeros + byteLen);
  for (let i = 0; i < byteLen; i++) {
    result[zeros + i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}
const SQUADS_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
const DISCRIMINATOR_MULTISIG = [224, 116, 121, 186, 68, 161, 79, 236];
const DISCRIMINATOR_VAULT_TX = [168, 250, 162, 100, 81, 14, 162, 207];
const DISCRIMINATOR_CONFIG_TX = [94, 8, 4, 35, 113, 139, 139, 112];
const DISCRIMINATOR_PROPOSAL = [26, 94, 189, 187, 116, 136, 53, 33];
const DISCRIMINATOR_BATCH = [156, 194, 70, 44, 22, 88, 137, 44];
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
({
  [bytesToHex(DISCRIMINATOR_MULTISIG)]: "Multisig",
  [bytesToHex(DISCRIMINATOR_VAULT_TX)]: "VaultTransaction",
  [bytesToHex(DISCRIMINATOR_CONFIG_TX)]: "ConfigTransaction",
  [bytesToHex(DISCRIMINATOR_PROPOSAL)]: "Proposal",
  [bytesToHex(DISCRIMINATOR_BATCH)]: "Batch"
});
const KNOWN_PROGRAMS = {
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
  "SysvarStakeHistory1111111111111111111111111": "Sysvar: Stake History"
};
function getProgramLabel(programId) {
  return KNOWN_PROGRAMS[programId] ?? null;
}
const DISCRIMINATOR_PROPOSAL_APPROVE = new Uint8Array([
  144,
  37,
  164,
  136,
  188,
  216,
  42,
  248
]);
const DISCRIMINATOR_PROPOSAL_REJECT = new Uint8Array([
  243,
  62,
  134,
  156,
  230,
  106,
  246,
  135
]);
const PERMISSION_INITIATE = 1;
const PERMISSION_VOTE = 2;
const PERMISSION_EXECUTE = 4;
function formatPermissions(mask) {
  const perms = [];
  if (mask & PERMISSION_INITIATE) perms.push("Initiate");
  if (mask & PERMISSION_VOTE) perms.push("Vote");
  if (mask & PERMISSION_EXECUTE) perms.push("Execute");
  return perms;
}
const KNOWN_TOKENS = {
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
  "XRTnFKtpy8YXPE8TGd6bhNMyng9SdGaLKZNbapQoH8h": { symbol: "XRT", name: "xStocks Rewards Token", decimals: 8 }
};
function getTokenInfo(mintAddress) {
  return KNOWN_TOKENS[mintAddress] ?? null;
}
class ByteReader {
  constructor(data) {
    this.data = data;
    this.offset = 0;
  }
  get remaining() {
    return this.data.length - this.offset;
  }
  get position() {
    return this.offset;
  }
  readU8() {
    if (this.offset >= this.data.length) {
      throw new Error(`Unexpected end of data at offset ${this.offset}`);
    }
    return this.data[this.offset++];
  }
  readBytes(n) {
    if (this.offset + n > this.data.length) {
      throw new Error(
        `Unexpected end of data: need ${n} bytes at offset ${this.offset}, have ${this.remaining}`
      );
    }
    const result = this.data.slice(this.offset, this.offset + n);
    this.offset += n;
    return result;
  }
  readCompactU16() {
    let value = 0;
    let shift = 0;
    for (let i = 0; i < 3; i++) {
      const b = this.readU8();
      value |= (b & 127) << shift;
      if ((b & 128) === 0) {
        return value;
      }
      shift += 7;
    }
    throw new Error(`Invalid compact-u16 at offset ${this.offset}`);
  }
  readPubkey() {
    const bytes = this.readBytes(32);
    return encode(bytes);
  }
  readU32LE() {
    const bytes = this.readBytes(4);
    return (bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24) >>> 0;
  }
  readU64LE() {
    const lo = BigInt(this.readU32LE());
    const hi = BigInt(this.readU32LE());
    return hi << 32n | lo;
  }
}
function decodeMessage(messageBytes) {
  const reader = new ByteReader(messageBytes);
  let version;
  const firstByte = messageBytes[0];
  if (firstByte & 128) {
    const versionNum = firstByte & 127;
    if (versionNum !== 0) {
      throw new Error(`Unsupported message version: ${versionNum}`);
    }
    version = "v0";
    reader.readU8();
  } else {
    version = "legacy";
  }
  const numRequiredSignatures = reader.readU8();
  const numReadonlySignedAccounts = reader.readU8();
  const numReadonlyUnsignedAccounts = reader.readU8();
  const header = {
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts
  };
  const numAccountKeys = reader.readCompactU16();
  const accountKeys = [];
  for (let i = 0; i < numAccountKeys; i++) {
    accountKeys.push(reader.readPubkey());
  }
  const recentBlockhash = reader.readPubkey();
  const numInstructions = reader.readCompactU16();
  const instructions = [];
  for (let i = 0; i < numInstructions; i++) {
    const programIdIndex = reader.readU8();
    const numAccounts = reader.readCompactU16();
    const accountIndexes = [];
    for (let j = 0; j < numAccounts; j++) {
      accountIndexes.push(reader.readU8());
    }
    const dataLen = reader.readCompactU16();
    const data = reader.readBytes(dataLen);
    const programId = programIdIndex < accountKeys.length ? accountKeys[programIdIndex] : `unknown(index ${programIdIndex})`;
    const programLabel = KNOWN_PROGRAMS[programId] ?? null;
    const accounts = accountIndexes.map((idx) => ({
      index: idx,
      pubkey: idx < accountKeys.length ? accountKeys[idx] : `unknown(index ${idx})`,
      writable: isWritable(idx, header, numAccountKeys),
      signer: isSigner(idx, header)
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
      decoded: (decodedResult == null ? void 0 : decodedResult.decoded) ?? null,
      decodedDetails: decodedResult == null ? void 0 : decodedResult.details,
      innerInstructions: decodedResult == null ? void 0 : decodedResult.innerInstructions,
      configActions: decodedResult == null ? void 0 : decodedResult.configActions
    });
  }
  const addressTableLookups = [];
  if (version === "v0" && reader.remaining > 0) {
    const numALTs = reader.readCompactU16();
    for (let i = 0; i < numALTs; i++) {
      const accountKey = reader.readPubkey();
      const numWritable = reader.readCompactU16();
      const writableIndexes = [];
      for (let j = 0; j < numWritable; j++) {
        writableIndexes.push(reader.readU8());
      }
      const numReadonly = reader.readCompactU16();
      const readonlyIndexes = [];
      for (let j = 0; j < numReadonly; j++) {
        readonlyIndexes.push(reader.readU8());
      }
      addressTableLookups.push({
        accountKey,
        writableIndexes,
        readonlyIndexes
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
    size: messageBytes.length
  };
}
function isSigner(index, header) {
  return index < header.numRequiredSignatures;
}
function isWritable(index, header, numAccountKeys) {
  if (index < header.numRequiredSignatures) {
    const writableSignerEnd = header.numRequiredSignatures - header.numReadonlySignedAccounts;
    return index < writableSignerEnd;
  }
  const readonlyStart = numAccountKeys - header.numReadonlyUnsignedAccounts;
  return index < readonlyStart;
}
const COMPUTE_BUDGET_ID = "ComputeBudget111111111111111111111111111111";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOC_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
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
function matchesBytes(data, expected) {
  if (data.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}
function readU32LE(data, offset) {
  return (data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24) >>> 0;
}
function readU64LE(data, offset) {
  const lo = BigInt(readU32LE(data, offset));
  const hi = BigInt(readU32LE(data, offset + 4));
  return hi << 32n | lo;
}
function decodeInstructionData(programId, data) {
  if (programId === SQUADS_PROGRAM_ID) {
    return decodeSquadsInstruction(data);
  }
  if (programId === COMPUTE_BUDGET_ID) {
    return decodeComputeBudget(data);
  }
  if (programId === SYSTEM_PROGRAM_ID) {
    return decodeSystemProgram(data);
  }
  if (programId === TOKEN_PROGRAM_ID || programId === TOKEN_2022_PROGRAM_ID) {
    return decodeTokenProgram(data);
  }
  if (programId === ASSOC_TOKEN_PROGRAM_ID) {
    return decodeAssociatedTokenProgram(data);
  }
  return null;
}
function decodeSquadsInstruction(data) {
  if (data.length < 8) return null;
  if (matchesBytes(data, DISCRIMINATOR_PROPOSAL_APPROVE)) {
    const memo = decodeMemoField(data, 8);
    return {
      decoded: `proposal_approve${memo.text}`,
      details: memo.value ? { Memo: memo.value } : void 0
    };
  }
  if (matchesBytes(data, DISCRIMINATOR_PROPOSAL_REJECT)) {
    const memo = decodeMemoField(data, 8);
    return {
      decoded: `proposal_reject${memo.text}`,
      details: memo.value ? { Memo: memo.value } : void 0
    };
  }
  if (matchesBytes(data, DISC_VAULT_TX_CREATE)) {
    return decodeVaultTransactionCreate(data);
  }
  if (matchesBytes(data, DISC_PROPOSAL_CREATE)) {
    return decodeProposalCreate(data);
  }
  if (matchesBytes(data, DISC_VAULT_TX_EXECUTE)) {
    return { decoded: "vault_transaction_execute" };
  }
  if (matchesBytes(data, DISC_PROPOSAL_ACTIVATE)) {
    return { decoded: "proposal_activate" };
  }
  if (matchesBytes(data, DISC_CONFIG_TX_CREATE)) {
    return decodeConfigTransactionCreate(data);
  }
  if (matchesBytes(data, DISC_CONFIG_TX_EXECUTE)) {
    return { decoded: "config_transaction_execute" };
  }
  if (matchesBytes(data, DISC_BATCH_CREATE)) {
    return { decoded: "batch_create" };
  }
  if (matchesBytes(data, DISC_BATCH_ADD_TX)) {
    return { decoded: "batch_add_transaction" };
  }
  if (matchesBytes(data, DISC_BATCH_EXECUTE_TX)) {
    return { decoded: "batch_execute_transaction" };
  }
  if (matchesBytes(data, DISC_MULTISIG_CREATE)) {
    return { decoded: "multisig_create" };
  }
  if (matchesBytes(data, DISC_MULTISIG_CREATE_V2)) {
    return { decoded: "multisig_create_v2" };
  }
  if (matchesBytes(data, DISC_SPENDING_LIMIT_USE)) {
    return { decoded: "spending_limit_use" };
  }
  if (matchesBytes(data, DISC_VAULT_TX_ACCOUNTS_CLOSE)) {
    return { decoded: "vault_transaction_accounts_close" };
  }
  if (matchesBytes(data, DISC_PROPOSAL_ACCOUNTS_CLOSE)) {
    return { decoded: "proposal_accounts_close" };
  }
  if (matchesBytes(data, DISC_CONFIG_TX_ACCOUNTS_CLOSE)) {
    return { decoded: "config_transaction_accounts_close" };
  }
  if (matchesBytes(data, DISC_BATCH_ACCOUNTS_CLOSE)) {
    return { decoded: "batch_accounts_close" };
  }
  if (matchesBytes(data, DISC_PROPOSAL_CANCEL)) {
    return { decoded: "proposal_cancel" };
  }
  if (matchesBytes(data, DISC_PROPOSAL_CANCEL_V2)) {
    return { decoded: "proposal_cancel_v2" };
  }
  if (matchesBytes(data, DISC_VAULT_TX_CREATE_V2)) {
    return decodeVaultTransactionCreate(data);
  }
  return {
    decoded: `Squads instruction (discriminator: ${bytesToHex(data.slice(0, 8))})`
  };
}
function decodeVaultTransactionCreate(data) {
  const details = {};
  let innerInstructions;
  if (data.length < 14) {
    return {
      decoded: "vault_transaction_create (truncated)",
      details
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
      details
    };
  }
  const msgBytes = data.slice(14, 14 + msgLen);
  try {
    const parsed = decodeSquadsVaultMessage(msgBytes);
    details["Inner Signers"] = parsed.numSigners.toString();
    details["Inner Writable Signers"] = parsed.numWritableSigners.toString();
    details["Inner Writable Non-Signers"] = parsed.numWritableNonSigners.toString();
    details["Inner Account Keys"] = parsed.accountKeys.length.toString();
    details["Inner Instructions"] = parsed.instructions.length.toString();
    innerInstructions = parsed.instructions;
  } catch {
    details["Inner Message"] = "Failed to parse";
  }
  const memoOffset = 14 + msgLen;
  const memo = decodeMemoField(data, memoOffset);
  if (memo.value) {
    details["Memo"] = memo.value;
  }
  const ixCount = (innerInstructions == null ? void 0 : innerInstructions.length) ?? "?";
  return {
    decoded: `vault_transaction_create (vault: ${vaultIndex}, ${ixCount} inner ix${memo.text})`,
    details,
    innerInstructions
  };
}
function decodeSquadsVaultMessage(msgBytes) {
  const reader = new ByteReader(msgBytes);
  const numSigners = reader.readU8();
  const numWritableSigners = reader.readU8();
  const numWritableNonSigners = reader.readU8();
  const numAccountKeys = reader.readU8();
  const accountKeys = [];
  for (let i = 0; i < numAccountKeys; i++) {
    accountKeys.push(reader.readPubkey());
  }
  const numInstructions = reader.readU8();
  const instructions = [];
  for (let i = 0; i < numInstructions; i++) {
    const programIdIndex = reader.readU8();
    const numAccIndexes = reader.readU8();
    const accIndexes = [];
    for (let j = 0; j < numAccIndexes; j++) {
      accIndexes.push(reader.readU8());
    }
    const dataLenLo = reader.readU8();
    const dataLenHi = reader.readU8();
    const dataLen = dataLenLo | dataLenHi << 8;
    const ixData = reader.readBytes(dataLen);
    const progId = programIdIndex < accountKeys.length ? accountKeys[programIdIndex] : `unknown(index ${programIdIndex})`;
    const progLabel = KNOWN_PROGRAMS[progId] ?? null;
    const accounts = accIndexes.map(
      (idx) => idx < accountKeys.length ? accountKeys[idx] : `unknown(index ${idx})`
    );
    const innerDecoded = decodeInstructionData(progId, ixData);
    let enrichedLabels = innerDecoded == null ? void 0 : innerDecoded.accountLabels;
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
      decoded: (innerDecoded == null ? void 0 : innerDecoded.decoded) ?? null
    });
  }
  return {
    numSigners,
    numWritableSigners,
    numWritableNonSigners,
    accountKeys,
    instructions
  };
}
function decodeConfigTransactionCreate(data) {
  const details = {};
  const configActions = [];
  if (data.length < 12) {
    return {
      decoded: "config_transaction_create (truncated)",
      details
    };
  }
  const numActions = readU32LE(data, 8);
  details["Config Actions"] = numActions.toString();
  let offset = 12;
  const actionDescriptions = [];
  for (let i = 0; i < numActions; i++) {
    if (offset >= data.length) {
      actionDescriptions.push("(truncated)");
      break;
    }
    const variant = data[offset++];
    switch (variant) {
      case 0: {
        if (offset + 33 > data.length) {
          actionDescriptions.push("AddMember (truncated)");
          configActions.push({ type: "Unknown", variant: 0, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const memberKey = encode(data.slice(offset, offset + 32));
        offset += 32;
        const permMask = data[offset++];
        const perms = formatPermissions(permMask);
        configActions.push({
          type: "AddMember",
          member: { key: memberKey, permissions: permMask }
        });
        actionDescriptions.push(`AddMember`);
        details[`Action ${i + 1}`] = "Add Member";
        details[`New Member`] = memberKey;
        details[`Permissions`] = perms.length > 0 ? perms.join(", ") : `(mask: ${permMask})`;
        break;
      }
      case 1: {
        if (offset + 32 > data.length) {
          actionDescriptions.push("RemoveMember (truncated)");
          configActions.push({ type: "Unknown", variant: 1, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const oldMember = encode(data.slice(offset, offset + 32));
        offset += 32;
        configActions.push({ type: "RemoveMember", oldMember });
        actionDescriptions.push(`RemoveMember`);
        details[`Action ${i + 1}`] = "Remove Member";
        details[`Member to Remove`] = oldMember;
        break;
      }
      case 2: {
        if (offset + 2 > data.length) {
          actionDescriptions.push("ChangeThreshold (truncated)");
          configActions.push({ type: "Unknown", variant: 2, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const newThreshold = data[offset] | data[offset + 1] << 8;
        offset += 2;
        configActions.push({ type: "ChangeThreshold", newThreshold });
        actionDescriptions.push(`ChangeThreshold(${newThreshold})`);
        details[`Action ${i + 1}`] = "Change Threshold";
        details[`New Threshold`] = newThreshold.toString();
        break;
      }
      case 3: {
        if (offset + 4 > data.length) {
          actionDescriptions.push("SetTimeLock (truncated)");
          configActions.push({ type: "Unknown", variant: 3, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const newTimeLock = readU32LE(data, offset);
        offset += 4;
        configActions.push({ type: "SetTimeLock", newTimeLock });
        actionDescriptions.push(`SetTimeLock(${newTimeLock}s)`);
        details[`Action ${i + 1}`] = "Set Time Lock";
        details[`New Time Lock`] = `${newTimeLock} seconds`;
        break;
      }
      case 4: {
        const minSize = 32 + 1 + 32 + 8 + 1 + 4 + 4;
        if (offset + minSize > data.length) {
          actionDescriptions.push("AddSpendingLimit (truncated)");
          configActions.push({ type: "Unknown", variant: 4, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const slCreateKey = encode(data.slice(offset, offset + 32));
        offset += 32;
        const slVaultIndex = data[offset++];
        const slMint = encode(data.slice(offset, offset + 32));
        offset += 32;
        const slAmount = readU64LE(data, offset);
        offset += 8;
        const slPeriodByte = data[offset++];
        const periodLabels = ["OneTime", "Day", "Week", "Month"];
        const slPeriod = periodLabels[slPeriodByte] ?? `Unknown(${slPeriodByte})`;
        const slMembersLen = readU32LE(data, offset);
        offset += 4;
        const slMembers = [];
        for (let m = 0; m < slMembersLen; m++) {
          if (offset + 32 > data.length) break;
          slMembers.push(encode(data.slice(offset, offset + 32)));
          offset += 32;
        }
        const slDestsLen = readU32LE(data, offset);
        offset += 4;
        const slDests = [];
        for (let d = 0; d < slDestsLen; d++) {
          if (offset + 32 > data.length) break;
          slDests.push(encode(data.slice(offset, offset + 32)));
          offset += 32;
        }
        const mintInfo = getTokenInfo(slMint);
        mintInfo ? mintInfo.symbol : "tokens";
        configActions.push({
          type: "AddSpendingLimit",
          createKey: slCreateKey,
          vaultIndex: slVaultIndex,
          mint: slMint,
          amount: slAmount,
          period: slPeriod,
          members: slMembers,
          destinations: slDests
        });
        actionDescriptions.push("AddSpendingLimit");
        details[`Action ${i + 1}`] = "Add Spending Limit";
        details[`Spending Limit Mint`] = mintInfo ? `${slMint} [${mintInfo.symbol}]` : slMint;
        details[`Spending Limit Amount`] = mintInfo ? `${Number(slAmount) / Math.pow(10, mintInfo.decimals)} ${mintInfo.symbol} (${slAmount.toLocaleString()} raw)` : slAmount.toLocaleString();
        details[`Spending Limit Period`] = slPeriod;
        details[`Spending Limit Vault`] = slVaultIndex.toString();
        if (slMembers.length > 0) {
          details[`Spending Limit Members`] = slMembers.length.toString();
        }
        if (slDests.length > 0) {
          details[`Spending Limit Destinations`] = slDests.length.toString();
        }
        break;
      }
      case 5: {
        if (offset + 32 > data.length) {
          actionDescriptions.push("RemoveSpendingLimit (truncated)");
          configActions.push({ type: "Unknown", variant: 5, raw: bytesToHex(data.slice(offset)) });
          offset = data.length;
          break;
        }
        const spendingLimit = encode(data.slice(offset, offset + 32));
        offset += 32;
        configActions.push({ type: "RemoveSpendingLimit", spendingLimit });
        actionDescriptions.push("RemoveSpendingLimit");
        details[`Action ${i + 1}`] = "Remove Spending Limit";
        details[`Spending Limit`] = spendingLimit;
        break;
      }
      case 6: {
        if (offset >= data.length) {
          actionDescriptions.push("SetRentCollector (truncated)");
          configActions.push({ type: "Unknown", variant: 6, raw: "" });
          break;
        }
        const optionTag = data[offset++];
        if (optionTag === 1 && offset + 32 <= data.length) {
          const rentCollector = encode(data.slice(offset, offset + 32));
          offset += 32;
          configActions.push({ type: "SetRentCollector", newRentCollector: rentCollector });
          actionDescriptions.push("SetRentCollector");
          details[`Action ${i + 1}`] = "Set Rent Collector";
          details[`Rent Collector`] = rentCollector;
        } else {
          configActions.push({ type: "SetRentCollector", newRentCollector: null });
          actionDescriptions.push("SetRentCollector(none)");
          details[`Action ${i + 1}`] = "Set Rent Collector";
          details[`Rent Collector`] = "(none)";
        }
        break;
      }
      default: {
        const rest = data.slice(offset);
        configActions.push({ type: "Unknown", variant, raw: bytesToHex(rest) });
        actionDescriptions.push(`Unknown(${variant})`);
        details[`Action ${i + 1}`] = `Unknown config action (variant ${variant})`;
        offset = data.length;
        break;
      }
    }
  }
  const memo = decodeMemoField(data, offset);
  if (memo.value) {
    details["Memo"] = memo.value;
  }
  const summary = actionDescriptions.join(", ");
  return {
    decoded: `config_transaction_create (${summary}${memo.text})`,
    details,
    configActions
  };
}
function decodeProposalCreate(data) {
  if (data.length < 17) {
    return { decoded: "proposal_create (truncated)" };
  }
  const txIndex = readU64LE(data, 8);
  const draft = data[16] !== 0;
  return {
    decoded: `proposal_create (tx: ${txIndex}, draft: ${draft})`,
    details: {
      "Transaction Index": txIndex.toString(),
      Draft: draft ? "Yes" : "No"
    }
  };
}
function decodeComputeBudget(data) {
  if (data.length >= 5 && data[0] === 2) {
    const units = readU32LE(data, 1);
    return {
      decoded: `SetComputeUnitLimit: ${units.toLocaleString()} units`,
      details: { "Compute Units": units.toLocaleString() }
    };
  }
  if (data.length >= 9 && data[0] === 3) {
    const price = readU64LE(data, 1);
    return {
      decoded: `SetComputeUnitPrice: ${price.toLocaleString()} microlamports`,
      details: { "Price (microlamports)": price.toLocaleString() }
    };
  }
  if (data.length >= 5 && data[0] === 0) {
    const units = readU32LE(data, 1);
    return {
      decoded: `RequestUnitsDeprecated: ${units.toLocaleString()}`
    };
  }
  return null;
}
function decodeSystemProgram(data) {
  if (data.length < 4) return null;
  const ixType = readU32LE(data, 0);
  switch (ixType) {
    case 0: {
      if (data.length >= 52) {
        const lamports = readU64LE(data, 4);
        const space = readU64LE(data, 12);
        const owner = encode(data.slice(20, 52));
        const sol = Number(lamports) / 1e9;
        return {
          decoded: `CreateAccount (${sol} SOL, ${space} bytes)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString(),
            Space: space.toString(),
            Owner: owner
          }
        };
      }
      return { decoded: "CreateAccount" };
    }
    case 1:
      return { decoded: "Assign" };
    case 2: {
      if (data.length >= 12) {
        const lamports = readU64LE(data, 4);
        const sol = Number(lamports) / 1e9;
        return {
          decoded: `Transfer: ${lamports.toLocaleString()} lamports (${sol} SOL)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString()
          }
        };
      }
      return { decoded: "Transfer" };
    }
    case 3:
      return { decoded: "CreateAccountWithSeed" };
    case 4:
      return { decoded: "AdvanceNonceAccount" };
    case 5: {
      if (data.length >= 12) {
        const lamports = readU64LE(data, 4);
        const sol = Number(lamports) / 1e9;
        return {
          decoded: `WithdrawNonceAccount: ${lamports.toLocaleString()} lamports (${sol} SOL)`,
          details: {
            Lamports: lamports.toLocaleString(),
            SOL: sol.toString()
          }
        };
      }
      return { decoded: "WithdrawNonceAccount" };
    }
    case 6: {
      if (data.length >= 36) {
        const authority = encode(data.slice(4, 36));
        return {
          decoded: "InitializeNonceAccount",
          details: { Authority: authority }
        };
      }
      return { decoded: "InitializeNonceAccount" };
    }
    case 7: {
      if (data.length >= 36) {
        const newAuthority = encode(data.slice(4, 36));
        return {
          decoded: "AuthorizeNonceAccount",
          details: { "New Authority": newAuthority }
        };
      }
      return { decoded: "AuthorizeNonceAccount" };
    }
    case 9:
      return { decoded: "Allocate" };
    default:
      return null;
  }
}
function decodeTokenProgram(data) {
  if (data.length < 1) return null;
  const ixType = data[0];
  switch (ixType) {
    case 1:
      return {
        decoded: "InitializeAccount",
        accountLabels: ["Account", "Mint", "Owner", "Rent Sysvar"]
      };
    case 3: {
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Transfer: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Destination Token Account", "From (Wallet)"]
        };
      }
      return {
        decoded: "Transfer",
        accountLabels: ["Source Token Account", "Destination Token Account", "From (Wallet)"]
      };
    }
    case 4: {
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Approve: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Delegate", "Owner / Signer"]
        };
      }
      return {
        decoded: "Approve",
        accountLabels: ["Source Token Account", "Delegate", "Owner / Signer"]
      };
    }
    case 5:
      return {
        decoded: "Revoke",
        accountLabels: ["Source Token Account", "Owner / Signer"]
      };
    case 7: {
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `MintTo: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Mint", "Destination Token Account", "Owner / Signer"]
        };
      }
      return {
        decoded: "MintTo",
        accountLabels: ["Mint", "Destination Token Account", "Owner / Signer"]
      };
    }
    case 8: {
      if (data.length >= 9) {
        const amount = readU64LE(data, 1);
        return {
          decoded: `Burn: ${amount.toLocaleString()} tokens (raw)`,
          details: { "Raw Amount": amount.toString() },
          accountLabels: ["Source Token Account", "Mint", "Owner / Signer"]
        };
      }
      return {
        decoded: "Burn",
        accountLabels: ["Source Token Account", "Mint", "Owner / Signer"]
      };
    }
    case 9:
      return {
        decoded: "CloseAccount",
        accountLabels: ["Token Account", "Destination (Wallet)", "Owner / Signer"]
      };
    case 10:
      return {
        decoded: "FreezeAccount",
        accountLabels: ["Token Account", "Mint", "Freeze Authority"]
      };
    case 11:
      return {
        decoded: "ThawAccount",
        accountLabels: ["Token Account", "Mint", "Freeze Authority"]
      };
    case 12: {
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `TransferChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: {
            Amount: humanAmount.toString(),
            "Raw Amount": amount.toString(),
            Decimals: decimals.toString()
          },
          accountLabels: ["Source Token Account", "Mint", "Destination Token Account", "From (Wallet)"]
        };
      }
      return {
        decoded: "TransferChecked",
        accountLabels: ["Source Token Account", "Mint", "Destination Token Account", "From (Wallet)"]
      };
    }
    case 13: {
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `ApproveChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: {
            Amount: humanAmount.toString(),
            "Raw Amount": amount.toString(),
            Decimals: decimals.toString()
          },
          accountLabels: ["Source Token Account", "Mint", "Delegate", "Owner / Signer"]
        };
      }
      return {
        decoded: "ApproveChecked",
        accountLabels: ["Source Token Account", "Mint", "Delegate", "Owner / Signer"]
      };
    }
    case 14: {
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `MintToChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: { Amount: humanAmount.toString(), Decimals: decimals.toString() },
          accountLabels: ["Mint", "Destination Token Account", "Mint Authority"]
        };
      }
      return {
        decoded: "MintToChecked",
        accountLabels: ["Mint", "Destination Token Account", "Mint Authority"]
      };
    }
    case 15: {
      if (data.length >= 10) {
        const amount = readU64LE(data, 1);
        const decimals = data[9];
        const humanAmount = Number(amount) / Math.pow(10, decimals);
        return {
          decoded: `BurnChecked: ${humanAmount} tokens (${amount.toLocaleString()} raw, ${decimals} decimals)`,
          details: { Amount: humanAmount.toString(), Decimals: decimals.toString() },
          accountLabels: ["Source Token Account", "Mint", "Owner / Signer"]
        };
      }
      return {
        decoded: "BurnChecked",
        accountLabels: ["Source Token Account", "Mint", "Owner / Signer"]
      };
    }
    case 6:
      return {
        decoded: "SetAuthority",
        accountLabels: ["Token Account", "Current Authority"]
      };
    case 17:
      return { decoded: "SyncNative", accountLabels: ["Token Account"] };
    default:
      return { decoded: `Token instruction ${ixType}` };
  }
}
function decodeAssociatedTokenProgram(data) {
  if (data.length === 0 || data[0] === 0) {
    return {
      decoded: "CreateAssociatedTokenAccount",
      accountLabels: ["Payer", "ATA", "Owner", "Mint", "System Program", "Token Program"]
    };
  }
  if (data[0] === 1) {
    return {
      decoded: "CreateAssociatedTokenAccountIdempotent",
      accountLabels: ["Payer", "ATA", "Owner", "Mint", "System Program", "Token Program"]
    };
  }
  if (data[0] === 2) {
    return {
      decoded: "RecoverNested",
      accountLabels: ["Nested ATA", "Token Mint (nested)", "Dest ATA", "Owner ATA", "Token Mint (owner)", "Owner", "Token Program"]
    };
  }
  return { decoded: `ATA instruction ${data[0]}` };
}
function decodeMemoField(data, offset) {
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
const SAFE_INSTRUCTIONS = /* @__PURE__ */ new Set([
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
  "proposal_accounts_close"
]);
const SAFE_PROGRAMS = /* @__PURE__ */ new Set([
  COMPUTE_BUDGET_ID,
  SQUADS_PROGRAM_ID
]);
function generateTransactionSummary(decoded) {
  var _a;
  const actions = [];
  const warnings = [];
  const outerInstructionSafety = [];
  let multisigPda;
  const SAFE_SYSTEM_INSTRUCTIONS = /* @__PURE__ */ new Set([
    "AdvanceNonceAccount"
  ]);
  for (const ix of decoded.instructions) {
    if (ix.programId === COMPUTE_BUDGET_ID) {
      outerInstructionSafety.push("safe");
    } else if (ix.programId === SYSTEM_PROGRAM_ID) {
      const ixName = ((_a = ix.decoded) == null ? void 0 : _a.split(":")[0].split(" ")[0]) ?? "";
      if (SAFE_SYSTEM_INSTRUCTIONS.has(ixName)) {
        outerInstructionSafety.push("safe");
      } else {
        outerInstructionSafety.push("unknown");
        warnings.push({
          severity: "caution",
          message: `Unexpected System Program instruction at outer level: ${ix.decoded ?? "unknown"}`
        });
      }
    } else if (ix.programId === SQUADS_PROGRAM_ID && ix.decoded) {
      const ixName = ix.decoded.split(" ")[0].split("(")[0];
      if (ixName === "vault_transaction_create" || ixName === "vault_transaction_create_v2" || ixName === "config_transaction_create") {
        outerInstructionSafety.push("review");
        if (ix.accounts.length > 0) {
          multisigPda = ix.accounts[0].pubkey;
        }
        if (ix.configActions && ix.configActions.length > 0) {
          for (const configAction of ix.configActions) {
            actions.push(generateConfigActionSummary(configAction));
          }
        }
        if (ix.innerInstructions) {
          for (const inner of ix.innerInstructions) {
            actions.push(generateActionSummary(inner));
          }
          const ataToOwner = {};
          for (const inner of ix.innerInstructions) {
            if (inner.programId === ASSOC_TOKEN_PROGRAM_ID && inner.decoded !== null && inner.decoded.startsWith("CreateAssociatedTokenAccount") && inner.accounts.length >= 3) {
              const ata = inner.accounts[1];
              const owner = inner.accounts[2];
              ataToOwner[ata] = owner;
            }
          }
          if (Object.keys(ataToOwner).length > 0) {
            for (const action of actions) {
              const toTokenAccount = action.details["To (Token Account)"];
              if (toTokenAccount && ataToOwner[toTokenAccount]) {
                const newDetails = {};
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
        if (ixName !== "config_transaction_create") {
          if (!ix.innerInstructions || ix.innerInstructions.length === 0) {
            warnings.push({
              severity: "danger",
              message: "Vault transaction has no inner instructions — this is unusual."
            });
          } else if (ix.innerInstructions.length > 1) {
            warnings.push({
              severity: "info",
              message: `Vault transaction contains ${ix.innerInstructions.length} inner instructions. Review all of them.`
            });
          }
        }
      } else if (SAFE_INSTRUCTIONS.has(ixName)) {
        outerInstructionSafety.push("safe");
      } else {
        outerInstructionSafety.push("unknown");
        warnings.push({
          severity: "caution",
          message: `Unrecognized Squads instruction: ${ix.decoded}`
        });
      }
    } else if (!SAFE_PROGRAMS.has(ix.programId)) {
      outerInstructionSafety.push("unknown");
      const label = ix.programLabel ?? ix.programId;
      warnings.push({
        severity: "danger",
        message: `Instruction uses program "${label}" which is not a recognized Squads or system program. Verify it is legitimate.`
      });
    } else {
      outerInstructionSafety.push("unknown");
    }
  }
  for (const action of actions) {
    if (action.details["SOL"] !== void 0) {
      const sol = parseFloat(action.details["SOL"]);
      if (!isNaN(sol) && sol > 10) {
        warnings.push({
          severity: "caution",
          message: `Large transfer: ${sol} SOL. Double-check the amount.`
        });
      }
    }
  }
  return { actions, warnings, outerInstructionSafety, multisigPda };
}
function generateActionSummary(inner) {
  const programLabel = inner.programLabel ?? null;
  if (inner.programId === SYSTEM_PROGRAM_ID && inner.decoded && inner.decoded.startsWith("Transfer:")) {
    const from = inner.accounts.length > 0 ? inner.accounts[0] : "unknown";
    const to = inner.accounts.length > 1 ? inner.accounts[1] : "unknown";
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
        SOL: sol
      },
      programId: inner.programId,
      programLabel
    };
  }
  if ((inner.programId === TOKEN_PROGRAM_ID || inner.programId === TOKEN_2022_PROGRAM_ID) && inner.decoded && inner.decoded.startsWith("TransferChecked:")) {
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
    const tokenName = tokenInfo ? `${tokenInfo.symbol} (${tokenInfo.name})` : "unknown token";
    const mintDisplay = tokenInfo ? `${mint} [${tokenInfo.symbol}]` : mint;
    return {
      title: `Transfer ${amount} ${(tokenInfo == null ? void 0 : tokenInfo.symbol) ?? "tokens"}`,
      details: {
        "From (Wallet)": authority,
        "Source Token Account": source,
        "To (Token Account)": destination,
        Token: tokenName,
        Mint: mintDisplay,
        Amount: `${rawAmount} raw (${decimals} decimals) = ${amount}`
      },
      programId: inner.programId,
      programLabel
    };
  }
  if ((inner.programId === TOKEN_PROGRAM_ID || inner.programId === TOKEN_2022_PROGRAM_ID) && inner.decoded && inner.decoded.startsWith("Transfer:")) {
    const source = inner.accounts.length > 0 ? inner.accounts[0] : "unknown";
    const destination = inner.accounts.length > 1 ? inner.accounts[1] : "unknown";
    const authority = inner.accounts.length > 2 ? inner.accounts[2] : "unknown";
    return {
      title: inner.decoded,
      details: {
        "From (Wallet)": authority,
        "Source Token Account": source,
        "To (Token Account)": destination
      },
      programId: inner.programId,
      programLabel
    };
  }
  const details = {
    Program: inner.programLabel ? `${inner.programLabel} (${inner.programId})` : inner.programId
  };
  for (let i = 0; i < inner.accounts.length; i++) {
    const label = inner.accountLabels && i < inner.accountLabels.length ? inner.accountLabels[i] : `Account ${i}`;
    details[label] = inner.accounts[i];
  }
  if (inner.data.length > 0) {
    details["Data Size"] = `${inner.data.length} bytes`;
  }
  return {
    title: inner.decoded ?? "Unknown operation",
    details,
    programId: inner.programId,
    programLabel
  };
}
function generateConfigActionSummary(configAction) {
  switch (configAction.type) {
    case "AddMember": {
      const perms = formatPermissions(configAction.member.permissions);
      return {
        title: "Add Member",
        details: {
          "New Member": configAction.member.key,
          Permissions: perms.length > 0 ? perms.join(", ") : `(mask: ${configAction.member.permissions})`
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    }
    case "RemoveMember":
      return {
        title: "Remove Member",
        details: {
          "Member to Remove": configAction.oldMember
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    case "ChangeThreshold":
      return {
        title: `Change Threshold to ${configAction.newThreshold}`,
        details: {
          "New Threshold": configAction.newThreshold.toString()
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    case "SetTimeLock":
      return {
        title: `Set Time Lock to ${configAction.newTimeLock}s`,
        details: {
          "New Time Lock": `${configAction.newTimeLock} seconds`
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    case "AddSpendingLimit": {
      const slMintInfo = getTokenInfo(configAction.mint);
      const slDetails = {
        Mint: slMintInfo ? `${configAction.mint} [${slMintInfo.symbol}]` : configAction.mint,
        Amount: slMintInfo ? `${Number(configAction.amount) / Math.pow(10, slMintInfo.decimals)} ${slMintInfo.symbol} (${configAction.amount.toLocaleString()} raw)` : configAction.amount.toLocaleString(),
        Period: configAction.period,
        "Vault Index": configAction.vaultIndex.toString(),
        "Create Key": configAction.createKey
      };
      for (let i = 0; i < configAction.members.length; i++) {
        slDetails[`Member ${i + 1}`] = configAction.members[i];
      }
      for (let i = 0; i < configAction.destinations.length; i++) {
        slDetails[`Destination ${i + 1}`] = configAction.destinations[i];
      }
      if (configAction.destinations.length === 0) {
        slDetails["Destinations"] = "(any address)";
      }
      return {
        title: `Add Spending Limit (${(slMintInfo == null ? void 0 : slMintInfo.symbol) ?? "tokens"}, ${configAction.period})`,
        details: slDetails,
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    }
    case "RemoveSpendingLimit":
      return {
        title: "Remove Spending Limit",
        details: {
          "Spending Limit": configAction.spendingLimit
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    case "SetRentCollector":
      return {
        title: "Set Rent Collector",
        details: {
          "Rent Collector": configAction.newRentCollector ?? "(none)"
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
    case "Unknown":
      return {
        title: `Unknown Config Action (variant ${configAction.variant})`,
        details: {
          "Variant": configAction.variant.toString(),
          "Raw Data": configAction.raw
        },
        programId: SQUADS_PROGRAM_ID,
        programLabel: "Squads Multisig v4"
      };
  }
}
function hexToBytes(hex) {
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
function base64ToBytes(b64) {
  const binaryStr = atob(b64.trim());
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
async function sha256(data) {
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}
async function hashRawMessage(messageBytes) {
  const hashBytes = await sha256(messageBytes);
  return encode(hashBytes);
}
export {
  KNOWN_PROGRAMS,
  KNOWN_TOKENS,
  SQUADS_PROGRAM_ID,
  base64ToBytes,
  decode as bs58Decode,
  encode as bs58Encode,
  bytesToHex,
  decodeMessage,
  generateTransactionSummary,
  getProgramLabel,
  getTokenInfo,
  hashRawMessage,
  hexToBytes
};
