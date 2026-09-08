import { createBrowserClient } from "@supabase/ssr"
import { getEnv } from "../env"

export function createClient() {
  const { supabaseUrl, supabaseKey } = getEnv()
  return createBrowserClient(supabaseUrl, supabaseKey)
}
