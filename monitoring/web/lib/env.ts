export function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const encryptionKey = process.env.ENCRYPTION_KEY

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required")
  if (!supabaseKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required")
  if (!encryptionKey) throw new Error("ENCRYPTION_KEY is required")

  return { supabaseUrl, supabaseKey, encryptionKey }
}
