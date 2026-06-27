import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function CancelRequest() {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

 const handleSubmit = async (e) => {
  e.preventDefault();

  if (!reason.trim()) {
    alert("Please enter a cancellation reason");
    return;
  }

  try {
    setLoading(true);

    const token = localStorage.getItem("token");

    const response = await fetch(
  `${BACKEND_URL}/api/cancellation-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: Number(bookingId),
          reason,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to submit request");
    }

    navigate("/dashboard");

  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 py-8"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1600')",
      }}
    >
      <div className="absolute inset-0 bg-black/75"></div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">

          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
              Booking Cancellation
            </p>

            <h1 className="mt-3 text-3xl font-black text-slate-950">
              Request cancellation
            </h1>

            <p className="mt-3 text-slate-500">
              Booking ID: #{bookingId}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="mb-3 block font-bold text-slate-800">
              Reason for Cancellation
            </label>

            <textarea
              rows="6"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you want to cancel this booking..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="mt-8 flex gap-4">

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 rounded-xl border border-slate-200 py-4 font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-red-700 py-4 font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
