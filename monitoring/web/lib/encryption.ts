import { getEnv } from "./env"

const ALGO = "AES-GCM"
const PBKDF2_ITERATIONS = 100_000
const SALT = "trendsentry-v1" // static salt — each encrypted value has its own random IV

async function getKey(encryptionKey: string): Promise<CryptoKey> {
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
  if (combined.length < 13) throw new Error("ciphertext too short")
  const iv = combined.subarray(0, 12)
  const ciphertext = combined.subarray(12)
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}
