import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function Navbar({ variant = "light" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isDark = variant === "dark";

  const bookPath = token ? "/book" : "/login";
  const dashboardPath = user.role === "admin" ? "/admin/dashboard" : "/dashboard";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setOpen(false);
    navigate("/");
  };

  const linkClass = isDark
    ? "text-slate-200 hover:text-white"
    : "text-slate-700 hover:text-slate-950";

  return (
    <header className={`sticky top-0 z-50 border-b ${isDark ? "border-white/10 bg-slate-950/88" : "border-slate-200 bg-white/92"} backdrop-blur-xl`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="min-w-0">
          <div className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
            Eagle Box Cricket
          </div>
          <div className={`text-xs font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
            Hyderabad cricket venue booking
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          <Link className={linkClass} to="/">Venues</Link>
          <Link className={linkClass} to={bookPath}>Book</Link>
          {token ? <Link className={linkClass} to={dashboardPath}>Dashboard</Link> : null}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {token ? (
            <>
              <Link to={dashboardPath} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${isDark ? "border-white/15 text-white" : "border-slate-200 text-slate-800"}`}>
                <UserCircleIcon className="h-5 w-5" />
                {user.full_name || "Account"}
              </Link>
              <button onClick={logout} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`rounded-full px-4 py-2 text-sm font-semibold ${linkClass}`}>Login</Link>
              <Link to="/signup" className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`rounded-full border p-2 md:hidden ${isDark ? "border-white/15 text-white" : "border-slate-200 text-slate-900"}`}
          aria-label="Toggle menu"
        >
          {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className={`border-t px-4 py-4 md:hidden ${isDark ? "border-white/10 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm font-semibold">
            <Link onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 hover:bg-slate-100 hover:text-slate-950" to="/">Venues</Link>
            <Link onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 hover:bg-slate-100 hover:text-slate-950" to={bookPath}>Book</Link>
            {token ? <Link onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 hover:bg-slate-100 hover:text-slate-950" to={dashboardPath}>Dashboard</Link> : null}
            {token ? (
              <button onClick={logout} className="mt-2 rounded-xl bg-slate-900 px-4 py-3 text-left text-white">Logout</button>
            ) : (
              <Link onClick={() => setOpen(false)} to="/login" className="mt-2 rounded-xl bg-emerald-700 px-4 py-3 text-white">Login with Google</Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
