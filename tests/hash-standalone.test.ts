import { describe, it, expect } from "vitest";
import { hashRawMessage } from "../src/hash-standalone";

describe("hashRawMessage", () => {
  it("computes SHA-256 hash and returns base58", async () => {
    // SHA-256 of empty data is known:
    // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const emptyHash = await hashRawMessage(new Uint8Array([]));
    expect(emptyHash).toBeTruthy();
    expect(typeof emptyHash).toBe("string");
    // The base58 encoding of the empty SHA-256 hash
    expect(emptyHash).toBe(
      "GKot5hBsd81kMupNCXHaqbhv3huEbxAFMLnpcX2hniwn"
    );
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashRawMessage(new Uint8Array([1, 2, 3]));
    const hash2 = await hashRawMessage(new Uint8Array([4, 5, 6]));
    expect(hash1).not.toBe(hash2);
  });

  it("produces consistent hashes for same input", async () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const hash1 = await hashRawMessage(data);
    const hash2 = await hashRawMessage(data);
    expect(hash1).toBe(hash2);
  });

  it("returns a base58 string (valid characters only)", async () => {
    const hash = await hashRawMessage(new Uint8Array([0xff, 0x00, 0xab]));
    // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    expect(hash).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
  });
});
