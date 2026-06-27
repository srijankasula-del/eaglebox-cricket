import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../lib/api";

const statusStyle = {
  confirmed: "bg-emerald-50 text-emerald-800",
  completed: "bg-blue-50 text-blue-800",
  pending: "bg-amber-50 text-amber-800",
  cancelled: "bg-red-50 text-red-800",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [cancelRequests, setCancelRequests] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const metrics = useMemo(() => {
    const paidRevenue = bookings.reduce(
      (sum, booking) => booking.payment_status === "paid" ? sum + Number(booking.amount || 0) : sum,
      0
    );
    const averageRating = feedback.length
      ? (feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length).toFixed(1)
      : "0.0";

    return {
      users: users.length,
      bookings: bookings.length,
      confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
      completed: bookings.filter((booking) => booking.status === "completed").length,
      revenue: paidRevenue,
      rating: averageRating,
    };
  }, [bookings, feedback, users]);

  const filteredBookings = statusFilter === "all"
    ? bookings
    : bookings.filter((booking) => booking.status === statusFilter);

  const fetchData = useCallback(async ({ showRefresh = false } = {}) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
        setMessage("");
      }
      const authHeaders = {
        Authorization: `Bearer ${token}`,
      };
      const [bookingsResponse, usersResponse, requestsResponse, feedbackResponse] = await Promise.all([
        axios.get(`${API_URL}/api/bookings`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/auth/users`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/cancellation-requests`, { headers: authHeaders }),
        axios.get(`${API_URL}/api/feedback`, { headers: authHeaders }),
      ]);

      setBookings(bookingsResponse.data || []);
      setUsers(usersResponse.data || []);
      setCancelRequests(requestsResponse.data || []);
      setFeedback(feedbackResponse.data || []);
      if (showRefresh) {
        setMessage("Dashboard refreshed.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Could not load admin data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (active) {
        await fetchData();
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchData]);

  const updateStatus = async (bookingId, status) => {
    try {
      await axios.patch(
        `${API_URL}/api/bookings/${bookingId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Booking #${bookingId} marked ${status}.`);
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage("Failed to update booking status.");
    }
  };

  const updateCancellationRequestStatus = async (requestId, status) => {
    try {
      await axios.patch(
        `${API_URL}/api/cancellation-requests/${requestId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Cancellation request ${status}.`);
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage("Failed to update cancellation request.");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/admin");
  };

  return (
    <div className="min-h-screen bg-[#f6f8f4] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Eagle Box operations</p>
            <h1 className="mt-1 text-3xl font-black">Admin dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchData({ showRefresh: true })}
              disabled={refreshing}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button onClick={logout} className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {message ? (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}

        {refreshing ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
            Refreshing statistics, bookings, cancellation requests, feedback and users...
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Users", metrics.users],
            ["Bookings", metrics.bookings],
            ["Confirmed", metrics.confirmed],
            ["Completed", metrics.completed],
            ["Revenue", `Rs. ${metrics.revenue.toLocaleString("en-IN")}`],
            ["Avg rating", metrics.rating],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Cancellation queue</h2>
                <p className="mt-1 text-sm text-slate-500">Pending refund decisions.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-800">{cancelRequests.length}</span>
            </div>

            <div className="mt-5 space-y-3">
              {cancelRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No pending cancellation requests.</div>
              ) : (
                cancelRequests.map((request) => (
                  <article key={request.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">Booking #{request.booking_id}</p>
                        <p className="mt-1 text-sm text-slate-700">{request.customer_name} - {request.branch_name}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{request.reason}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button onClick={() => updateCancellationRequestStatus(request.id, "approved")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">
                        Approve refund
                      </button>
                      <button onClick={() => updateCancellationRequestStatus(request.id, "rejected")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-red-700 ring-1 ring-red-200">
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Bookings</h2>
                <p className="mt-1 text-sm text-slate-500">Manage match status and inspect booking details.</p>
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="mt-5 -mx-5 overflow-x-auto px-5">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
                </div>
              ) : (
                <table className="min-w-[720px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-3 pr-4">Customer</th>
                      <th className="py-3 pr-4">Slot</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.map((booking) => {
                      const locked = booking.status === "cancelled" || booking.status === "completed";
                      return (
                        <tr key={booking.id}>
                          <td className="py-4 pr-4 align-top">
                            <p className="font-black">{booking.customer_name}</p>
                            <p className="mt-1 text-slate-500">{booking.phone}</p>
                            <p className="mt-1 max-w-[180px] break-words text-slate-500">{booking.branch_name}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <p className="font-semibold">{booking.ground_name}</p>
                            <p className="mt-1 text-slate-500">{new Date(booking.booking_date).toLocaleDateString()}</p>
                            <p className="mt-1 text-slate-500">{booking.start_time} to {booking.end_time}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusStyle[booking.status] || "bg-slate-100 text-slate-700"}`}>
                              {booking.status}
                            </span>
                            <p className="mt-2 text-xs font-semibold text-slate-500">{booking.payment_status}</p>
                          </td>
                          <td className="py-4 pr-4 align-top">
                            <div className="flex min-w-[220px] flex-wrap gap-2">
                              <button disabled={locked} onClick={() => updateStatus(booking.id, "completed")} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400">
                                Complete
                              </button>
                              <button disabled={locked} onClick={() => updateStatus(booking.id, "cancelled")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400">
                                Cancel
                              </button>
                              <button onClick={() => setSelectedBooking(booking)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Registered users</h2>
            <div className="mt-5 divide-y divide-slate-100">
              {users.slice(0, 8).map((user) => (
                <div key={user.id} className="py-3">
                  <p className="font-black">{user.full_name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Customer feedback</h2>
            <div className="mt-5 space-y-3">
              {feedback.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No feedback yet.</div>
              ) : (
                feedback.slice(0, 6).map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-black">{item.full_name}</p>
                        <p className="text-sm text-slate-500">{item.branch_name} - {item.ground_name}</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-800">{item.rating}/5</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{item.review}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {selectedBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Booking details</p>
                <h2 className="mt-2 break-words text-2xl font-black">#{selectedBooking.id} - {selectedBooking.customer_name}</h2>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="rounded-full bg-slate-100 px-3 py-1 text-xl font-black">X</button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Phone", selectedBooking.phone],
                ["Branch", selectedBooking.branch_name],
                ["Ground", selectedBooking.ground_name],
                ["Date", new Date(selectedBooking.booking_date).toLocaleDateString()],
                ["Time", `${selectedBooking.start_time} to ${selectedBooking.end_time}`],
                ["Payment", selectedBooking.payment_status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 break-words font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
