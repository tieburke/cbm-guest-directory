import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export function useUserRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setRole(user?.user_metadata?.role ?? "staff");
      setLoading(false);
    });
  }, []);

  return { role, loading, isAdmin: role === "admin" };
}