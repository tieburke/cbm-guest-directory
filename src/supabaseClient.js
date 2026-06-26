import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "shelter-auth",
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
});

// Expose supabase globally in development for easy console debugging
if (import.meta.env && import.meta.env.DEV) {
  try { window.supabase = supabase; } catch (e) { /* ignore in non-browser contexts */ }
}