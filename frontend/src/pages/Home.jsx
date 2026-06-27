import { useNavigate } from "react-router-dom";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { branches } from "../data/branches";

export default function Home() {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem("token"));

  const startBooking = (branch) => {
    navigate(isLoggedIn ? "/book" : "/login", {
      state: {
        branchId: branch.id,
        branchName: branch.name,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f8f4] text-slate-950">
      <Navbar />

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1800&auto=format&fit=crop"
              alt="Cricket venue"
              className="h-full w-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-slate-950/55" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-16 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:pt-24">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Cricket slots across Hyderabad
              </p>
              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
                Pick a branch, choose a slot, play cricket.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                Eagle Box makes venue booking feel direct: clear branches, live availability, instant confirmation, and a dashboard for every booking.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => startBooking(branches[0])}
                  className="rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-black text-slate-950 hover:bg-emerald-400"
                >
                  Check available slots
                </button>
                <a
                  href="#branches"
                  className="rounded-full border border-white/25 px-7 py-3.5 text-center text-sm font-bold text-white hover:bg-white/10"
                >
                  View branches
                </a>
              </div>
            </div>

            <div className="self-end rounded-2xl border border-white/15 bg-white/95 p-5 text-slate-950 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <CalendarDaysIcon className="h-6 w-6 text-emerald-700" />
                <div>
                  <p className="font-black">Today's booking flow</p>
                  <p className="text-sm text-slate-500">Branch, date, time, ground, confirmation.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {["Select your closest branch", "Check real-time slot availability", "Confirm under your account"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-700" />
                    <span className="font-semibold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="branches" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">Featured branches</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Where do you want to play?</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Choose the venue first. The booking page will carry your branch forward so you can move straight into date and time selection.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {branches.map((branch) => (
              <article key={branch.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={branch.image} alt={branch.title} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black">{branch.title}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <MapPinIcon className="h-4 w-4" />
                        {branch.location}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                      Open daily
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-50 p-4">
                    <p className="font-bold text-slate-900">{branch.surface}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{branch.note}</p>
                  </div>

                  <button
                    onClick={() => startBooking(branch)}
                    className="mt-5 w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800"
                  >
                    Book {branch.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
