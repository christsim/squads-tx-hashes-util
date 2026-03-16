import { describe, it, expect } from "vitest";
import { encode, decode } from "../src/bs58";

describe("bs58", () => {
  describe("encode", () => {
    it("encodes empty bytes", () => {
      expect(encode(new Uint8Array([]))).toBe("");
    });

    it("encodes a single zero byte as '1'", () => {
      expect(encode(new Uint8Array([0]))).toBe("1");
    });

    it("encodes multiple leading zero bytes", () => {
      expect(encode(new Uint8Array([0, 0, 0]))).toBe("111");
    });

    it("encodes a single non-zero byte", () => {
      expect(encode(new Uint8Array([1]))).toBe("2");
      expect(encode(new Uint8Array([57]))).toBe("z");
    });

    it("encodes a known Solana address (32 bytes)", () => {
      // System Program ID: all zeros except nothing — it's 32 zero bytes = 32 '1's... 
      // Actually System Program is "11111111111111111111111111111111" (32 chars)
      const systemProgram = new Uint8Array(32);
      const encoded = encode(systemProgram);
      expect(encoded).toBe("11111111111111111111111111111111");
    });

    it("encodes known byte sequences", () => {
      // "Hello" in bytes
      const hello = new Uint8Array([72, 101, 108, 108, 111]);
      const encoded = encode(hello);
      expect(encoded).toBe("9Ajdvzr");
    });
  });

  describe("decode", () => {
    it("decodes empty string", () => {
      expect(decode("")).toEqual(new Uint8Array([]));
    });

    it("decodes '1' to a single zero byte", () => {
      expect(decode("1")).toEqual(new Uint8Array([0]));
    });

    it("decodes '111' to three zero bytes", () => {
      expect(decode("111")).toEqual(new Uint8Array([0, 0, 0]));
    });

    it("throws on invalid characters", () => {
      expect(() => decode("0OIl")).toThrow("Invalid base58 character");
    });

    it("decodes a known Solana address", () => {
      const bytes = decode("11111111111111111111111111111111");
      expect(bytes).toEqual(new Uint8Array(32));
      expect(bytes.length).toBe(32);
    });
  });

  describe("roundtrip", () => {
    it("encode(decode(x)) === x for known addresses", () => {
      const addresses = [
        "11111111111111111111111111111111",
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
        "So11111111111111111111111111111111111111112",
      ];
      for (const addr of addresses) {
        expect(encode(decode(addr))).toBe(addr);
      }
    });

    it("decode(encode(x)) === x for random byte arrays", () => {
      const testCases = [
        new Uint8Array([0, 0, 1, 2, 3, 255]),
        new Uint8Array(32).fill(0xff),
        new Uint8Array(64).map((_, i) => i),
      ];
      for (const bytes of testCases) {
        const result = decode(encode(bytes));
        expect(result).toEqual(bytes);
      }
    });
  });
});
