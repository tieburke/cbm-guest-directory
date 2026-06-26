import { useState, useEffect } from "react";
import { data, Link, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import LiftBanModal from "../components/LiftBanModal";
import { useUserRole } from "../hooks/useUserRole";
import { useNavigate } from "react-router-dom";

const GENDER_OPTIONS = ["Male", "Female", "No single gender", "Questioning", "Transgender", "Client doesn't know / refused"];
const RACE_OPTIONS = ["American Indian or Alaska Native", "Asian or Asian American", "Black, African American, or African", "Hispanic/Latina/e/o", "Middle Eastern or North African", "Native Hawaiian or Pacific Islander", "White", "Multiracial", "Client doesn't know"];
const LIVING_OPTIONS = ["Sheltered", "Unsheltered", "Working Poor", "Stably Housed", "Other"];
const HEALTH_OPTIONS = ["Physical and/or Mental Health Condition", "No Physical and/or Mental Health Condition"];
const VETERAN_OPTIONS = ["Veteran", "Not a Veteran"];

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
    <p className="text-gray-200 text-sm">{value || <span className="text-gray-600">Not recorded</span>}</p>
  </div>
);

const EditSelect = ({ field, label, options, editForm, set }) => (
  <div>
    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
    <select
      value={editForm[field] || ""}
      onChange={(e) => set(field, e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none text-sm"
    >
      <option value="">Not recorded</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const EditText = ({ field, label, type = "text", editForm, set }) => (
  <div>
    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
    <input
      type={type}
      value={editForm[field] || ""}
      onChange={(e) => set(field, e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm"
    />
  </div>
);

export default function GuestProfile() {
  const { id } = useParams();
  const { isAdmin } = useUserRole();
  const [guest, setGuest] = useState(null);
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLiftModal, setShowLiftModal] = useState(false);
  const [liftedBanId, setLiftedBanId] = useState(null);
  const [liftNotes, setLiftNotes] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchGuest();
    fetchBans();
  }, [id]);

  // Expose supabase on window in dev for easy console debugging
  useEffect(() => {
    if (import.meta.env && import.meta.env.DEV) {
      try { window.supabase = supabase; } catch (e) { /* ignore */ }
    }
  }, []);

  const fetchGuest = async () => {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .single();
    if (error) console.error("Error fetching guest:", error.message);
    else { setGuest(data); setEditForm(data); }
    setLoading(false);
  };

  const expireOldBans = async () => {
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("bans")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expiry_date", today);
  };

  const fetchBans = async () => {
    await expireOldBans();
    const { data, error } = await supabase
      .from("bans")
      .select(`
        *,
        issued_by_staff:staff!bans_issued_by_fkey(*),
        lifted_by_staff:staff!bans_lifted_by_fkey(*),
        ban_offenses(offense:offenses(*))
      `)
      .eq("guest_id", id)
      .order("issued_date", { ascending: false });
    if (error) console.error("Error fetching bans:", error.message);
    else setBans(data);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      first_name: editForm.first_name?.trim(),
      last_name: editForm.last_name?.trim() || null,
      alias: editForm.alias?.trim() || null,
      date_of_birth: editForm.date_of_birth || null,
      gender: editForm.gender || null,
      race: editForm.race || null,
      living_situation: editForm.living_situation || null,
      health_condition: editForm.health_condition || null,
      veteran: editForm.veteran || null,
    };

    const { error } = await supabase.from("guests").update(payload).eq("id", id);
    if (error) { console.error("Error saving guest:", error.message); }
    else { await fetchGuest(); setEditing(false); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    console.log("Deleting guest id:", id);
    const { data, error } = await supabase
      .from("guests")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error deleting guest:", error);
      alert("Delete failed: " + (error.message || JSON.stringify(error)));
      setDeleting(false);
      return;
    }

    if (!data || data.length === 0) {
      console.error("Delete did not remove any rows:", data);
      alert("Delete did not remove any rows. Confirm the guest ID and permissions.");
      setDeleting(false);
      return;
    }

    // success
    setDeleting(false);
    navigate("/dashboard");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("guest-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) { console.error("Error uploading photo:", uploadError.message); return; }

    const { data } = supabase.storage
      .from("guest-photos")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("guests")
      .update({ photo_url: data.publicUrl })
      .eq("id", id);

    if (updateError) { console.error("Error updating photo URL:", updateError.message); return; }

    await fetchGuest();
  };

  const handleConfirmLift = async (notes) => {
    const { data: { user } } = await supabase.auth.getUser();
    const activeBan = bans.find((b) => b.is_active);
    if (!activeBan) return;

    const { error } = await supabase
      .from("bans")
      .update({
        is_active: false,
        lifted_by: user.id,
        lift_notes: notes || null,
        lifted_at: new Date().toISOString(),
      })
      .eq("id", activeBan.id);

    if (error) { console.error("Error lifting ban:", error.message); return; }

    await supabase.from("audit_log").insert({
      staff_id: user.id,
      action: "lifted_ban",
      target_type: "ban",
      target_id: activeBan.id,
    });

    setLiftedBanId(activeBan.id);
    setLiftNotes(notes);
    setShowLiftModal(false);
    fetchBans();
  };

  const set = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  );

  if (!guest) return (
    <div className="min-h-screen bg-gray-900 p-8">
      <p className="text-gray-500">Guest not found.</p>
      <Link to="/dashboard" className="text-blue-400 text-sm hover:underline">← Back to dashboard</Link>
    </div>
  );

  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(" ");
  const activeBan = bans.find((b) => b.is_active);

  return (
    <div className="min-h-screen bg-gray-900">

      {/* Navbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <Link to="/dashboard" className="text-blue-400 text-sm hover:underline">
            ← Back to dashboard
          </Link>
          {!editing && (
            <div className="flex gap-2">  
              <button
                onClick={() => setEditing(true)}
                className="bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition"
              >
                Edit Profile
              </button>
              <button
                onClick={() => handleDelete()}
                disabled={deleting}
                className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                {deleting ? "Deleting..." : "Delete Guest"}
              </button>
            </div>
          )}
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setEditForm(guest); }}
                className="bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 flex flex-col gap-6">

        {/* Guest header */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start">
            <div>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editForm.first_name || ""}
                    onChange={(e) => set("first_name", e.target.value)}
                    placeholder="First name *"
                    className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-lg font-semibold"
                  />
                  <input
                    type="text"
                    value={editForm.last_name || ""}
                    onChange={(e) => set("last_name", e.target.value)}
                    placeholder="Last name"
                    className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm"
                  />
                  <input
                    type="text"
                    value={editForm.alias || ""}
                    onChange={(e) => set("alias", e.target.value)}
                    placeholder="Alias / nickname"
                    className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none text-sm"
                  />
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-semibold text-white">{guestName}</h1>
                  {guest.alias && <p className="text-gray-400 text-sm mt-1">aka {guest.alias}</p>}
                </div>
              )}
            </div>
            {activeBan ? (
              <span className="bg-red-900 text-red-300 text-xs font-medium px-3 py-1 rounded-full">Currently Banned</span>
            ) : (
              <span className="bg-green-900 text-green-300 text-xs font-medium px-3 py-1 rounded-full">Not Banned</span>
            )}
          </div>
          <div className="mt-4 relative w-24 h-24">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
              {guest.photo_url ? (
                <img src={guest.photo_url} alt={guestName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-500 text-sm">No photo</span>
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black bg-opacity-50 cursor-pointer hover:bg-opacity-70 transition">
                <span className="text-white text-xs font-medium">Change</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Demographics */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Demographics</h2>
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <EditText field="date_of_birth" label="Date of Birth" type="date" editForm={editForm} set={set} />
              <EditSelect field="gender" label="Gender" options={GENDER_OPTIONS} editForm={editForm} set={set} />
              <EditSelect field="race" label="Race / Ethnicity" options={RACE_OPTIONS} editForm={editForm} set={set} />
              <EditSelect field="living_situation" label="Living Situation" options={LIVING_OPTIONS} editForm={editForm} set={set} />
              <EditSelect field="health_condition" label="Physical and Mental Health" options={HEALTH_OPTIONS} editForm={editForm} set={set} />
              <EditSelect field="veteran" label="Veteran Status" options={VETERAN_OPTIONS} editForm={editForm} set={set} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of Birth" value={guest.date_of_birth} />
              <Field label="Gender" value={guest.gender} />
              <Field label="Race / Ethnicity" value={guest.race} />
              <Field label="Living Situation" value={guest.living_situation} />
              <Field label="Physical and Mental Health" value={guest.health_condition} />
              <Field label="Veteran Status" value={guest.veteran} />
            </div>
          )}
        </div>

        {/* Active ban */}
        {activeBan && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-3">Active Ban</h2>
            <p className="text-sm text-gray-300 mb-1"><span className="font-medium text-white">Issued:</span> {activeBan.issued_date}</p>
            <p className="text-sm text-gray-300 mb-1"><span className="font-medium text-white">Expires:</span> {activeBan.expiry_date}</p>
            <p className="text-sm text-gray-300 mb-1">
              <span className="font-medium text-white">Offenses:</span>{" "}
              {activeBan.ban_offenses.map((bo) => bo.offense?.name).filter(Boolean).join(", ")}
            </p>
            <p className="text-sm text-gray-300 mb-1">
              <span className="font-medium text-white">Issued by:</span>{" "}
              {activeBan.issued_by_staff ? `${activeBan.issued_by_staff.first_name} ${activeBan.issued_by_staff.last_name}` : "Unknown"}
            </p>
            {activeBan.notes && <p className="text-sm text-gray-500 italic mt-2">"{activeBan.notes}"</p>}
            <button
              onClick={() => setShowLiftModal(true)}
              className="mt-4 border border-red-500 text-red-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-900 transition"
            >
              Lift Ban
            </button>
          </div>
        )}

        {/* Ban lifted confirmation */}
        {liftedBanId && (
          <div className="bg-green-950 border border-green-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-green-400 mb-1">Ban Lifted</h2>
            <p className="text-sm text-gray-300">The active ban has been lifted.</p>
            {liftNotes && <p className="text-sm text-gray-500 italic mt-2">"{liftNotes}"</p>}
          </div>
        )}

        {/* Ban history */}
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ban History</h2>
          {bans.length === 0 ? (
            <p className="text-gray-400 text-sm">No ban history for this guest.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {bans.map((ban) => {
                const issuedByStaff = ban.issued_by_staff;
                const liftedByStaff = ban.lifted_by_staff;
                return (
                  <div key={ban.id} className="border-l-4 border-gray-600 pl-4">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-gray-200">
                        {ban.ban_offenses.map((bo) => bo.offense?.name).filter(Boolean).join(", ")}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ban.is_active ? "bg-red-900 text-red-300" : "bg-gray-700 text-gray-400"}`}>
                        {ban.is_active ? "Active" : "Lifted / Expired"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{ban.issued_date} → {ban.expiry_date}</p>
                    {issuedByStaff && (
                      <p className="text-xs text-gray-400">Issued by {issuedByStaff.first_name} {issuedByStaff.last_name}</p>
                    )}
                    {liftedByStaff && (
                      <p className="text-xs text-gray-400">
                        Lifted by {liftedByStaff.first_name} {liftedByStaff.last_name}
                        {ban.lift_notes && ` — "${ban.lift_notes}"`}
                      </p>
                    )}
                    {ban.notes && <p className="text-xs text-gray-500 italic mt-1">"{ban.notes}"</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {showLiftModal && activeBan && (
        <LiftBanModal
          ban={activeBan}
          guest={guest}
          onClose={() => setShowLiftModal(false)}
          onConfirm={handleConfirmLift}
        />
      )}

    </div>
  );
}