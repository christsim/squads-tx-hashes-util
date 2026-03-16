import { describe, it, expect } from "vitest";
import {
  bytesToHex,
  formatPermissions,
  getTokenInfo,
  getProgramLabel,
  KNOWN_TOKENS,
  KNOWN_PROGRAMS,
  SQUADS_PROGRAM_ID,
  LAMPORTS_PER_SOL,
  PERMISSION_INITIATE,
  PERMISSION_VOTE,
  PERMISSION_EXECUTE,
} from "../src/constants";

describe("constants", () => {
  describe("bytesToHex", () => {
    it("converts empty array", () => {
      expect(bytesToHex(new Uint8Array([]))).toBe("");
    });

    it("converts single byte", () => {
      expect(bytesToHex(new Uint8Array([0]))).toBe("00");
      expect(bytesToHex(new Uint8Array([255]))).toBe("ff");
      expect(bytesToHex(new Uint8Array([16]))).toBe("10");
    });

    it("converts multiple bytes", () => {
      expect(bytesToHex(new Uint8Array([1, 2, 3]))).toBe("010203");
      expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(
        "deadbeef"
      );
    });

    it("pads single-digit hex values with zero", () => {
      expect(bytesToHex(new Uint8Array([0, 1, 15]))).toBe("00010f");
    });
  });

  describe("formatPermissions", () => {
    it("formats no permissions", () => {
      expect(formatPermissions(0)).toEqual([]);
    });

    it("formats single permissions", () => {
      expect(formatPermissions(PERMISSION_INITIATE)).toEqual(["Initiate"]);
      expect(formatPermissions(PERMISSION_VOTE)).toEqual(["Vote"]);
      expect(formatPermissions(PERMISSION_EXECUTE)).toEqual(["Execute"]);
    });

    it("formats combined permissions", () => {
      expect(
        formatPermissions(
          PERMISSION_INITIATE | PERMISSION_VOTE | PERMISSION_EXECUTE
        )
      ).toEqual(["Initiate", "Vote", "Execute"]);
    });

    it("formats initiate + vote", () => {
      expect(
        formatPermissions(PERMISSION_INITIATE | PERMISSION_VOTE)
      ).toEqual(["Initiate", "Vote"]);
    });
  });

  describe("getTokenInfo", () => {
    it("returns USDC info", () => {
      const info = getTokenInfo(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      );
      expect(info).not.toBeNull();
      expect(info!.symbol).toBe("USDC");
      expect(info!.name).toBe("USD Coin");
      expect(info!.decimals).toBe(6);
    });

    it("returns USDT info", () => {
      const info = getTokenInfo(
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
      );
      expect(info).not.toBeNull();
      expect(info!.symbol).toBe("USDT");
    });

    it("returns wrapped SOL info", () => {
      const info = getTokenInfo(
        "So11111111111111111111111111111111111111112"
      );
      expect(info).not.toBeNull();
      expect(info!.symbol).toBe("SOL");
      expect(info!.decimals).toBe(9);
    });

    it("returns NVIDIA xStock info", () => {
      const info = getTokenInfo(
        "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"
      );
      expect(info).not.toBeNull();
      expect(info!.symbol).toBe("NVDAx");
      expect(info!.name).toBe("NVIDIA xStock");
    });

    it("returns null for unknown token", () => {
      expect(getTokenInfo("unknownAddress123")).toBeNull();
    });
  });

  describe("getProgramLabel", () => {
    it("returns System Program label", () => {
      expect(
        getProgramLabel("11111111111111111111111111111111")
      ).toBe("System Program");
    });

    it("returns Squads label", () => {
      expect(getProgramLabel(SQUADS_PROGRAM_ID)).toBe(
        "Squads Multisig v4"
      );
    });

    it("returns Token Program label", () => {
      expect(
        getProgramLabel("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
      ).toBe("Token Program");
    });

    it("returns null for unknown program", () => {
      expect(getProgramLabel("unknownProgram123")).toBeNull();
    });
  });

  describe("KNOWN_TOKENS", () => {
    it("has at least 50 tokens", () => {
      expect(Object.keys(KNOWN_TOKENS).length).toBeGreaterThanOrEqual(50);
    });

    it("all tokens have symbol, name, and decimals", () => {
      for (const [addr, info] of Object.entries(KNOWN_TOKENS)) {
        expect(info.symbol, `Token ${addr} missing symbol`).toBeTruthy();
        expect(info.name, `Token ${addr} missing name`).toBeTruthy();
        expect(
          typeof info.decimals,
          `Token ${addr} decimals not a number`
        ).toBe("number");
        expect(
          info.decimals,
          `Token ${addr} decimals out of range`
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("KNOWN_PROGRAMS", () => {
    it("has at least 10 programs", () => {
      expect(Object.keys(KNOWN_PROGRAMS).length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("LAMPORTS_PER_SOL", () => {
    it("is 1 billion", () => {
      expect(LAMPORTS_PER_SOL).toBe(1_000_000_000);
    });
  });
});
