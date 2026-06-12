import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://saaznlfyoxibflriyiil.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYXpubGZ5b3hpYmZscml5aWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjEwMDEsImV4cCI6MjA5NjA5NzAwMX0.QIVIP_cvoOHtU_WCg5S8WYQZ0MZyfGh8yDDd1cWtQmw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "shelter-auth",
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
});