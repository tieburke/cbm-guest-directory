import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useUserRole } from "../hooks/useUserRole";

export default function Settings() {
  const { isAdmin } = useUserRole();

  // Events state
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [eventsLoading, setEventsLoading] = useState(true);

  // Offense categories state
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Offenses state
  const [offenses, setOffenses] = useState([]);
  const [newOffense, setNewOffense] = useState({ name: "", category_id: "", default_ban_days: "" });

  useEffect(() => {
    if (isAdmin) {
      fetchEvents();
      fetchCategories();
      fetchOffenses();
    }
  }, [isAdmin]);

  const fetchEvents = async () => {
    setEventsLoading(true);
    const { data } = await supabase.from("events").select("*").order("name");
    setEvents(data || []);
    setEventsLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("offense_categories").select("*").order("name");
    setCategories(data || []);
  };

  const fetchOffenses = async () => {
    const { data } = await supabase
      .from("offenses")
      .select("*, category:offense_categories(*)")
      .order("name");
    setOffenses(data || []);
  };

  const addEvent = async () => {
    if (!newEventName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("events").insert({
      name: newEventName.trim(),
      is_active: true,
      created_by: user.id,
    });
    if (error) { console.error("Error adding event:", error.message); return; }
    setNewEventName("");
    fetchEvents();
  };

  const toggleEvent = async (event) => {
    await supabase.from("events").update({ is_active: !event.is_active }).eq("id", event.id);
    fetchEvents();
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase.from("offense_categories").insert({ name: newCategoryName.trim() });
    if (error) { console.error("Error adding category:", error.message); return; }
    setNewCategoryName("");
    fetchCategories();
  };

  const addOffense = async () => {
    if (!newOffense.name.trim() || !newOffense.category_id || !newOffense.default_ban_days) return;
    const { error } = await supabase.from("offenses").insert({
      name: newOffense.name.trim(),
      category_id: newOffense.category_id,
      default_ban_days: parseInt(newOffense.default_ban_days),
    });
    if (error) { console.error("Error adding offense:", error.message); return; }
    setNewOffense({ name: "", category_id: "", default_ban_days: "" });
    fetchOffenses();
  };

  const deleteOffense = async (id) => {
    const { count } = await supabase
        .from("ban_offenses")
        .select("*", { count: "exact" })
        .eq("offense_id", id);

    if (count > 0) {
        alert(`Cannot delete this offense - it's used by ${count} active ban(s).`);
        return;
    }

    const { error } = await supabase.from("offenses").delete().eq("id", id);
    if (error) { 
        console.error("Error deleting offense:", error.message); 
        return; 
    }
    fetchOffenses();
  };

  if (!isAdmin) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Access restricted to admins.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">

      {/* Navbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <Link to="/dashboard" className="text-blue-400 text-sm hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">

        {/* Events */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Check-in Events</h2>

          <div className="flex flex-col gap-2 mb-4">
            {eventsLoading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : events.map((event) => (
              <div key={event.id} className="flex justify-between items-center bg-gray-700 rounded-lg px-4 py-3">
                <span className={`text-sm ${event.is_active ? "text-white" : "text-gray-500 line-through"}`}>
                  {event.name}
                </span>
                <button
                  onClick={() => toggleEvent(event)}
                  className={`text-xs font-medium px-3 py-1 rounded-full transition ${
                    event.is_active
                      ? "bg-red-900 text-red-300 hover:bg-red-800"
                      : "bg-green-900 text-green-300 hover:bg-green-800"
                  }`}
                >
                  {event.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New event name..."
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEvent()}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 text-sm"
            />
            <button
              onClick={addEvent}
              className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Add
            </button>
          </div>
        </div>

        {/* Offense Categories */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Offense Categories</h2>

          <div className="flex flex-col gap-2 mb-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-gray-700 rounded-lg px-4 py-3">
                <span className="text-white text-sm">{cat.name}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 text-sm"
            />
            <button
              onClick={addCategory}
              className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Add
            </button>
          </div>
        </div>

        {/* Offenses */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Offenses</h2>

          <div className="flex flex-col gap-2 mb-4">
            {categories.map((cat) => {
              const catOffenses = offenses.filter((o) => o.category_id === cat.id);
              if (catOffenses.length === 0) return null;
              return (
                <div key={cat.id} className="mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cat.name}</p>
                  {catOffenses.map((offense) => (
                    <div key={offense.id} className="flex justify-between items-center bg-gray-700 rounded-lg px-4 py-3 mb-1">
                      <div>
                        <span className="text-white text-sm">{offense.name}</span>
                        <span className="text-gray-400 text-xs ml-3">{offense.default_ban_days} day default</span>
                      </div>
                      <button
                        onClick={() => deleteOffense(offense.id)}
                        className="bg-red-900 text-xs text-red-300 hover:bg-red-800 px-3 py-1 rounded-full transition"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <select
              value={newOffense.category_id}
              onChange={(e) => setNewOffense((prev) => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-300 focus:outline-none text-sm"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Offense name..."
                value={newOffense.name}
                onChange={(e) => setNewOffense((prev) => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none text-sm"
              />
              <input
                type="number"
                placeholder="Days"
                min="1"
                value={newOffense.default_ban_days}
                onChange={(e) => setNewOffense((prev) => ({ ...prev, default_ban_days: e.target.value }))}
                className="w-24 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none text-sm"
              />
              <button
                onClick={addOffense}
                className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}