import { getEnv } from "./env"

const ALGO = "AES-GCM"

function getKey(encryptionKey: string): Promise<CryptoKey> {
  if (encryptionKey.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters (first 32 chars used as raw key bytes)")
  }
  const raw = new TextEncoder().encode(encryptionKey.slice(0, 32))
  return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"])
}

export async function encrypt(plaintext: string): Promise<string> {
  const { encryptionKey } = getEnv()
  const key = await getKey(encryptionKey)
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
  const key = await getKey(encryptionKey)
  const combined = Buffer.from(encoded, "base64")
  const iv = combined.subarray(0, 12)
  const ciphertext = combined.subarray(12)
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
