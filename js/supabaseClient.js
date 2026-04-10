import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (SUPABASE_URL.includes("YOUR_PROJECT_ID") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
  console.warn("Supabase keys are not configured. Update js/config.js.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
