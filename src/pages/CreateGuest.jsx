import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/resizeImage";

const GENDER_OPTIONS = ["Male", "Female", "No single gender", "Questioning", "Transgender", "Client doesn't know / refused"];
const RACE_OPTIONS = ["American Indian or Alaska Native", "Asian or Asian American", "Black, African American, or African", "Hispanic/Latina/e/o", "Middle Eastern or North African", "Native Hawaiian or Pacific Islander", "White", "Multiracial", "Client doesn't know"];
const LIVING_OPTIONS = ["Sheltered", "Unsheltered", "Working Poor", "Stably Housed", "Other"];
const HEALTH_OPTIONS = ["Physical and/or Mental Health Condition", "No Physical and/or Mental Health Condition"];
const VETERAN_OPTIONS = ["Veteran", "Not a Veteran"];

export default function CreateGuest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromDoorCheck = searchParams.get("from") === "doorcheck";
  const eventId = searchParams.get("eventId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    alias: "",
    date_of_birth: "",
    gender: "",
    race: "",
    living_situation: "",
    health_condition: "",
    veteran: "",
  });

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.first_name.trim()) { setError("First name is required."); return; }
    setLoading(true);
    setError("");

    const payload = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim() || null,
    alias: form.alias.trim() || null,
    date_of_birth: form.date_of_birth || null,
    gender: form.gender || null,
    race: form.race || null,
    living_situation: form.living_situation || null,
    health_condition: form.health_condition || null,
    veteran: form.veteran || null,
    };

    const { data, error } = await supabase.from("guests").insert(payload).select().single();

    if (error) {
      console.error("Error creating guest:", error.message);
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Upload photo if one was selected
    if (photoFile) {
      let fileToUpload = photoFile;
      try {
        fileToUpload = await resizeImage(photoFile);
      } catch (resizeErr) {
        console.error("Resize failed, uploading original:", resizeErr);
      }

      const filePath = `${data.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("guest-photos")
        .upload(filePath, fileToUpload, { upsert: true, contentType: "image/jpeg" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("guest-photos")
          .getPublicUrl(filePath);

        await supabase
          .from("guests")
          .update({ photo_url: urlData.publicUrl })
          .eq("id", data.id);
      }
    }

    // If created from Door Check with an active event selected, check the new guest
    // in to that event immediately — staff shouldn't have to search for them again.
    if (fromDoorCheck && eventId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: checkInError } = await supabase.from("check_ins").insert({
          guest_id: data.id,
          staff_id: user.id,
          event_id: eventId,
          checked_in_at: new Date().toISOString(),
        });
        if (checkInError) {
          console.error("Error auto-checking-in new guest:", checkInError.message);
        } else {
          await supabase.from("audit_log").insert({
            staff_id: user.id,
            action: "checked_in",
            target_type: "guest",
            target_id: data.id,
          });
        }
      }
    }

    if (fromDoorCheck) {
      navigate("/door-check");
    } else {
      navigate(`/guest/${data.id}`);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <Link to={fromDoorCheck ? "/door-check" : "/dashboard"} className="text-blue-400 text-sm hover:underline">
            ← Back
          </Link>
        </div>
        <div className="flex flex-col gap-6">

        {/* Basic info */}
        <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Basic Information</h2>
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 text-sm">No photo</span>
                )}
              </div>
              <label className="cursor-pointer bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition">
                {photoPreview ? "Change Photo" : "Add Photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex flex-col gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                First Name <span className="text-red-400">*</span>
                </label>
                <input
                type="text"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500"
                placeholder="Required"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Last Name <span className="text-gray-500 font-normal">(optional)</span></label>
                <input type="text" value={form.last_name} onChange={(e) => set("last_name", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Alias / Nickname <span className="text-gray-500 font-normal">(optional)</span></label>
                <input type="text" value={form.alias} onChange={(e) => set("alias", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Date of Birth <span className="text-gray-500 font-normal">(optional)</span></label>
                <input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-gray-500" />
            </div>
            </div>
        </div>

        {/* Demographics */}
        <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Demographics <span className="text-gray-600 normal-case font-normal">(all optional)</span></h2>
            <div className="flex flex-col gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Gender</label>
                <select value={form.gender} onChange={(e) => set("gender", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none focus:border-gray-500">
                <option value="">Select...</option>
                {GENDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Race / Ethnicity</label>
                <select value={form.race} onChange={(e) => set("race", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none focus:border-gray-500">
                <option value="">Select...</option>
                {RACE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Living Situation</label>
                <select value={form.living_situation} onChange={(e) => set("living_situation", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none focus:border-gray-500">
                <option value="">Select...</option>
                {LIVING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Physical and Mental Health</label>
                <select value={form.health_condition} onChange={(e) => set("health_condition", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none focus:border-gray-500">
                <option value="">Select...</option>
                {HEALTH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Veteran Status</label>
                <select value={form.veteran} onChange={(e) => set("veteran", e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none focus:border-gray-500">
                <option value="">Select...</option>
                {VETERAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
            </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-medium text-sm transition ${
            loading ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"
            }`}
        >
            {loading ? "Creating..." : "Create Guest Profile"}
        </button>

        </div>
      </div>
    </div>
  );
}