import { getEnv } from "./env"

const ALGO = "AES-GCM"
const PBKDF2_ITERATIONS = 100_000
const SALT = "trendsentry-v1" // static salt — each encrypted value has its own random IV

async function getKey(encryptionKey: string, usePbkdf2: boolean): Promise<CryptoKey> {
  if (!usePbkdf2) {
    // Legacy: raw UTF-8 bytes (kept for decrypting old data)
    if (encryptionKey.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters")
    const raw = new TextEncoder().encode(encryptionKey.slice(0, 32))
    return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"])
  }
  // PBKDF2 derivation (new standard)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encrypt(plaintext: string): Promise<string> {
  const { encryptionKey } = getEnv()
  const key = await getKey(encryptionKey, true)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return Buffer.from(combined).toString("base64")
}

export async function decrypt(encoded: string): Promise<string> {
  const { encryptionKey } = getEnv()
  const combined = Buffer.from(encoded, "base64")
  if (combined.length < 13) throw new Error("ciphertext too short")
  const iv = combined.subarray(0, 12)
  const ciphertext = combined.subarray(12)

  // Try PBKDF2 first (new data), fall back to raw key (legacy data)
  for (const usePbkdf2 of [true, false]) {
    try {
      const key = await getKey(encryptionKey, usePbkdf2)
      const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
      return new TextDecoder().decode(decrypted)
    } catch {
      continue
    }
  }
  throw new Error("decryption failed (wrong key or corrupted data)")
}
