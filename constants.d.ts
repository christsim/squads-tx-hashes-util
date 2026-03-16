/** Squads Multisig Program v4 ID */
export declare const SQUADS_PROGRAM_ID = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
export declare const DISCRIMINATOR_MULTISIG: number[];
export declare const DISCRIMINATOR_VAULT_TX: number[];
export declare const DISCRIMINATOR_CONFIG_TX: number[];
export declare const DISCRIMINATOR_PROPOSAL: number[];
export declare const DISCRIMINATOR_BATCH: number[];
/** Convert a byte array to hex string (browser-safe, no Buffer dependency). */
export declare function bytesToHex(bytes: number[] | Uint8Array): string;
/** Map discriminator hex to human-readable name. */
export declare const DISCRIMINATOR_LABELS: Record<string, string>;
export declare const KNOWN_PROGRAMS: Record<string, string>;
/** Get a human-readable label for a program ID, or null if unknown. */
export declare function getProgramLabel(programId: string): string | null;
/** SHA256("global:proposal_approve") first 8 bytes */
export declare const DISCRIMINATOR_PROPOSAL_APPROVE: Uint8Array<ArrayBuffer>;
/** SHA256("global:proposal_reject") first 8 bytes */
export declare const DISCRIMINATOR_PROPOSAL_REJECT: Uint8Array<ArrayBuffer>;
/** Default RPC URL (CORS-friendly public endpoint). */
export declare const DEFAULT_RPC_URL = "https://solana-rpc.publicnode.com";
export declare const PERMISSION_INITIATE = 1;
export declare const PERMISSION_VOTE = 2;
export declare const PERMISSION_EXECUTE = 4;
/** Convert a permission bitmask to a list of human-readable permission names. */
export declare function formatPermissions(mask: number): string[];
export declare const LAMPORTS_PER_SOL = 1000000000;
export interface TokenInfo {
    symbol: string;
    name: string;
    decimals: number;
}
/** Map of token mint address -> token info for well-known Solana tokens. */
export declare const KNOWN_TOKENS: Record<string, TokenInfo>;
/** Look up a token by its mint address. Returns null if unknown. */
export declare function getTokenInfo(mintAddress: string): TokenInfo | null;
/** Default number of transactions to scan. */
export declare const DEFAULT_TX_LIMIT = 20;
/** Maximum number of accounts to fetch in a single getMultipleAccountsInfo call. */
export declare const BATCH_SIZE = 100;
