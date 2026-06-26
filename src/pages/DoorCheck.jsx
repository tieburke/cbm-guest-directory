import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function DoorCheck() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [guests, setGuests] = useState([]);
  const [allGuests, setAllGuests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeBan, setActiveBan] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    fetchAllGuests();
  }, [selectedEvent]);

  const getTodayRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setEvents(data || []);
  };

  const fetchGuests = async (value) => {
    if (value.length < 2) {
      setGuests(allGuests);
      return;
    }

    const { data } = await supabase
      .from("guests")
      .select("*")
      .or(`first_name.ilike.%${value}%,last_name.ilike.%${value}%,alias.ilike.%${value}%`)
      .limit(10);

    const matchedGuests = data || [];
    if (!matchedGuests.length) {
      setGuests([]);
      return;
    }

    const guestIds = matchedGuests.map((g) => g.id);
    const { start, end } = getTodayRange();
    const [{ data: banData }, { data: checkInData }] = await Promise.all([
      supabase
        .from("bans")
        .select("guest_id")
        .eq("is_active", true)
        .in("guest_id", guestIds),
      supabase
        .from("check_ins")
        .select("guest_id")
        .eq("event_id", selectedEvent.id)
        .gte("checked_in_at", start)
        .lt("checked_in_at", end)
        .in("guest_id", guestIds),
    ]);

    const bannedIds = new Set((banData || []).map((ban) => ban.guest_id));
    const checkedInIds = new Set((checkInData || []).map((checkIn) => checkIn.guest_id));

    const visibleGuests = matchedGuests
      .filter((g) => !bannedIds.has(g.id))
      .map((g) => ({ ...g }))
      .sort((a, b) => {
        const nameA = [a.first_name, a.last_name].filter(Boolean).join(" ");
        const nameB = [b.first_name, b.last_name].filter(Boolean).join(" ");
        return nameA.localeCompare(nameB);
      });

    setGuests(visibleGuests);
  };

  const fetchAllGuests = async () => {
    const { data } = await supabase
      .from("guests")
      .select("*")
      .order("first_name");

    const guests = data || [];
    const guestIds = guests.map((g) => g.id);

    if (!guestIds.length) {
      setAllGuests([]);
      setGuests([]);
      return;
    }

    const [{ data: banData }, { data: checkInData }] = await Promise.all([
      supabase
        .from("bans")
        .select("guest_id")
        .eq("is_active", true)
        .in("guest_id", guestIds),
      supabase
        .from("check_ins")
        .select("guest_id")
        .eq("event_id", selectedEvent.id)
        .gte("checked_in_at", `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`)
        .lt("checked_in_at", `${new Date().toISOString().split("T")[0]}T23:59:59.999Z`)
        .in("guest_id", guestIds),
    ]);

    const bannedIds = new Set((banData || []).map((ban) => ban.guest_id));
    const checkedInIds = new Set((checkInData || []).map((checkIn) => checkIn.guest_id));

    const guestsWithState = guests
      .map((g) => ({
        ...g,
        isBanned: bannedIds.has(g.id),
      }))
      .sort((a, b) => {
        if (a.isBanned !== b.isBanned) {
          return b.isBanned - a.isBanned;
        }
        const nameA = [a.first_name, a.last_name].filter(Boolean).join(" ");
        const nameB = [b.first_name, b.last_name].filter(Boolean).join(" ");
        return nameA.localeCompare(nameB);
      });

    setAllGuests(guestsWithState);
    setGuests(guestsWithState);
  };

  const handleSelect = async (guest) => {
    setSelected(guest);
    setSearch("");
    setGuests([]);
    setActiveBan(null);
    setAlreadyCheckedIn(false);
    setCheckedIn(false);

    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("bans")
      .update({ is_active: false })
      .eq("is_active", true)
      .lt("expiry_date", today);

    const { start, end } = getTodayRange();
    const [{ data: banData }, { data: checkInData }] = await Promise.all([
      supabase
        .from("bans")
        .select(`
          *,
          issued_by_staff:staff!bans_issued_by_fkey(*),
          ban_offenses(offense:offenses(*))
        `)
        .eq("guest_id", guest.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("check_ins")
        .select("id")
        .eq("guest_id", guest.id)
        .eq("event_id", selectedEvent.id)
        .gte("checked_in_at", start)
        .lt("checked_in_at", end)
        .limit(1),
    ]);

    setActiveBan(banData || null);
    setAlreadyCheckedIn((checkInData || []).length > 0);
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("check_ins").insert({
      guest_id: selected.id,
      staff_id: user.id,
      event_id: selectedEvent.id,
      checked_in_at: new Date().toISOString(),
    });

    await supabase.from("audit_log").insert({
      staff_id: user.id,
      action: "checked_in",
      target_type: "guest",
      target_id: selected.id,
    });

    setCheckingIn(false);
    setCheckedIn(true);
    setAlreadyCheckedIn(true);
    setAllGuests((prev) => prev.map((g) => g.id === selected.id ? { ...g, isCheckedIn: true } : g));
    setGuests((prev) => prev.map((g) => g.id === selected.id ? { ...g, isCheckedIn: true } : g));
  };

  const guestName = selected
    ? [selected.first_name, selected.last_name].filter(Boolean).join(" ")
    : "";

  // Event selection screen
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex justify-between items-center mb-10">
            <h1 className="text-xl font-semibold text-white">Door Check</h1>
            <Link to="/dashboard" className="px-3 py-3 rounded-lg bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition">
              Dashboard →
            </Link>
          </div>

          <p className="text-gray-400 text-sm text-center mb-6">Which event are you checking guests into?</p>

          <div className="flex flex-col gap-4">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="w-full py-6 rounded-xl bg-gray-800 border border-gray-700 text-white text-lg font-semibold hover:bg-gray-700 hover:border-gray-500 transition"
              >
                {event.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main door check screen
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-semibold">Door Check</h1>
          <Link to="/dashboard" className="px-3 py-3 rounded-lg bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition">
            Dashboard →
          </Link>
        </div>

        {/* Active event banner */}
        <div className="flex justify-between items-center bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current event</p>
            <p className="text-white font-medium">{selectedEvent.name}</p>
          </div>
          <button
            onClick={() => { setSelectedEvent(null); setSelected(null); setSearch(""); setActiveBan(null); }}
            className="text-gray-400 text-sm hover:text-white transition"
          >
            Switch
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search guest name or alias..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
            setActiveBan(null);
            setCheckedIn(false);
            fetchGuests(e.target.value);
          }}
          className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 text-lg"
          autoFocus
        />

        {/* Search results */}
        {guests.length > 0 && !selected && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            {guests.map((g) => {
              const name = [g.first_name, g.last_name].filter(Boolean).join(" ");
              return (
                <button
                  key={g.id}
                  onClick={() => handleSelect(g)}
                  className="relative w-full overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 text-left hover:bg-gray-700 transition"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-gray-700 flex items-center justify-center">
                    {g.photo_url ? (
                      <img src={g.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-gray-400 text-xl">?</span>
                      </div>
                    )}
                    {g.isBanned && (
                      <span className="absolute top-3 right-3 rounded-full bg-red-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg">
                        Banned
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-3">
                    <p className="text-white text-sm font-semibold leading-tight">{name}</p>
                    {g.alias && <p className="text-gray-400 text-xs mt-1">aka {g.alias}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {search.length >= 2 && guests.length === 0 && !selected && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-gray-500 text-sm">No guests found.</p>
            <Link
              to="/guest/new?from=doorcheck"
              className="w-full py-3 rounded-lg bg-green-700 text-white text-sm font-medium text-center hover:bg-green-600 transition"
            >
              + Add New Guest
            </Link>
          </div>
        )}

        {/* Result */}
        {selected && (
          <div className="mt-6">
            {activeBan ? (
              <div className="bg-red-900 border border-red-600 rounded-xl p-6 text-center">
                <div className="text-5xl mb-3">🚫</div>
                <h2 className="text-2xl font-bold text-red-300 mb-1">BANNED</h2>
                <p className="text-white text-lg font-medium mb-4">{guestName}</p>
                <div className="text-left bg-red-950 rounded-lg p-4 flex flex-col gap-2">
                  <p className="text-sm text-red-200">
                    <span className="font-medium">Expires:</span> {activeBan.expiry_date}
                  </p>
                  <p className="text-sm text-red-200">
                    <span className="font-medium">Offenses:</span>{" "}
                    {activeBan.ban_offenses.map((bo) => bo.offense?.name).filter(Boolean).join(", ")}
                  </p>
                  <p className="text-sm text-red-200">
                    <span className="font-medium">Issued by:</span>{" "}
                    {activeBan.issued_by_staff
                      ? `${activeBan.issued_by_staff.first_name} ${activeBan.issued_by_staff.last_name}`
                      : "Unknown"}
                  </p>
                  {activeBan.notes && (
                    <p className="text-sm text-red-300 italic">"{activeBan.notes}"</p>
                  )}
                </div>
                <Link
                  to={`/guest/${selected.id}`}
                  className="mt-4 inline-block text-red-300 text-sm hover:underline"
                >
                  View full profile →
                </Link>
                <button
                  onClick={() => { setSelected(null); setSearch(""); setActiveBan(null); setGuests(allGuests); }}
                  className="mt-4 w-full py-3 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition"
                >
                  Back to search
                </button>
              </div>
            ) : checkedIn ? (
              <div className="bg-green-900 border border-green-600 rounded-xl p-6 text-center">
                <div className="text-5xl mb-3">✅</div>
                <h2 className="text-2xl font-bold text-green-300 mb-1">CHECKED IN</h2>
                <p className="text-white text-lg font-medium">{guestName}</p>
                <p className="text-green-400 text-sm mt-2">{selectedEvent.name}</p>
                <button
                  onClick={() => { setSelected(null); setSearch(""); setActiveBan(null); setCheckedIn(false); setGuests(allGuests); }}
                  className="mt-6 w-full py-3 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 transition"
                >
                  Check in another guest
                </button>
              </div>
            ) : (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  {selected.photo_url ? (
                    <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 text-sm">No photo</span>
                  )}
                </div>
                <p className="text-white text-xl font-semibold mb-1">{guestName}</p>
                {selected.alias && <p className="text-gray-400 text-sm mb-4">aka {selected.alias}</p>}
                <p className="text-green-400 text-sm mb-6">No active ban on record.</p>
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn || alreadyCheckedIn}
                  className={`w-full py-4 rounded-xl font-semibold text-lg transition ${
                    checkingIn || alreadyCheckedIn
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-500"
                  }`}
                >
                  {checkingIn
                    ? "Checking in..."
                    : alreadyCheckedIn
                      ? "Already checked in"
                      : `Check in to ${selectedEvent.name}`}
                </button>
                {alreadyCheckedIn && (
                  <p className="mt-3 text-sm text-gray-400">This guest has already been checked in for today.</p>
                )}
                <Link
                  to={`/guest/${selected.id}`}
                  className="mt-4 inline-block text-gray-400 text-sm hover:text-white"
                >
                  View full profile →
                </Link>
                <button
                  onClick={() => { setSelected(null); setSearch(""); setActiveBan(null); setGuests(allGuests); }}
                  className="mt-3 w-full py-3 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition"
                >
                  Back to search
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}