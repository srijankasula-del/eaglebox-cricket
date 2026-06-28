import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../lib/api";

const sections = [
  { id: "dashboard", label: "Dashboard" },
  { id: "bookings", label: "Bookings" },
  { id: "corporate", label: "Corporate Requests" },
  { id: "refunds", label: "Refunds" },
  { id: "analytics", label: "Analytics" },
];

const statusStyle = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-blue-50 text-blue-800 ring-blue-200",
  cancelled: "bg-red-50 text-red-800 ring-red-200",
};

const branchOptions = ["all", "Madhapur", "Kukatpally", "Kompally"];

function toBranchLabel(value) {
  if (value === "all") return "All Branches";
  return value;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [branchFilter, setBranchFilter] = useState("all");
  const [bookings, setBookings] = useState([]);
  const [cancelRequests, setCancelRequests] = useState([]);
  const [corporateRequests, setCorporateRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loadErrors, setLoadErrors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [selectedCorporateRequest, setSelectedCorporateRequest] = useState(null);
  const [requestAvailability, setRequestAvailability] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [groundSelection, setGroundSelection] = useState("");
  const [conflictModal, setConflictModal] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchData = useCallback(async ({ showRefresh = false } = {}) => {
    if (showRefresh) {
      setRefreshing(true);
      setMessage("");
    }

    const endpoints = [
      ["bookings", "Bookings", () => axios.get(`${API_URL}/api/bookings`, { headers: authHeaders })],
      ["cancelRequests", "Refund requests", () => axios.get(`${API_URL}/api/cancellation-requests`, { headers: authHeaders })],
      ["corporateRequests", "Corporate requests", () => axios.get(`${API_URL}/api/corporate-requests`, { headers: authHeaders })],
      ["analytics", "Analytics", () => axios.get(`${API_URL}/api/analytics`, { headers: authHeaders })],
    ];

    const results = await Promise.allSettled(endpoints.map((item) => item[2]()));
    const errors = [];

    results.forEach((result, index) => {
      const [key, label] = endpoints[index];
      if (result.status === "fulfilled") {
        const data = result.value.data || [];
        if (key === "bookings") setBookings(data);
        if (key === "cancelRequests") setCancelRequests(data);
        if (key === "corporateRequests") setCorporateRequests(data);
        if (key === "analytics") setAnalytics(data);
      } else {
        const status = result.reason?.response?.status;
        const backendError = result.reason?.response?.data?.error || result.reason?.message || "Request failed";
        errors.push(`${label}${status ? ` (${status})` : ""}: ${backendError}`);
      }
    });

    setLoadErrors(errors);
    if (showRefresh) setMessage("Dashboard refreshed.");
    setRefreshing(false);
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const filteredBookings = bookings.filter((booking) => {
    if (branchFilter !== "all" && booking.branch_name && !booking.branch_name.toLowerCase().includes(branchFilter.toLowerCase())) {
      return false;
    }
    if (bookingStatusFilter !== "all" && booking.status !== bookingStatusFilter) {
      return false;
    }
    return true;
  });

  const dashboardBookings = bookings.filter((booking) => {
    if (branchFilter === "all") return true;
    return booking.branch_name?.toLowerCase().includes(branchFilter.toLowerCase());
  });

  const today = new Date().toDateString();
  const todayBookings = dashboardBookings.filter((booking) => new Date(booking.booking_date).toDateString() === today);
  const pendingCorporate = corporateRequests.filter((request) => request.status === "pending");
  const pendingRefunds = cancelRequests.filter((request) => request.status === "pending");
  const todayRevenue = todayBookings.reduce((sum, booking) => booking.payment_status === "paid" ? sum + Number(booking.amount || 0) : sum, 0);
  const occupancyByBranch = dashboardBookings.reduce((grouped, booking) => {
    const key = booking.branch_name || "Unknown";
    if (!grouped[key]) grouped[key] = { total: 0, confirmed: 0, completed: 0 };
    grouped[key].total += 1;
    if (booking.status === "confirmed") grouped[key].confirmed += 1;
    if (booking.status === "completed") grouped[key].completed += 1;
    return grouped;
  }, {});

  const recentActivity = [
    ...todayBookings.slice(0, 3).map((booking) => ({ type: "Booking", text: `${booking.customer_name} booked ${booking.ground_name}` })),
    ...pendingCorporate.slice(0, 2).map((request) => ({ type: "Corporate", text: `${request.company_name} awaiting review` })),
    ...pendingRefunds.slice(0, 2).map((request) => ({ type: "Refund", text: `Booking #${request.booking_id} pending refund review` })),
  ].slice(0, 6);

  const exportBookings = () => {
    setExportingCsv(true);
    axios.get(`${API_URL}/api/bookings-export`, { headers: authHeaders, responseType: "blob" })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "bookings-export.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setMessage("Bookings exported to CSV.");
      })
      .catch((error) => {
        console.error(error);
        setMessage("Failed to export bookings.");
      })
      .finally(() => setExportingCsv(false));
  };

  const refreshAfterCorporateAction = async (messageText, keepSelection = false) => {
    await fetchData();
    setMessage(messageText);
    if (!keepSelection) {
      setSelectedCorporateRequest(null);
      setRequestAvailability(null);
      setGroundSelection("");
      setConflictModal(null);
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      setActionBusy(`booking-${bookingId}`);
      await axios.patch(`${API_URL}/api/bookings/${bookingId}/status`, { status }, { headers: authHeaders });
      setBookings((prev) => prev.map((booking) => booking.id === bookingId ? { ...booking, status } : booking));
      setMessage(`Booking #${bookingId} marked ${status}.`);
    } catch (error) {
      console.error(error);
      setMessage("Failed to update booking status.");
    } finally {
      setActionBusy(null);
    }
  };

  const updateRefundStatus = async (requestId, status) => {
    try {
      setActionBusy(`refund-${requestId}`);
      await axios.patch(`${API_URL}/api/cancellation-requests/${requestId}/status`, { status }, { headers: authHeaders });
      setCancelRequests((prev) => prev.filter((request) => request.id !== requestId));
      setMessage(`Refund request ${status}.`);
    } catch (error) {
      console.error(error);
      setMessage("Failed to update refund request.");
    } finally {
      setActionBusy(null);
    }
  };

  const openCorporateReview = async (request) => {
    setSelectedCorporateRequest(request);
    setRequestAvailability(null);
    setGroundSelection(String(request.ground_id || ""));
    setReviewing(true);
    try {
      const response = await axios.get(`${API_URL}/api/corporate-requests/${request.id}/availability`, { headers: authHeaders });
      setRequestAvailability(response.data);
      setGroundSelection(String(response.data.request.ground_id || ""));
    } catch (error) {
      console.error(error);
      setRequestAvailability({ error: error.response?.data?.error || "Failed to load availability." });
    } finally {
      setReviewing(false);
    }
  };

  const assignGround = async () => {
    if (!selectedCorporateRequest || !groundSelection) {
      setMessage("Choose a ground before approval.");
      return;
    }

    try {
      setActionBusy(`corp-${selectedCorporateRequest.id}-ground`);
      const response = await axios.patch(
        `${API_URL}/api/corporate-requests/${selectedCorporateRequest.id}/ground`,
        { groundId: Number(groundSelection) },
        { headers: authHeaders }
      );
      setCorporateRequests((prev) =>
        prev.map((request) =>
          request.id === selectedCorporateRequest.id
            ? { ...request, ground_id: Number(response.data?.ground_id || groundSelection) }
            : request
        )
      );
      await refreshAfterCorporateAction("Ground assigned successfully.", true);
      await openCorporateReview({ ...selectedCorporateRequest, ground_id: Number(response.data?.ground_id || groundSelection) });
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "Failed to assign ground.");
    } finally {
      setActionBusy(null);
    }
  };

  const approveCorporate = async () => {
    if (!selectedCorporateRequest) return;

    try {
      setActionBusy(`corp-${selectedCorporateRequest.id}-approve`);
      await axios.patch(
        `${API_URL}/api/corporate-requests/${selectedCorporateRequest.id}/status`,
        { status: "approved", groundId: Number(groundSelection) },
        { headers: authHeaders }
      );
      await refreshAfterCorporateAction("Corporate request approved.");
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409 && error.response?.data?.conflict) {
        setConflictModal({
          requestId: selectedCorporateRequest.id,
          conflict: error.response.data.conflict,
        });
        setMessage("Booking conflict detected.");
      } else {
        setMessage(error.response?.data?.error || "Failed to approve corporate request.");
      }
    } finally {
      setActionBusy(null);
    }
  };

  const rejectCorporate = async (requestId) => {
    try {
      setActionBusy(`corp-${requestId}-reject`);
      await axios.patch(`${API_URL}/api/corporate-requests/${requestId}/status`, { status: "rejected" }, { headers: authHeaders });
      await refreshAfterCorporateAction("Corporate request rejected.");
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "Failed to reject corporate request.");
    } finally {
      setActionBusy(null);
    }
  };

  const filteredCorporateRequests = corporateRequests.filter((request) => {
    if (branchFilter === "all") return true;
    return request.branch_name?.toLowerCase().includes(branchFilter.toLowerCase());
  });

  const analyticsCards = [
    ["Total Bookings", analytics?.totalBookings ?? bookings.length],
    ["Today's Bookings", analytics?.todaysBookings ?? todayBookings.length],
    ["Confirmed Bookings", analytics?.confirmedBookings ?? bookings.filter((booking) => booking.status === "confirmed").length],
    ["Cancelled Bookings", analytics?.cancelledBookings ?? bookings.filter((booking) => booking.status === "cancelled").length],
    ["Corporate Requests", analytics?.corporateRequests ?? corporateRequests.length],
    ["Total Revenue", `Rs. ${Number(analytics?.totalRevenue ?? todayRevenue ?? 0).toLocaleString("en-IN")}`],
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-slate-950 px-5 py-6 text-white lg:flex lg:flex-col">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">Eagle Box</p>
            <h1 className="mt-2 text-2xl font-black">Admin Workspace</h1>
            <p className="mt-2 text-sm text-slate-300">Venue operations, not a generic dashboard.</p>
          </div>

          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                  activeSection === section.id ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Branch view</p>
            <div className="mt-3 space-y-2">
              {branchOptions.map((branch) => (
                <button
                  key={branch}
                  onClick={() => setBranchFilter(branch)}
                  className={`block w-full rounded-xl px-3 py-2 text-left ${
                    branchFilter === branch ? "bg-white text-slate-950" : "bg-white/5 text-slate-200"
                  }`}
                >
                  {toBranchLabel(branch)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Active branch</p>
                <h2 className="mt-1 text-2xl font-black">{toBranchLabel(branchFilter)}</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={exportBookings} disabled={exportingCsv} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-60">
                  {exportingCsv ? "Exporting..." : "Export CSV"}
                </button>
                <button onClick={() => fetchData({ showRefresh: true })} disabled={refreshing} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-60">
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/admin"); }} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 lg:px-8">
            {message ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
            {loadErrors.length > 0 ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Partially loaded: {loadErrors.join(" | ")}</div> : null}

            {activeSection === "dashboard" ? (
              <div className="space-y-6">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {analyticsCards.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-semibold text-slate-500">{label}</p>
                      <p className="mt-2 text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black">Branch Summary</h3>
                        <p className="text-sm text-slate-500">Occupancy and activity by branch.</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {Object.entries(occupancyByBranch).length === 0 ? <p className="text-sm text-slate-500">No booking data for the selected branch.</p> : null}
                      {Object.entries(occupancyByBranch).map(([branch, stats]) => (
                        <div key={branch} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold">{branch}</span>
                            <span className="text-slate-500">{stats.total} bookings</span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, stats.total * 20)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black">Recent Activity</h3>
                    <div className="mt-4 space-y-3">
                      {recentActivity.length === 0 ? <p className="text-sm text-slate-500">No recent activity.</p> : null}
                      {recentActivity.map((item, index) => (
                        <div key={index} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.type}</p>
                          <p className="mt-1 text-sm font-semibold">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {activeSection === "bookings" ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-xl font-black">Bookings</h3>
                    <p className="text-sm text-slate-500">Primary operational workspace.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Search bookings" />
                    <select value={bookingStatusFilter} onChange={(e) => setBookingStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
                      <option value="all">All statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[960px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-3 pr-4">Customer</th>
                        <th className="py-3 pr-4">Branch</th>
                        <th className="py-3 pr-4">Ground</th>
                        <th className="py-3 pr-4">Date / Time</th>
                        <th className="py-3 pr-4">Payment</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td className="py-4 pr-4 align-top">
                            <p className="font-black">{booking.customer_name}</p>
                            <p className="text-slate-500">{booking.phone}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">{booking.branch_name}</td>
                          <td className="py-4 pr-4 align-top">{booking.ground_name}</td>
                          <td className="py-4 pr-4 align-top">
                            <p>{new Date(booking.booking_date).toLocaleDateString("en-GB")}</p>
                            <p className="text-slate-500">{booking.start_time} - {booking.end_time}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">{booking.payment_status} / Rs. {booking.amount}</td>
                          <td className="py-4 pr-4 align-top"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusStyle[booking.status] || "bg-slate-100 text-slate-700"}`}>{booking.status}</span></td>
                          <td className="py-4 pr-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => navigate(`/admin/bookings/${booking.id}`)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Details</button>
                              <button onClick={() => updateBookingStatus(booking.id, "completed")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Complete</button>
                              <button onClick={() => updateBookingStatus(booking.id, "cancelled")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeSection === "corporate" ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black">Corporate Requests</h3>
                    <p className="text-sm text-slate-500">Dedicated corporate management workspace.</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-800">{filteredCorporateRequests.length}</span>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-3 pr-4">Company</th>
                        <th className="py-3 pr-4">Branch</th>
                        <th className="py-3 pr-4">Date</th>
                        <th className="py-3 pr-4">Time</th>
                        <th className="py-3 pr-4">Employees</th>
                        <th className="py-3 pr-4">Assigned Ground</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCorporateRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="py-4 pr-4 align-top">
                            <p className="font-black">{request.company_name}</p>
                            <p className="text-slate-500">{request.contact_person}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">{request.branch_name}</td>
                          <td className="py-4 pr-4 align-top">{new Date(request.event_date).toLocaleDateString("en-GB")}</td>
                          <td className="py-4 pr-4 align-top">{request.preferred_time}</td>
                          <td className="py-4 pr-4 align-top">{request.employee_count}</td>
                          <td className="py-4 pr-4 align-top">{request.assigned_ground_name || "Unassigned"}</td>
                          <td className="py-4 pr-4 align-top"><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${statusStyle[request.status] || "bg-slate-100 text-slate-700"}`}>{request.status}</span></td>
                          <td className="py-4 pr-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => openCorporateReview(request)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Review</button>
                              {request.status === "pending" ? (
                                <>
                                  <button disabled={!request.ground_id} onClick={() => rejectCorporate(request.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200 disabled:opacity-50">Reject</button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeSection === "refunds" ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xl font-black">Refunds</h3>
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-3 pr-4">Booking</th>
                        <th className="py-3 pr-4">Customer</th>
                        <th className="py-3 pr-4">Branch</th>
                        <th className="py-3 pr-4">Reason</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cancelRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="py-4 pr-4">#{request.booking_id}</td>
                          <td className="py-4 pr-4">{request.customer_name}<p className="text-slate-500">{request.phone}</p></td>
                          <td className="py-4 pr-4">{request.branch_name}</td>
                          <td className="py-4 pr-4">{request.reason}</td>
                          <td className="py-4 pr-4"><span className={`rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${statusStyle[request.status] || "bg-slate-100 text-slate-700"}`}>{request.status}</span></td>
                          <td className="py-4 pr-4">
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => updateRefundStatus(request.id, "approved")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Approve</button>
                              <button onClick={() => updateRefundStatus(request.id, "rejected")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeSection === "analytics" ? (
              <section className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {analyticsCards.slice(0, 4).map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-sm font-semibold text-slate-500">{label}</p>
                      <p className="mt-2 text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black">Popular Grounds</h3>
                    <div className="mt-4 space-y-3">
                      {Object.values(bookings.reduce((acc, booking) => {
                        const key = `${booking.branch_name} / ${booking.ground_name}`;
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                      }, {})).length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : null}
                      {Object.entries(bookings.reduce((acc, booking) => {
                        const key = `${booking.branch_name} / ${booking.ground_name}`;
                        acc[key] = (acc[key] || 0) + 1;
                        return acc;
                      }, {})).slice(0, 6).map(([label, count]) => (
                        <div key={label} className="rounded-xl border border-slate-200 p-3 flex justify-between">
                          <span>{label}</span>
                          <span className="font-black">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black">Corporate Summary</h3>
                    <div className="mt-4 space-y-2 text-sm">
                      <p>Total corporate requests: <span className="font-bold">{corporateRequests.length}</span></p>
                      <p>Pending: <span className="font-bold">{pendingCorporate.length}</span></p>
                      <p>Approved: <span className="font-bold">{corporateRequests.filter((request) => request.status === "approved").length}</span></p>
                      <p>Rejected: <span className="font-bold">{corporateRequests.filter((request) => request.status === "rejected").length}</span></p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

          </div>
        </main>
      </div>

      {selectedCorporateRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Corporate review</p>
                <h3 className="mt-1 text-2xl font-black">{selectedCorporateRequest.company_name}</h3>
              </div>
              <button onClick={() => { setSelectedCorporateRequest(null); setRequestAvailability(null); }} className="rounded-full bg-slate-100 px-3 py-1 text-xl font-black">X</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Contact Person", selectedCorporateRequest.contact_person],
                ["Email", selectedCorporateRequest.email],
                ["Phone", selectedCorporateRequest.phone],
                ["Event Type", selectedCorporateRequest.event_type],
                ["Employee Count", selectedCorporateRequest.employee_count],
                ["Branch", selectedCorporateRequest.branch_name],
                ["Date", new Date(selectedCorporateRequest.event_date).toLocaleDateString("en-GB")],
                ["Time", requestAvailability?.request?.requested_time_label || selectedCorporateRequest.preferred_time],
                ["Requested Grounds", selectedCorporateRequest.grounds_required],
                ["Status", selectedCorporateRequest.status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 font-black">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-black">Ground Availability</h4>
                  <p className="text-sm text-slate-500">Select the ground to assign before approval.</p>
                </div>
                {reviewing ? <span className="text-sm font-bold text-slate-500">Loading...</span> : null}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {requestAvailability?.availableGrounds?.map((ground) => (
                  <button
                    key={ground.id}
                    onClick={() => setGroundSelection(String(ground.id))}
                    className={`rounded-2xl border px-4 py-4 text-left ${
                      groundSelection === String(ground.id)
                        ? "border-emerald-500 bg-emerald-50"
                        : ground.available
                          ? "border-slate-200 bg-white"
                          : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="font-black">{ground.ground_name}</p>
                    <p className={`mt-1 text-xs font-bold uppercase ${ground.available ? "text-emerald-700" : "text-red-700"}`}>
                      {ground.available ? "Available" : "Occupied"}
                    </p>
                    {ground.conflict ? (
                      <p className="mt-2 text-xs text-slate-600">#{ground.conflict.booking_id} - {ground.conflict.customer_name}</p>
                    ) : null}
                  </button>
                ))}
              </div>

              {requestAvailability?.error ? (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{requestAvailability.error}</p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={assignGround}
                disabled={reviewing || actionBusy === `corp-${selectedCorporateRequest.id}-ground`}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionBusy === `corp-${selectedCorporateRequest.id}-ground` ? "Saving..." : "Save Ground"}
              </button>
              <button
                type="button"
                onClick={approveCorporate}
                disabled={reviewing || actionBusy === `corp-${selectedCorporateRequest.id}-approve`}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionBusy === `corp-${selectedCorporateRequest.id}-approve` ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => rejectCorporate(selectedCorporateRequest.id)}
                disabled={reviewing || actionBusy === `corp-${selectedCorporateRequest.id}-reject`}
                className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionBusy === `corp-${selectedCorporateRequest.id}-reject` ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {conflictModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">Booking Conflict Detected</p>
            <h3 className="mt-2 text-2xl font-black">Requested slot is already occupied.</h3>
            <div className="mt-5 grid gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase text-slate-500">Booking ID</p><p className="mt-1 font-black">#{conflictModal.conflict.booking_id}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Customer</p><p className="mt-1 font-black">{conflictModal.conflict.customer_name}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Phone</p><p className="mt-1 font-black">{conflictModal.conflict.customer_phone}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Ground</p><p className="mt-1 font-black">{conflictModal.conflict.ground_name}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Date</p><p className="mt-1 font-black">{new Date(conflictModal.conflict.booking_date).toLocaleDateString("en-GB")}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Time</p><p className="mt-1 font-black">{conflictModal.conflict.booking_time}</p></div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => navigate(`/admin/bookings/${conflictModal.conflict.booking_id}`)} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">View Booking</button>
              <button
                type="button"
                onClick={() => rejectCorporate(conflictModal.requestId)}
                className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-700"
              >
                Reject Request
              </button>
              <button onClick={() => setConflictModal(null)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
