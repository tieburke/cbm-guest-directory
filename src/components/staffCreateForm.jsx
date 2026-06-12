import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function StaffCreateForm({ onSuccess }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    accountRole: "staff",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
    setError("All fields are required.");
    return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-account`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          username: form.username.trim() || null,
          accountRole: form.accountRole,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
        setError(result.error || "Something went wrong.");
    } else {
      setSuccess(`Account created for ${form.firstName} ${form.lastName}.`);
      setForm({ firstName: "", lastName: "", username: "", email: "", password: "", accountRole: "staff" });
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">First Name</label>
          <input type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">Last Name</label>
          <input type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">Username</label>
        <input type="text" value={form.username} onChange={(e) => set("username", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm" />
      </div>

      <div>
        <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">Email</label>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm" />
      </div>

      <div>
        <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">Password</label>
        <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm" />
        <p className="text-gray-400 text-xs mt-1">Minimum 6 characters. Share this with the staff member.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-200 uppercase tracking-wide mb-1">Account Type</label>
        <select value={form.accountRole} onChange={(e) => set("accountRole", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none text-sm">
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-3 rounded-lg font-medium text-sm transition ${
          loading ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {loading ? "Creating..." : "Create Account"}
      </button>
    </div>
  );
}