import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

const statusClass = {
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-blue-50 text-blue-800 ring-blue-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  cancelled: "bg-red-50 text-red-800 ring-red-200",
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => booking.status === "confirmed" || booking.status === "pending"),
    [bookings]
  );

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${BACKEND_URL}/api/my-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBookings(response.data || []);
      } catch (error) {
        console.error(error);
        setMessage("We could not load your bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  const submitFeedback = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${BACKEND_URL}/api/feedback`,
        { bookingId: selectedBooking.id, rating, review },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("Thanks. Your feedback has been recorded.");
      setShowFeedbackModal(false);
      setSelectedBooking(null);
      setRating(5);
      setReview("");
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || "Failed to submit feedback.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f4] text-slate-950">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Player dashboard</p>
              <h1 className="mt-3 text-3xl font-black sm:text-5xl">Welcome, {user.full_name || "Player"}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Your upcoming matches, completed bookings, cancellations and feedback are all in one place.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400"
            >
              Book another slot
            </button>
          </div>
        </section>

        {message ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">Upcoming</p>
            <p className="mt-2 text-3xl font-black">{upcomingBookings.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">Total bookings</p>
            <p className="mt-2 text-3xl font-black">{bookings.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-black">{bookings.filter((booking) => booking.status === "completed").length}</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-black">My bookings</h2>
              <p className="mt-1 text-sm text-slate-500">Track status, payment and post-game feedback.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              [1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-2xl border border-slate-200 p-5">
                  <div className="h-5 w-1/3 rounded bg-slate-200" />
                  <div className="mt-4 h-4 w-2/3 rounded bg-slate-200" />
                  <div className="mt-5 h-10 rounded bg-slate-200" />
                </div>
              ))
            ) : bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <h3 className="text-xl font-black">No bookings yet</h3>
                <p className="mt-2 text-sm text-slate-500">Choose a branch and your first slot will appear here.</p>
                <button onClick={() => navigate("/")} className="mt-5 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">
                  Find a venue
                </button>
              </div>
            ) : (
              bookings.map((booking) => (
                <article key={booking.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-xl font-black">{booking.ground_name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusClass[booking.status] || "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                          {booking.status}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-sm font-semibold text-slate-500">{booking.branch_name}</p>
                      <p className="mt-3 text-sm text-slate-700">
                        {new Date(booking.booking_date).toLocaleDateString()} - {booking.start_time} to {booking.end_time}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        Payment: <span className={booking.payment_status === "refunded" ? "text-red-700" : "text-emerald-700"}>{booking.payment_status}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {booking.status === "confirmed" ? (
                        <button
                          onClick={() => navigate(`/cancel-request/${booking.id}`)}
                          className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
                        >
                          Request cancellation
                        </button>
                      ) : null}
                      {booking.status === "completed" && !booking.feedback_submitted ? (
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowFeedbackModal(true);
                          }}
                          className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
                        >
                          Give feedback
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <Footer />

      {showFeedbackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <h2 className="text-2xl font-black">Rate your experience</h2>
            <p className="mt-2 text-sm text-slate-500">{selectedBooking?.branch_name} - {selectedBooking?.ground_name}</p>

            <label className="mt-5 block text-sm font-bold text-slate-700">Rating</label>
            <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
              <option value={5}>5 - Excellent</option>
              <option value={4}>4 - Good</option>
              <option value={3}>3 - Okay</option>
              <option value={2}>2 - Poor</option>
              <option value={1}>1 - Bad</option>
            </select>

            <label className="mt-5 block text-sm font-bold text-slate-700">Review</label>
            <textarea
              rows={5}
              value={review}
              onChange={(event) => setReview(event.target.value)}
              placeholder="Share what went well or what should improve."
              className="mt-2 w-full rounded-xl border border-slate-200 p-3"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setShowFeedbackModal(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold">
                Cancel
              </button>
              <button onClick={submitFeedback} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">
                Submit feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
