export interface DecodedMessage {
    version: "legacy" | "v0";
    header: {
        numRequiredSignatures: number;
        numReadonlySignedAccounts: number;
        numReadonlyUnsignedAccounts: number;
    };
    accountKeys: string[];
    recentBlockhash: string;
    instructions: DecodedInstruction[];
    addressTableLookups: DecodedAddressTableLookup[];
    rawHex: string;
    size: number;
}
export interface DecodedInstruction {
    programIdIndex: number;
    programId: string;
    programLabel: string | null;
    accountIndexes: number[];
    accounts: DecodedAccount[];
    data: Uint8Array;
    dataHex: string;
    decoded: string | null;
    decodedDetails?: Record<string, string>;
    innerInstructions?: DecodedInnerInstruction[];
}
/** Inner instruction from a vault_transaction_create embedded message. */
export interface DecodedInnerInstruction {
    programId: string;
    programLabel: string | null;
    accounts: string[];
    accountLabels?: string[];
    data: Uint8Array;
    dataHex: string;
    decoded: string | null;
}
export interface DecodedAccount {
    index: number;
    pubkey: string;
    writable: boolean;
    signer: boolean;
}
export type InstructionSafety = "safe" | "review" | "unknown";
export interface TransactionSummary {
    actions: ActionSummary[];
    warnings: Warning[];
    outerInstructionSafety: InstructionSafety[];
    multisigPda?: string;
}
export interface ActionSummary {
    title: string;
    details: Record<string, string>;
    programId: string;
    programLabel: string | null;
}
export interface Warning {
    severity: "info" | "caution" | "danger";
    message: string;
}
export interface DecodedAddressTableLookup {
    accountKey: string;
    writableIndexes: number[];
    readonlyIndexes: number[];
}
/**
 * Decode a serialized Solana transaction message (Legacy or V0).
 * Fully offline — no network calls.
 */
export declare function decodeMessage(messageBytes: Uint8Array): DecodedMessage;
/**
 * Generate a transaction summary with safety classifications and
 * human-readable action descriptions for the vault transaction contents.
 */
export declare function generateTransactionSummary(decoded: DecodedMessage): TransactionSummary;
/** Convert a hex string to Uint8Array. */
export declare function hexToBytes(hex: string): Uint8Array;
/** Convert a base64 string to Uint8Array. */
export declare function base64ToBytes(b64: string): Uint8Array;
