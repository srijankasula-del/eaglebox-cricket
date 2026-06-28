import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import API_URL from "../lib/api";
import { branches } from "../data/branches";

const eventTypes = [
  "Team Outing",
  "Tournament",
  "Employee Engagement",
  "Practice Session",
];

const initialForm = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  employeeCount: "",
  eventType: "Team Outing",
  preferredBranchId: "",
  eventDate: "",
  preferredTime: "10:00 AM - 12:00 PM",
  groundsRequired: 1,
  additionalNotes: "",
};

export default function CorporateBooking() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!form.preferredBranchId && branches[0]) {
      setForm((prev) => ({ ...prev, preferredBranchId: String(branches[0].id) }));
    }
  }, [form.preferredBranchId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await axios.post(`${API_URL}/api/corporate-requests`, {
        company_name: form.companyName,
        contact_person: form.contactPerson,
        email: form.email,
        phone: form.phone,
        employee_count: Number(form.employeeCount),
        event_type: form.eventType,
        preferred_branch_id: Number(form.preferredBranchId),
        event_date: form.eventDate,
        preferred_time: form.preferredTime,
        grounds_required: Number(form.groundsRequired),
        additional_notes: form.additionalNotes,
      });

      setMessage("Corporate request submitted successfully. Our team can review it from the admin dashboard.");
      setForm(initialForm);
      if (branches[0]) {
        setForm((prev) => ({ ...prev, preferredBranchId: String(branches[0].id) }));
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8f4] text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-2xl shadow-slate-950/20">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Corporate booking</p>
          <h1 className="mt-3 text-4xl font-black">Request bulk cricket slots for your team</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Submit one simple request for outings, tournaments, employee engagement, or practice sessions. This keeps the process lightweight and PRD-aligned.
          </p>
        </section>

        {message ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-2">
          {[
            ["companyName", "Company Name", "text"],
            ["contactPerson", "Contact Person", "text"],
            ["email", "Email", "email"],
            ["phone", "Phone Number", "tel"],
            ["employeeCount", "Employee Count", "number"],
          ].map(([name, label, type]) => (
            <label key={name} className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Event Type</span>
            <select name="eventType" value={form.eventType} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600">
              {eventTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Preferred Branch</span>
            <select name="preferredBranchId" value={form.preferredBranchId} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600">
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Event Date</span>
            <input type="date" name="eventDate" value={form.eventDate} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Preferred Time</span>
            <input type="text" name="preferredTime" value={form.preferredTime} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Number of Grounds Required</span>
            <input type="number" min="1" name="groundsRequired" value={form.groundsRequired} onChange={handleChange} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600" />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-800">Additional Notes</span>
            <textarea name="additionalNotes" value={form.additionalNotes} onChange={handleChange} rows="4" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600" />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
            <button disabled={submitting} type="submit" className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Corporate Request"}
            </button>
            <button type="button" onClick={() => navigate("/")} className="rounded-full border border-slate-200 px-6 py-3 text-sm font-black text-slate-700">
              Back to home
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
