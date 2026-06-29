import { useState } from "react";
import { supabase } from "../supabaseClient";
import { applyGuestNameSearch, rankGuestsBySimilarity } from "../utils/searchGuests";

export default function IssueReportModal({ onClose, onSubmit }) {
  const [guests, setGuests] = useState([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [note, setNote] = useState("");

  const fetchGuests = async (search) => {
    if (search.trim().length < 2) { setGuests([]); return; }

    const baseQuery = supabase.from("guests").select("*").limit(10);
    const { data } = await applyGuestNameSearch(baseQuery, search);
    setGuests(rankGuestsBySimilarity(data || [], search));
  };

  const handleSubmit = () => {
    if (!selectedGuest || !note.trim()) return;
    onSubmit({
      guestId: selectedGuest.id,
      note: note.trim(),
    });
    onClose();
  };

  const isValid = selectedGuest && note.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">New Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl transition">✕</button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-6">

          {/* Guest search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Guest <span className="text-red-400">*</span>
            </label>
            {selectedGuest ? (
              <div className="flex justify-between items-center bg-gray-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white font-medium">
                    {[selectedGuest.first_name, selectedGuest.last_name].filter(Boolean).join(" ")}
                  </p>
                  {selectedGuest.alias && (
                    <p className="text-gray-400 text-xs">aka {selectedGuest.alias}</p>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedGuest(null); setGuestSearch(""); }}
                  className="text-gray-400 hover:text-white text-sm transition"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search by name or alias..."
                  value={guestSearch}
                  onChange={(e) => { setGuestSearch(e.target.value); fetchGuests(e.target.value); }}
                  className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500"
                />
                {guests.length > 0 && (
                  <div className="mt-1 bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                    {guests.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setSelectedGuest(g); setGuestSearch(""); setGuests([]); }}
                        className="w-full text-left px-4 py-3 text-white hover:bg-gray-600 transition border-b border-gray-600 last:border-0"
                      >
                        {[g.first_name, g.last_name].filter(Boolean).join(" ")}
                        {g.alias && <span className="text-gray-400 text-sm"> ({g.alias})</span>}
                      </button>
                    ))}
                  </div>
                )}
                {guestSearch.trim().length >= 2 && guests.length === 0 && (
                  <p className="text-gray-500 text-sm mt-2">No guests found.</p>
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Note <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={5}
              placeholder="Describe the incident, health note, or other observation worth recording on this guest's record..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 resize-none"
            />
            <p className="text-gray-500 text-xs mt-1">
              This becomes a permanent part of the guest's record. You'll be able to edit or delete it later, but other staff won't.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full py-3 rounded-lg font-medium text-sm transition ${
              isValid
                ? "bg-yellow-400 text-white hover:bg-yellow-500"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            Save Report
          </button>

        </div>
      </div>
    </div>
  );
}
