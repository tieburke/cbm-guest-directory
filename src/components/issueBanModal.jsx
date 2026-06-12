import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function IssueBanModal({ onClose, onSubmit }) {
  const [guests, setGuests] = useState([]);
  const [offenseCategories, setOffenseCategories] = useState([]);
  const [offenses, setOffenses] = useState([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [selectedOffenseIds, setSelectedOffenseIds] = useState([]);
  const [customDays, setCustomDays] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchOffenses();
  }, []);

  const fetchOffenses = async () => {
    const { data: categories } = await supabase
      .from("offense_categories")
      .select("*")
      .order("name");

    const { data: offenseData } = await supabase
      .from("offenses")
      .select("*")
      .order("name");

    setOffenseCategories(categories || []);
    setOffenses(offenseData || []);
  };

  const fetchGuests = async (search) => {
    if (search.length < 2) { setGuests([]); return; }

    const { data } = await supabase
      .from("guests")
      .select("*")
      .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,alias.ilike.%${search}%`)
      .limit(10);

    setGuests(data || []);
  };

  const suggestedDays = selectedOffenseIds.length > 0
    ? Math.max(...selectedOffenseIds.map((id) => {
        const offense = offenses.find((o) => o.id === id);
        return offense ? offense.default_ban_days : 0;
      }))
    : "";

  const banDays = customDays !== "" ? customDays : suggestedDays;

  const toggleOffense = (id) => {
    setSelectedOffenseIds((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
    setCustomDays("");
  };

  const handleSubmit = () => {
    if (!selectedGuest || selectedOffenseIds.length === 0 || !banDays) return;
    onSubmit({
      guestId: selectedGuest.id,
      offenseIds: selectedOffenseIds,
      banDays: parseInt(banDays),
      notes,
    });
    onClose();
  };

  const isValid = selectedGuest && selectedOffenseIds.length > 0 && banDays;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Issue a Ban</h2>
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
                {guestSearch.length >= 2 && guests.length === 0 && (
                  <p className="text-gray-500 text-sm mt-2">No guests found.</p>
                )}
              </div>
            )}
          </div>

          {/* Offenses */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Offenses <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-col gap-4">
              {offenseCategories.map((category) => (
                <div key={category.id}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {category.name}
                  </p>
                  <div className="flex flex-col gap-1">
                    {offenses
                      .filter((o) => o.category_id === category.id)
                      .map((offense) => (
                        <button
                          key={offense.id}
                          onClick={() => toggleOffense(offense.id)}
                          className={`text-left px-4 py-2 rounded-lg text-sm transition flex justify-between items-center ${
                            selectedOffenseIds.includes(offense.id)
                              ? "bg-red-900 border border-red-600 text-red-200"
                              : "bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600"
                          }`}
                        >
                          <span>{offense.name}</span>
                          <span className="text-xs text-gray-400">{offense.default_ban_days}d default</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ban Duration (days) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder={suggestedDays ? `Suggested: ${suggestedDays} days` : "Enter days..."}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500"
            />
            {suggestedDays && customDays === "" && (
              <p className="text-gray-500 text-xs mt-1">
                Using suggested duration of {suggestedDays} days based on selected offenses.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Add any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full py-3 rounded-lg font-medium text-sm transition ${
              isValid
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            Issue Ban
          </button>

        </div>
      </div>
    </div>
  );
}