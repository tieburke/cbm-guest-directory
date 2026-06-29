import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import BanCard from "../components/BanCard";
import IssueBanModal from "../components/IssueBanModal";
import IssueReportModal from "../components/IssueReportModal";
import { useUserRole } from "../hooks/useUserRole";
import { downloadCSV } from "../utils/exportCSV";
import StaffCreateForm from "../components/StaffCreateForm";
import { applyGuestNameSearch, rankGuestsBySimilarity } from "../utils/searchGuests";

export default function Dashboard() {
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState("bans");

  const [bans, setBans] = useState([]);
  const [bansLoading, setBansLoading] = useState(true);
  const [banSearch, setBanSearch] = useState("");
  const [banFilter, setBanFilter] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [guestSearch, setGuestSearch] = useState("");
  const [guests, setGuests] = useState([]);
  const [allGuests, setAllGuests] = useState([]);
  const [guestsLoading, setGuestsLoading] = useState(false);

  const [checkInFilter, setCheckInFilter] = useState("week");

  const [demographics, setDemographics] = useState(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const [checkIns, setCheckIns] = useState([]);
  const [checkInsLoading, setCheckInsLoading] = useState(false);

  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  useEffect(() => {
    fetchBans();
  }, []);

  useEffect(() => {
    if (activeTab === "demographics" && !demographics) fetchDemographics();
    if (activeTab === "guests") fetchAllGuests();
    if (activeTab === "checkins") fetchCheckIns(checkInFilter);
    if (activeTab === "staff") fetchStaff();
  }, [activeTab]);

  useEffect(() => {
    setActiveTab("checkins");
  }, [isAdmin]);

  const expireOldBans = async () => {
    const today = new Date().toLocaleDateString("en-CA");
    await supabase
      .from("bans")
      .update({ is_active: false })
      .eq("is_active", true)
      .lte("expiry_date", today);
  };

  const fetchBans = async () => {
    setBansLoading(true);
    await expireOldBans();
    const { data, error } = await supabase
      .from("bans")
      .select(`
        *,
        guest:guests(*),
        issued_by_staff:staff!bans_issued_by_fkey(*),
        lifted_by_staff:staff!bans_lifted_by_fkey(*),
        ban_offenses(offense:offenses(*))
      `)
      .order("issued_date", { ascending: false });
    if (error) console.error("Error fetching bans:", error.message);
    else setBans(data);
    setBansLoading(false);
  };

  const fetchGuests = async (value) => {
    if (value.trim().length < 2) { setGuests([]); return; }
    setGuestsLoading(true);
    const baseQuery = supabase
      .from("guests")
      .select("*")
      .limit(20);
    const { data } = await applyGuestNameSearch(baseQuery, value);
    setGuests(rankGuestsBySimilarity(data || [], value));
    setGuestsLoading(false);
  };

  const fetchAllGuests = async () => {
    setGuestsLoading(true);
    const { data } = await supabase
      .from("guests")
      .select("*")
      .order("first_name");
    setAllGuests(data || []);
    setGuestsLoading(false);
  };

  const fetchDemographics = async () => {
    setDemoLoading(true);
    const { data } = await supabase.from("guests").select("*");
    if (data) setDemographics(data);
    setDemoLoading(false);
  };

  const fetchCheckIns = async (filter = checkInFilter) => {
    setCheckInsLoading(true);

    let query = supabase
      .from("check_ins")
      .select(`
        *,
        guest:guests(*),
        event:events(*),
        staff:staff(*)
      `)
      .order("checked_in_at", { ascending: false });

    const now = new Date();

    if (filter === "day") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      query = query.gte("checked_in_at", start.toISOString());
    } else if (filter === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      query = query.gte("checked_in_at", start.toISOString());
    } else if (filter === "month") {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      query = query.gte("checked_in_at", start.toISOString());
    } else if (filter === "year") {
      const start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      query = query.gte("checked_in_at", start.toISOString());
    }
    // "all" — no filter applied

    const { data, error } = await query;
    if (error) console.error("Error fetching check-ins:", error.message);
    else setCheckIns(data);
    setCheckInsLoading(false);
  };

  const handleIssueBan = async ({ guestId, offenseIds, banDays, notes }) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const today = new Date().toLocaleDateString("en-CA"); // Returns YYYY-MM-DD in local time
    const expiryDate = new Date(today);
    expiryDate.setDate(expiryDate.getDate() + banDays);
    const expiryDateStr = expiryDate.toISOString().split("T")[0];

    const { data: ban, error: banError } = await supabase
      .from("bans")
      .insert({
        guest_id: guestId,
        issued_by: user.id,
        issued_date: today,
        expiry_date: expiryDateStr,
        is_active: true,
        notes: notes || null,
      })
      .select()
      .single();

    if (banError) { console.error("Error creating ban:", banError.message); return; }

    await supabase.from("ban_offenses").insert(
      offenseIds.map((offenseId) => ({ ban_id: ban.id, offense_id: offenseId }))
    );

    await supabase.from("audit_log").insert({
      staff_id: user.id,
      action: "issued_ban",
      target_type: "ban",
      target_id: ban.id,
    });

    fetchBans();
  };

  const handleIssueReport = async ({ guestId, note }) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: report, error: reportError } = await supabase
      .from("guest_reports")
      .insert({
        guest_id: guestId,
        staff_id: user.id,
        note,
      })
      .select()
      .single();

    if (reportError) { console.error("Error creating report:", reportError.message); return; }

    await supabase.from("audit_log").insert({
      staff_id: user.id,
      action: "created_report",
      target_type: "guest_report",
      target_id: report.id,
    });
  };

  const visibleBans = bans
    .filter((ban) => {
      if (banFilter === "active") return ban.is_active;
      if (banFilter === "inactive") return !ban.is_active;
      return true;
    })
    .filter((ban) => {
      const fullName = [ban.guest?.first_name, ban.guest?.last_name]
        .filter(Boolean).join(" ").toLowerCase();
      const alias = ban.guest?.alias?.toLowerCase() ?? "";
      return fullName.includes(banSearch.toLowerCase()) ||
        alias.includes(banSearch.toLowerCase());
    });

  const countBy = (field) => {
    if (!demographics) return [];
    const counts = {};
    demographics.forEach((g) => {
      const val = g[field] || "Not recorded";
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const tabs = [
    { id: "checkins", label: "Check-ins" },
    ...(isAdmin ? [{ id: "demographics", label: "Demographics" }] : []),
    { id: "guests", label: "Guests" },
    { id: "bans", label: "Bans" },
    ...(isAdmin ? [{ id: "staff", label: "Staff" }] : []),
  ];

  const exportGuests = () => {
    if (!demographics) return;
    const rows = demographics.map((g) => ({
      "First Name": g.first_name,
      "Last Name": g.last_name || "",
      "Alias": g.alias || "",
      "Date of Birth": g.date_of_birth || "",
      "Gender": g.gender || "",
      "Race / Ethnicity": g.race || "",
      "Living Situation": g.living_situation || "",
      "Health Condition": g.health_condition || "",
      "Veteran Status": g.veteran || "",
      "Created At": new Date(g.created_at).toLocaleDateString(),
    }));
    downloadCSV(rows, `guests-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportCheckIns = () => {
    if (!checkIns.length) return;
    const rows = checkIns.map((ci) => ({
      "Guest First Name": ci.guest?.first_name || "",
      "Guest Last Name": ci.guest?.last_name || "",
      "Event": ci.event?.name || "",
      "Check-in Date": new Date(ci.checked_in_at).toLocaleDateString(),
      "Check-in Time": new Date(ci.checked_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      "Staff": ci.staff ? `${ci.staff.first_name} ${ci.staff.last_name}` : "",
    }));
    downloadCSV(rows, `checkins-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("first_name");
    if (error) console.error("Error fetching staff:", error.message);
    else setStaffList(data || []);
    setStaffLoading(false);
  };

  const handleDeleteStaff = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to delete the account for ${name}? This cannot be undone.`)) return;

    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-account?action=delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(`Error: ${result.error}`);
    } else {
      fetchStaff();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">

      {/* Navbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                to="/settings"
                className="bg-gray-700 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition"
              >
                Settings
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="bg-gray-700 text-white text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3 sm:px-5 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-red-500 text-white"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">

        {/* Quick Actions */}
        <div className="mb-8 flex gap-2 items-center">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mr-2">Quick Actions:</p>
          <Link to="/door-check" className="bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-600 transition">
            Door Check
          </Link>
          <Link to="/guest/new" className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition">
            + New Guest
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            + New Ban
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="bg-yellow-400 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-yellow-500 transition"
          >
            + New Report
          </button>
        </div>

          {/* Check-ins tab */}
          {activeTab === "checkins" && (
          <div>
            {checkInsLoading ? (
              <p className="text-gray-500 text-sm">Loading check-ins...</p>
            ) : (
              <div className="flex flex-col gap-8">
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="checkin-filter" className="text-sm font-medium text-gray-400">
                      Show:
                    </label>
                    <select
                      id="checkin-filter"
                      value={checkInFilter}
                      onChange={(e) => {
                        setCheckInFilter(e.target.value);
                        fetchCheckIns(e.target.value);
                      }}
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
                    >
                      <option value="day">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="year">This Year</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-gray-400 text-sm">{checkIns.length} check-ins</p>
                    <button
                      onClick={exportCheckIns}
                      className="bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                    >
                      Export
                    </button>
                  </div>
                </div>

                {checkIns.length === 0 ? (
                  <p className="text-gray-400 text-sm">No check-ins in this period.</p>
                ) : (
                  <div className="flex flex-col gap-8">
                    {Object.entries(
                      checkIns.reduce((acc, ci) => {
                        const eventName = ci.event?.name ?? "Unknown Event";
                        if (!acc[eventName]) acc[eventName] = [];
                        acc[eventName].push(ci);
                        return acc;
                      }, {})
                    ).map(([eventName, eventCheckIns]) => (
                      <div key={eventName}>
                        <h2 className="text-lg font-semibold text-white mb-4">{eventName}</h2>
                        <div className="flex flex-col gap-4">
                          {Object.entries(
                            eventCheckIns.reduce((acc, ci) => {
                              const date = new Date(ci.checked_in_at).toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              });
                              if (!acc[date]) acc[date] = [];
                              acc[date].push(ci);
                              return acc;
                            }, {})
                          ).map(([date, dayCheckIns]) => (
                            <div key={date} className="bg-gray-800 rounded-lg p-4">
                              <div className="flex justify-between items-center mb-3">
                                <p className="text-sm font-medium text-gray-300">{date}</p>
                                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded-full">
                                  {dayCheckIns.length} {dayCheckIns.length === 1 ? "guest" : "guests"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2">
                                {dayCheckIns.map((ci) => {
                                  const name = [ci.guest?.first_name, ci.guest?.last_name]
                                    .filter(Boolean).join(" ") || "Unknown Guest";
                                  const time = new Date(ci.checked_in_at).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  });
                                  return (
                                    <div key={ci.id} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
                                          {ci.guest?.photo_url ? (
                                            <img src={ci.guest.photo_url} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            <span className="text-gray-500 text-xs">?</span>
                                          )}
                                        </div>
                                        <span className="text-gray-200 text-sm">{name}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-500 text-xs">{time}</span>
                                        <span className="text-gray-500 text-xs">
                                          by {ci.staff?.first_name} {ci.staff?.last_name}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Demographics tab */}
        {activeTab === "demographics" && (
          <div>
            {demoLoading ? (
              <p className="text-gray-500 text-sm">Loading demographics...</p>
            ) : !demographics ? (
              <p className="text-gray-500 text-sm">No data yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Guests</p>
                    <p className="text-4xl font-bold text-white">{demographics.length}</p>
                  </div>
                  <button
                    onClick={exportGuests}
                    className="bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                  >
                    Export Guest Data
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { field: "gender", label: "Gender" },
                    { field: "race", label: "Race / Ethnicity" },
                    { field: "living_situation", label: "Living Situation" },
                    { field: "health_condition", label: "Physical and Mental Health" },
                    { field: "veteran", label: "Veteran Status" },
                  ].map(({ field, label }) => (
                    <div key={field} className="bg-gray-800 rounded-lg p-6">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">{label}</h3>
                      <div className="flex flex-col gap-2">
                        {countBy(field).map(([val, count]) => (
                          <div key={val} className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">{val}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-2 bg-red-600 rounded" style={{ width: `${(count / demographics.length) * 120}px` }} />
                              <span className="text-gray-400 text-xs w-8 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guests tab */}
        {activeTab === "guests" && (
          <div>
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by name or alias..."
                value={guestSearch}
                onChange={(e) => { setGuestSearch(e.target.value); fetchGuests(e.target.value); }}
                className="w-full max-w-sm px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500"
              />
            </div>
            {guestsLoading ? (
              <p className="text-gray-500 text-sm">Loading guests...</p>
            ) : guestSearch.length > 0 && guests.length === 0 ? (
              <div className="flex flex-col gap-3 max-w-sm">
                <p className="text-gray-400 text-sm">No guests found.</p>
                <Link to="/guest/new" className="py-3 rounded-lg bg-green-700 text-white text-sm font-medium text-center hover:bg-green-600 transition">
                  + Add New Guest
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-2xl">
                {(guestSearch.length > 0 ? guests : allGuests).map((g) => {
                  const name = [g.first_name, g.last_name].filter(Boolean).join(" ");
                  return (
                    <Link key={g.id} to={`/guest/${g.id}`}
                      className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-4 hover:bg-gray-700 transition"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 flex items-center justify-center">
                        {g.photo_url ? (
                          <img src={g.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-500 text-xs">?</span>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{name}</p>
                        {g.alias && <p className="text-gray-400 text-xs">aka {g.alias}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bans tab */}
        {activeTab === "bans" && (
          <div>
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Search by name or alias..."
                value={banSearch}
                onChange={(e) => setBanSearch(e.target.value)}
                className="w-full max-w-sm px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500"
              />
              <select
                value={banFilter}
                onChange={(e) => setBanFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-600 bg-gray-700 text-gray-300 focus:outline-none"
              >
                <option value="active">Active Bans</option>
                <option value="inactive">Lifted / Expired</option>
                <option value="all">All Bans</option>
              </select>
            </div>
            {bansLoading ? (
              <p className="text-gray-500 text-sm">Loading bans...</p>
            ) : visibleBans.length === 0 ? (
              <p className="text-gray-400 text-sm">No bans match your search.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {visibleBans.map((ban) => (
                  <BanCard
                    key={ban.id}
                    ban={ban}
                    guest={ban.guest}
                    issuedBy={ban.issued_by_staff}
                    offenses={ban.ban_offenses.map((bo) => bo.offense)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff tab */}
        {activeTab === "staff" && (
          <div className="flex flex-col gap-6 max-w-2xl">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Create New Account</h2>
              <StaffCreateForm onSuccess={fetchStaff} />
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">All Accounts</h2>
              {staffLoading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {staffList.map((s) => (
                    <div key={s.id} className="flex justify-between items-center bg-gray-700 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {[s.first_name, s.last_name].filter(Boolean).join(" ")}
                        </p>
                        {s.username && <p className="text-gray-400 text-xs">{s.username}</p>}
                        {s.email && <p className="text-gray-400 text-xs">{s.email}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteStaff(s.id, [s.first_name, s.last_name].filter(Boolean).join(" "))}
                        className="bg-red-900 text-xs text-red-300 hover:bg-red-800 px-3 py-1 rounded-full transition"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {showModal && (
        <IssueBanModal
          onClose={() => setShowModal(false)}
          onSubmit={handleIssueBan}
        />
      )}

      {showReportModal && (
        <IssueReportModal
          onClose={() => setShowReportModal(false)}
          onSubmit={handleIssueReport}
        />
      )}

    </div>
  );
}