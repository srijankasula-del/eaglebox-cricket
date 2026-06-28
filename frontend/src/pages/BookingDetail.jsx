import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import API_URL from "../lib/api";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/bookings/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBooking(response.data);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load booking details.");
      }
    };

    load();
  }, [id, token]);

  return (
    <div className="min-h-screen bg-[#f6f8f4] px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate(-1)} className="mb-6 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm">
          Back
        </button>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Booking detail</p>
          <h1 className="mt-2 text-3xl font-black">Booking #{id}</h1>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
          ) : null}

          {booking ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Booking ID", booking.id],
                ["Customer Name", booking.customer_name],
                ["Phone Number", booking.phone],
                ["Branch", booking.branch_name],
                ["Ground", booking.ground_name],
                ["Booking Date", booking.booking_date],
                ["Start Time", booking.start_time],
                ["End Time", booking.end_time],
                ["Amount", booking.amount],
                ["Status", booking.status],
                ["Payment Status", booking.payment_status],
                ["Created Date", booking.created_at],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 break-words font-black text-slate-950">{String(value ?? "-")}</p>
                </div>
              ))}
            </div>
          ) : !error ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Loading booking details...
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
