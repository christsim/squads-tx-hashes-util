import { describe, it, expect } from "vitest";
import {
  decodeMessage,
  generateTransactionSummary,
  hexToBytes,
  base64ToBytes,
  type DecodedMessage,
} from "../src/decoder";
import { decode as bs58Decode } from "../src/bs58";

describe("hexToBytes", () => {
  it("converts empty string", () => {
    expect(hexToBytes("")).toEqual(new Uint8Array([]));
  });

  it("converts valid hex", () => {
    expect(hexToBytes("deadbeef")).toEqual(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    );
  });

  it("handles 0x prefix", () => {
    expect(hexToBytes("0xabcd")).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  it("handles whitespace", () => {
    expect(hexToBytes("ab cd ef")).toEqual(
      new Uint8Array([0xab, 0xcd, 0xef])
    );
  });

  it("throws on odd-length hex", () => {
    expect(() => hexToBytes("abc")).toThrow("even number");
  });

  it("throws on invalid hex characters", () => {
    expect(() => hexToBytes("gg")).toThrow("Invalid hex");
  });
});

describe("base64ToBytes", () => {
  it("converts valid base64", () => {
    const bytes = base64ToBytes("SGVsbG8=");
    expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it("converts empty base64", () => {
    expect(base64ToBytes("")).toEqual(new Uint8Array([]));
  });
});

describe("decodeMessage", () => {
  describe("V0 message", () => {
    it("decodes a minimal V0 message", () => {
      const bytes = new Uint8Array([
        0x80, // V0 prefix
        1, 0, 0, // header
        1, // 1 account key
        ...new Uint8Array(32), // key
        ...new Uint8Array(32), // blockhash
        0, // 0 instructions
        0, // 0 ALTs
      ]);

      const decoded = decodeMessage(bytes);
      expect(decoded.version).toBe("v0");
      expect(decoded.header.numRequiredSignatures).toBe(1);
      expect(decoded.header.numReadonlySignedAccounts).toBe(0);
      expect(decoded.header.numReadonlyUnsignedAccounts).toBe(0);
      expect(decoded.accountKeys).toHaveLength(1);
      expect(decoded.instructions).toHaveLength(0);
      expect(decoded.addressTableLookups).toHaveLength(0);
    });
  });

  describe("Legacy message", () => {
    it("decodes a minimal legacy message", () => {
      const bytes = new Uint8Array([
        1, 0, 0, // header (first byte < 0x80, so legacy)
        1, // 1 account key
        ...new Uint8Array(32), // key
        ...new Uint8Array(32), // blockhash
        0, // 0 instructions
      ]);

      const decoded = decodeMessage(bytes);
      expect(decoded.version).toBe("legacy");
      expect(decoded.header.numRequiredSignatures).toBe(1);
      expect(decoded.accountKeys).toHaveLength(1);
      expect(decoded.instructions).toHaveLength(0);
    });
  });

  describe("instruction decoding with real program IDs", () => {
    // Helper: build a valid V0 message from real program ID + instruction data
    function makeTestMessage(
      programIdBase58: string,
      ixData: Uint8Array,
      extraKeyCount: number = 0,
      accountIndexes: number[] = []
    ): Uint8Array {
      const programIdBytes = bs58Decode(programIdBase58);
      const feePayerKey = new Uint8Array(32).fill(0xaa);
      const extraKeys: Uint8Array[] = [];
      for (let i = 0; i < extraKeyCount; i++) {
        const key = new Uint8Array(32);
        key.fill(0x10 + i);
        extraKeys.push(key);
      }
      const blockhash = new Uint8Array(32).fill(0xbb);

      const allKeyBytes = [feePayerKey, ...extraKeys, programIdBytes];
      const numKeys = allKeyBytes.length;
      const programIdx = numKeys - 1;
      const numReadonlyUnsigned = 1; // just the program

      const keyData = new Uint8Array(numKeys * 32);
      allKeyBytes.forEach((k, i) => keyData.set(k, i * 32));

      const parts: number[] = [
        0x80, // V0
        1, 0, numReadonlyUnsigned, // header
        numKeys, // compact-u16: numKeys (< 128 so 1 byte)
      ];
      // Keys
      for (const k of allKeyBytes) parts.push(...k);
      // Blockhash
      parts.push(...blockhash);
      // 1 instruction
      parts.push(1);
      parts.push(programIdx); // programIdIndex
      parts.push(accountIndexes.length); // numAccountIndexes
      parts.push(...accountIndexes);
      parts.push(ixData.length); // data length (compact-u16, < 128)
      parts.push(...ixData);
      // 0 ALTs
      parts.push(0);

      return new Uint8Array(parts);
    }

    it("decodes System Program Transfer", () => {
      const ixData = hexToBytes("020000004042'0f0000000000".replace(/'/g, ""));
      const bytes = makeTestMessage(
        "11111111111111111111111111111111",
        ixData,
        1,
        [0, 1]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("Transfer:");
      expect(decoded.instructions[0].decoded).toMatch(/1.000.000 lamports/);
      expect(decoded.instructions[0].decoded).toContain("0.001 SOL");
    });

    it("decodes System Program AdvanceNonceAccount", () => {
      const ixData = hexToBytes("04000000");
      const bytes = makeTestMessage(
        "11111111111111111111111111111111",
        ixData,
        2,
        [0, 1, 2]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toBe("AdvanceNonceAccount");
    });

    it("decodes Compute Budget SetComputeUnitLimit", () => {
      const ixData = hexToBytes("02400d0300");
      const bytes = makeTestMessage(
        "ComputeBudget111111111111111111111111111111",
        ixData
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("SetComputeUnitLimit");
      expect(decoded.instructions[0].decoded).toMatch(/200.000/);
    });

    it("decodes Compute Budget SetComputeUnitPrice", () => {
      const ixData = hexToBytes("0350c3000000000000");
      const bytes = makeTestMessage(
        "ComputeBudget111111111111111111111111111111",
        ixData
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("SetComputeUnitPrice");
      expect(decoded.instructions[0].decoded).toMatch(/50.000/);
    });

    it("decodes proposal_approve (no memo)", () => {
      const ixData = hexToBytes("9025a488bcd82af800");
      const bytes = makeTestMessage(
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        ixData,
        2,
        [0, 1, 2]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toBe(
        "proposal_approve (no memo)"
      );
    });

    it("decodes proposal_reject (no memo)", () => {
      const ixData = hexToBytes("f33e869ce66af68700");
      const bytes = makeTestMessage(
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        ixData,
        2,
        [0, 1, 2]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toBe(
        "proposal_reject (no memo)"
      );
    });

    it("decodes proposal_create", () => {
      const ixData = hexToBytes("dc3c49e01e6c4f9f010000000000000000");
      const bytes = makeTestMessage(
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        ixData,
        2,
        [0, 1, 2]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("proposal_create");
      expect(decoded.instructions[0].decoded).toContain("tx: 1");
      expect(decoded.instructions[0].decoded).toContain("draft: false");
    });

    it("decodes vault_transaction_accounts_close", () => {
      const ixData = hexToBytes("c447bbb00223aaa5");
      const bytes = makeTestMessage(
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        ixData,
        4,
        [0, 1, 2, 3, 4]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toBe(
        "vault_transaction_accounts_close"
      );
    });

    it("decodes Token TransferChecked", () => {
      const ixData = hexToBytes("0c40420f000000000006");
      const bytes = makeTestMessage(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        ixData,
        3,
        [0, 1, 2, 3]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("TransferChecked");
      expect(decoded.instructions[0].decoded).toMatch(/1.000.000/);
      expect(decoded.instructions[0].decoded).toContain("6 decimals");
      // accountLabels are populated on inner instructions (via vault message parser),
      // not on outer-level instructions decoded by decodeMessage
      expect(decoded.instructions[0].programLabel).toBe("Token Program");
    });

    it("decodes Token-2022 TransferChecked", () => {
      const ixData = hexToBytes("0c102700000000000008");
      const bytes = makeTestMessage(
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        ixData,
        3,
        [0, 1, 2, 3]
      );
      const decoded = decodeMessage(bytes);

      expect(decoded.instructions[0].decoded).toContain("TransferChecked");
      expect(decoded.instructions[0].decoded).toContain("0.0001");
      expect(decoded.instructions[0].decoded).toContain("8 decimals");
    });
  });
});

describe("generateTransactionSummary", () => {
  it("returns empty summary for a message with no instructions", () => {
    const decoded: DecodedMessage = {
      version: "v0",
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      accountKeys: ["11111111111111111111111111111111"],
      recentBlockhash: "11111111111111111111111111111111",
      instructions: [],
      addressTableLookups: [],
      rawHex: "",
      size: 0,
    };

    const summary = generateTransactionSummary(decoded);
    expect(summary.actions).toHaveLength(0);
    expect(summary.outerInstructionSafety).toHaveLength(0);
  });

  it("classifies Compute Budget as safe", () => {
    const decoded: DecodedMessage = {
      version: "v0",
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      accountKeys: [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "ComputeBudget111111111111111111111111111111",
      ],
      recentBlockhash: "11111111111111111111111111111111",
      instructions: [
        {
          programIdIndex: 1,
          programId: "ComputeBudget111111111111111111111111111111",
          programLabel: "Compute Budget Program",
          accountIndexes: [],
          accounts: [],
          data: hexToBytes("02400d0300"),
          dataHex: "02400d0300",
          decoded: "SetComputeUnitLimit: 200,000 units",
        },
      ],
      addressTableLookups: [],
      rawHex: "",
      size: 0,
    };

    const summary = generateTransactionSummary(decoded);
    expect(summary.outerInstructionSafety).toEqual(["safe"]);
  });

  it("classifies AdvanceNonceAccount as safe", () => {
    const decoded: DecodedMessage = {
      version: "v0",
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      accountKeys: [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "11111111111111111111111111111111",
      ],
      recentBlockhash: "11111111111111111111111111111111",
      instructions: [
        {
          programIdIndex: 1,
          programId: "11111111111111111111111111111111",
          programLabel: "System Program",
          accountIndexes: [0],
          accounts: [
            {
              index: 0,
              pubkey: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              writable: true,
              signer: true,
            },
          ],
          data: hexToBytes("04000000"),
          dataHex: "04000000",
          decoded: "AdvanceNonceAccount",
        },
      ],
      addressTableLookups: [],
      rawHex: "",
      size: 0,
    };

    const summary = generateTransactionSummary(decoded);
    expect(summary.outerInstructionSafety).toEqual(["safe"]);
  });

  it("classifies unknown program as unknown and generates warning", () => {
    const decoded: DecodedMessage = {
      version: "v0",
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      accountKeys: [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "UnknownProgram11111111111111111111111111111",
      ],
      recentBlockhash: "11111111111111111111111111111111",
      instructions: [
        {
          programIdIndex: 1,
          programId: "UnknownProgram11111111111111111111111111111",
          programLabel: null,
          accountIndexes: [],
          accounts: [],
          data: new Uint8Array([1, 2, 3]),
          dataHex: "010203",
          decoded: null,
        },
      ],
      addressTableLookups: [],
      rawHex: "",
      size: 0,
    };

    const summary = generateTransactionSummary(decoded);
    expect(summary.outerInstructionSafety).toEqual(["unknown"]);
    expect(summary.warnings.length).toBeGreaterThan(0);
    expect(summary.warnings[0].severity).toBe("danger");
  });

  it("classifies vault_transaction_accounts_close as safe", () => {
    const decoded: DecodedMessage = {
      version: "v0",
      header: {
        numRequiredSignatures: 1,
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
      },
      accountKeys: [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ],
      recentBlockhash: "11111111111111111111111111111111",
      instructions: [
        {
          programIdIndex: 1,
          programId: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
          programLabel: "Squads Multisig v4",
          accountIndexes: [],
          accounts: [],
          data: hexToBytes("c447bbb00223aaa5"),
          dataHex: "c447bbb00223aaa5",
          decoded: "vault_transaction_accounts_close",
        },
      ],
      addressTableLookups: [],
      rawHex: "",
      size: 0,
    };

    const summary = generateTransactionSummary(decoded);
    expect(summary.outerInstructionSafety).toEqual(["safe"]);
  });
});

describe("config_transaction_create decoding", () => {
  /** Encode a number as compact-u16 (Solana's variable-length encoding). */
  function encodeCompactU16(value: number): number[] {
    const bytes: number[] = [];
    let v = value;
    while (v >= 0x80) {
      bytes.push((v & 0x7f) | 0x80);
      v >>= 7;
    }
    bytes.push(v);
    return bytes;
  }

  // Helper to build a test message — same as in instruction decoding tests
  function makeTestMessage(
    programIdBase58: string,
    ixData: Uint8Array,
    extraKeyCount: number = 0,
    accountIndexes: number[] = []
  ): Uint8Array {
    const programIdBytes = bs58Decode(programIdBase58);
    const feePayerKey = new Uint8Array(32).fill(0xaa);
    const extraKeys: Uint8Array[] = [];
    for (let i = 0; i < extraKeyCount; i++) {
      const key = new Uint8Array(32);
      key.fill(0x10 + i);
      extraKeys.push(key);
    }
    const blockhash = new Uint8Array(32).fill(0xbb);

    const allKeyBytes = [feePayerKey, ...extraKeys, programIdBytes];
    const numKeys = allKeyBytes.length;
    const programIdx = numKeys - 1;
    const numReadonlyUnsigned = 1;

    const parts: number[] = [
      0x80, // V0
      1, 0, numReadonlyUnsigned, // header
      ...encodeCompactU16(numKeys),
    ];
    for (const k of allKeyBytes) parts.push(...k);
    parts.push(...blockhash);
    parts.push(...encodeCompactU16(1)); // 1 instruction
    parts.push(programIdx);
    parts.push(...encodeCompactU16(accountIndexes.length));
    parts.push(...accountIndexes);
    parts.push(...encodeCompactU16(ixData.length));
    parts.push(...ixData);
    parts.push(...encodeCompactU16(0)); // 0 ALTs
    return new Uint8Array(parts);
  }

  it("decodes config_transaction_create with RemoveMember", () => {
    // discriminator + 1 action (variant=1 RemoveMember) + pubkey (32 bytes) + no memo
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "01" +                // variant 1 = RemoveMember
      "8ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05" + // pubkey
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("RemoveMember");
    expect(decoded.instructions[0].configActions).toBeDefined();
    expect(decoded.instructions[0].configActions!.length).toBe(1);
    expect(decoded.instructions[0].configActions![0].type).toBe("RemoveMember");
    if (decoded.instructions[0].configActions![0].type === "RemoveMember") {
      expect(decoded.instructions[0].configActions![0].oldMember).toBeTruthy();
    }
  });

  it("decodes config_transaction_create with AddMember", () => {
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "00" +                // variant 0 = AddMember
      "8ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05" + // pubkey
      "07" +                // permissions mask (Initiate + Vote + Execute)
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("AddMember");
    expect(decoded.instructions[0].configActions).toBeDefined();
    expect(decoded.instructions[0].configActions!.length).toBe(1);

    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("AddMember");
    if (action.type === "AddMember") {
      expect(action.member.permissions).toBe(7);
    }
  });

  it("decodes config_transaction_create with ChangeThreshold", () => {
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "02" +                // variant 2 = ChangeThreshold
      "0300" +              // new_threshold = 3 (u16 LE)
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("ChangeThreshold(3)");
    expect(decoded.instructions[0].configActions).toBeDefined();

    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("ChangeThreshold");
    if (action.type === "ChangeThreshold") {
      expect(action.newThreshold).toBe(3);
    }
  });

  it("decodes config_transaction_create with AddSpendingLimit", () => {
    // Build a realistic AddSpendingLimit payload:
    //   createKey: 32 bytes (0x20 fill)
    //   vaultIndex: 0
    //   mint: USDC mint (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
    //   amount: 1_000_000 (1 USDC)
    //   period: 1 (Day)
    //   members: 1 member (32 bytes 0x30 fill)
    //   destinations: 0 (any address)
    const usdcMintBytes = bs58Decode("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const createKeyBytes = new Uint8Array(32).fill(0x20);
    const memberBytes = new Uint8Array(32).fill(0x30);

    // amount = 1_000_000 as u64 LE
    const amountBytes = new Uint8Array(8);
    amountBytes[0] = 0x40; amountBytes[1] = 0x42; amountBytes[2] = 0x0f;
    // 0x0f4240 = 1_000_000

    const payload = new Uint8Array([
      ...hexToBytes("9bec57e4894b5127"), // discriminator
      0x01, 0x00, 0x00, 0x00,             // 1 action
      0x04,                                // variant 4 = AddSpendingLimit
      ...createKeyBytes,                   // createKey
      0x00,                                // vaultIndex = 0
      ...usdcMintBytes,                    // mint (USDC)
      ...amountBytes,                      // amount
      0x01,                                // period = Day
      0x01, 0x00, 0x00, 0x00,             // members.len = 1
      ...memberBytes,                      // member pubkey
      0x00, 0x00, 0x00, 0x00,             // destinations.len = 0
      0x00,                                // no memo
    ]);

    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      payload,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("AddSpendingLimit");
    expect(decoded.instructions[0].configActions).toBeDefined();
    expect(decoded.instructions[0].configActions!.length).toBe(1);

    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("AddSpendingLimit");
    if (action.type === "AddSpendingLimit") {
      expect(action.vaultIndex).toBe(0);
      expect(action.amount).toBe(1_000_000n);
      expect(action.period).toBe("Day");
      expect(action.members.length).toBe(1);
      expect(action.destinations.length).toBe(0);
    }

    // Summary should produce a readable action
    const summary = generateTransactionSummary(decoded);
    expect(summary.actions.length).toBe(1);
    expect(summary.actions[0].title).toContain("Add Spending Limit");
    expect(summary.actions[0].title).toContain("USDC");
    expect(summary.actions[0].details["Period"]).toBe("Day");
  });

  it("decodes config_transaction_create with SetTimeLock", () => {
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "03" +                // variant 3 = SetTimeLock
      "3c000000" +          // new_time_lock = 60 seconds (u32 LE)
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("SetTimeLock(60s)");
    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("SetTimeLock");
    if (action.type === "SetTimeLock") {
      expect(action.newTimeLock).toBe(60);
    }
  });

  it("decodes config_transaction_create with SetRentCollector", () => {
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "06" +                // variant 6 = SetRentCollector
      "01" +                // Some(pubkey)
      "8ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05" + // pubkey
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("SetRentCollector");
    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("SetRentCollector");
    if (action.type === "SetRentCollector") {
      expect(action.newRentCollector).toBeTruthy();
    }
  });

  it("decodes config_transaction_create with RemoveSpendingLimit", () => {
    const ixData = hexToBytes(
      "9bec57e4894b5127" + // discriminator
      "01000000" +          // 1 action
      "05" +                // variant 5 = RemoveSpendingLimit
      "8ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05" + // spending limit pubkey
      "00"                  // no memo
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);

    expect(decoded.instructions[0].decoded).toContain("config_transaction_create");
    expect(decoded.instructions[0].decoded).toContain("RemoveSpendingLimit");
    const action = decoded.instructions[0].configActions![0];
    expect(action.type).toBe("RemoveSpendingLimit");
    if (action.type === "RemoveSpendingLimit") {
      expect(action.spendingLimit).toBeTruthy();
    }
  });

  it("generates summary actions for config_transaction_create", () => {
    // RemoveMember config transaction
    const ixData = hexToBytes(
      "9bec57e4894b5127" +
      "01000000" +
      "01" +
      "8ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05" +
      "00"
    );
    const bytes = makeTestMessage(
      "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      ixData,
      4,
      [0, 1, 2, 3, 4]
    );
    const decoded = decodeMessage(bytes);
    const summary = generateTransactionSummary(decoded);

    expect(summary.actions.length).toBe(1);
    expect(summary.actions[0].title).toBe("Remove Member");
    expect(summary.actions[0].details["Member to Remove"]).toBeTruthy();
    expect(summary.outerInstructionSafety).toContain("review");
  });
});

describe("real transaction decoding", () => {
  it("decodes a real Squads config_transaction_create (RemoveMember) transaction", () => {
    const hex =
      "0400040c8e3b9a5251c8704959fc7796ab73bbf80f35f9117facc38d1ea633f0af10b5a525843d5dd8927b66cb65086eb3b1a96e84677a86ce5834d343e857253c1ca43ba596a86ad7a1a28402e35aec422477653a87ca88191a30053e32d03de990d9a9bf67f6b6c3ad48b95a23600f58cbb049062dc5812b8272ef09bae3d2de79f454121c98351aa05ed42337bcc107c63442e56edcd142eaeff7ea9470f850e2dd675bc502059ed024cd0b8cf22219fea0244bfedea92ac306acbebc3da8b0d23316c1cb0ea07cadd47ae519027522f9c5aeda3aadbe3966d5c8845b96d6a622c5cafb531a9efa4350a8fb84b0a894e785cd4cba4278fd59ff3ddac19ebf5e88f88100000000000000000000000000000000000000000000000000000000000000000306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000000681c4ce47e22368b8b1555ec887af092efc7efbb66ca3f52fbf68d4ac9cb7a806a7d517192c568ee08a845f73d29788cf035c3145b21ab344d8062ea9400000002abe8db1c33fa2d62812caf0486797ffaed378a39d69991bf0f92353136e79080803070b0004040000000900050220a1070009000903fa000000000000000a0506040200082e9bec57e4894b512701000000018ac9e286996aaa092c94f270f1a075fdad23bb2c309ec41d27f8014924341d05000a05060502000811dc3c49e01e6c4f9f0400000000000000000a03060205099025a488bcd82af8000a03060105099025a488bcd82af8000a03060305099025a488bcd82af800";

    const bytes = hexToBytes(hex);
    const decoded = decodeMessage(bytes);

    // Basic structure
    expect(decoded.version).toBe("legacy");
    expect(decoded.instructions.length).toBe(8);

    // Find the config_transaction_create instruction
    const ctcIx = decoded.instructions.find(
      (ix) =>
        ix.decoded !== null &&
        ix.decoded.startsWith("config_transaction_create")
    );
    expect(ctcIx).toBeDefined();
    expect(ctcIx!.decoded).toContain("RemoveMember");
    expect(ctcIx!.configActions).toBeDefined();
    expect(ctcIx!.configActions!.length).toBe(1);
    expect(ctcIx!.configActions![0].type).toBe("RemoveMember");

    // Generate summary
    const summary = generateTransactionSummary(decoded);
    expect(summary.actions.length).toBe(1);
    expect(summary.actions[0].title).toBe("Remove Member");
    expect(summary.actions[0].details["Member to Remove"]).toBeTruthy();

    // Find proposal_create instruction
    const pcIx = decoded.instructions.find(
      (ix) =>
        ix.decoded !== null && ix.decoded.startsWith("proposal_create")
    );
    expect(pcIx).toBeDefined();

    // Find proposal_approve instructions (3 of them)
    const approveIxs = decoded.instructions.filter(
      (ix) =>
        ix.decoded !== null && ix.decoded.startsWith("proposal_approve")
    );
    expect(approveIxs.length).toBe(3);
  });

  it("decodes a real Squads NVIDIA xStock transfer transaction", () => {
    const hex =
      "0300040bde4df180b85b7e9d146dac46fed409cc27c00d715180596c7d98951654b828a39f9ba13ae7815f6f7c3dfe61dae8991344cd59d9304d38d0ac3f7f56d2ee3e1adb8fe49e5e2c7f3a82ebce74a51b32baf75d412974c66c8e2da83a8a3ca1647641f51161de6eb336b3ac1ccff2f31fec5db55be6ed9833da42c61de92994c07fb10cfc1d5ca7ffebc8c14f8b4a638060cbcefee7519cd08bd6b9cd5367d60411cd69ad997821a2a87d2fd0e41f6ebd18e71cefc05b6d69734679f5c5244963d1c83ca9d5c2711f33545d5e6ab3aa77498e3afe26ed4d54f3350146a032b9cb9800000000000000000000000000000000000000000000000000000000000000000306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000000681c4ce47e22368b8b1555ec887af092efc7efbb66ca3f52fbf68d4ac9cb7a806a7d517192c568ee08a845f73d29788cf035c3145b21ab344d8062ea94000005362966157adb35dcb8255af51631bdc316ae95fd8a8e4ebc9a0108ef49dbfd5070703040a00040400000008000502305705000800090340420f000000000009050305020007c70130fa4ea8d0e2dad30100b800000001010205cf6b1de7612ab7aa19f8a47c9a90417b16cabc1dc873fceb31ee30919f2d8e25c58d19c6b8420b800004a5b13bcb83dfbfdd0dd3fd6c69452dbe619a319b43334a51f1430818c0381390c197ae3a5751d461cfd1dc729835265f0dd63c6604cf06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d61010304010402000a000c10270000000000000600000905030602000711dc3c49e01e6c4f9f0200000000000000000903030206099025a488bcd82af8000903030106099025a488bcd82af800";

    const bytes = hexToBytes(hex);
    const decoded = decodeMessage(bytes);

    // Basic structure
    expect(decoded.version).toBe("legacy");
    expect(decoded.accountKeys.length).toBe(11);
    expect(decoded.instructions.length).toBeGreaterThan(3);

    // Find the vault_transaction_create instruction
    const vtcIx = decoded.instructions.find(
      (ix) =>
        ix.decoded !== null &&
        ix.decoded.startsWith("vault_transaction_create")
    );
    expect(vtcIx).toBeDefined();
    expect(vtcIx!.innerInstructions).toBeDefined();
    expect(vtcIx!.innerInstructions!.length).toBeGreaterThan(0);

    // The inner instruction should be a TransferChecked
    const innerIx = vtcIx!.innerInstructions![0];
    expect(innerIx.decoded).toContain("TransferChecked");

    // Find proposal_create instruction
    const pcIx = decoded.instructions.find(
      (ix) =>
        ix.decoded !== null && ix.decoded.startsWith("proposal_create")
    );
    expect(pcIx).toBeDefined();
    expect(pcIx!.decoded).toContain("tx: 2");

    // Find proposal_approve instructions
    const approveIxs = decoded.instructions.filter(
      (ix) =>
        ix.decoded !== null && ix.decoded.startsWith("proposal_approve")
    );
    expect(approveIxs.length).toBeGreaterThanOrEqual(1);

    // Generate summary
    const summary = generateTransactionSummary(decoded);
    expect(summary.actions.length).toBeGreaterThan(0);
    expect(summary.actions[0].title).toContain("Transfer");
    expect(summary.multisigPda).toBeTruthy();

    // Safety classifications
    expect(summary.outerInstructionSafety.length).toBe(
      decoded.instructions.length
    );
    expect(summary.outerInstructionSafety).toContain("review");
    expect(summary.outerInstructionSafety).toContain("safe");
  });

  it("decodes a real Squads execution + close transaction", () => {
    const hex =
      "0201050cf6194942ff6c65ff18899af15ec97e948bdcef4933a6581d306d260c635a21846d18aa52d84ba0bf59cd2796c9f89a8d0dceabcba40124ff8f8516bde90918bc1274a1dd26ef7ab2dbb4f8711d74f9f73c9606009ffcfdec87e8320674c1e846423e1ed5632183127d956fc85f7918694a59d246809836ebd939d95af514949b77c9bae662a5bdd90c06a262d23bf847c0da08ea11399fff48e017c40d822603f655c06b8b8d7df6f7447fece80e0b906691d64d776f693d546229f2700887e8fca0d6aa7cce07f262d0c4e01b6d4790d2475504f955af6bf63b2d2b6b653583000000000000000000000000000000000000000000000000000000000000000074719b93b54cb63b11eb2933bcfe7a7ed5bf0139cd17edca66c3148dc51e5d000306466fe5211732ffecadba72c39be7bc8ce5bbc5f7126b2c439b3a400000000681c4ce47e22368b8b1555ec887af092efc7efbb66ca3f52fbf68d4ac9cb7a806a7d517192c568ee08a845f73d29788cf035c3145b21ab344d8062ea94000001ff4a3e7ec16a2fa8da2f4d769377ce1627b4d34e5c013134aa61e447d481517050703030b0004040000000900050220a1070009000903fa000000000000000a070805040106020708c208a15799a419ab0a05080504000708c447bbb00223aaa5";

    const bytes = hexToBytes(hex);
    const decoded = decodeMessage(bytes);

    expect(decoded.version).toBe("legacy");
    expect(decoded.instructions.length).toBeGreaterThan(3);

    // vault_transaction_accounts_close should be decoded
    const closeIx = decoded.instructions.find(
      (ix) => ix.decoded === "vault_transaction_accounts_close"
    );
    expect(closeIx).toBeDefined();

    // vault_transaction_execute should be decoded
    const execIx = decoded.instructions.find(
      (ix) => ix.decoded === "vault_transaction_execute"
    );
    expect(execIx).toBeDefined();

    // Generate summary — both should be safe
    const summary = generateTransactionSummary(decoded);
    const closeIdx = decoded.instructions.indexOf(closeIx!);
    expect(summary.outerInstructionSafety[closeIdx]).toBe("safe");

    const execIdx = decoded.instructions.indexOf(execIx!);
    expect(summary.outerInstructionSafety[execIdx]).toBe("safe");
  });
});
