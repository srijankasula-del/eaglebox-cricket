import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-slate-600 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
        <div>
          <div className="text-lg font-black text-slate-950">Eagle Box Cricket</div>
          <p className="mt-3 max-w-md leading-6">
            Book cricket venues across Hyderabad with clear slots, simple confirmations, and a dashboard that keeps every match organized.
          </p>
        </div>
        <div>
          <div className="font-bold text-slate-950">Book</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link to="/" className="hover:text-emerald-700">Find a branch</Link>
            <Link to="/book" className="hover:text-emerald-700">Check availability</Link>
            <Link to="/dashboard" className="hover:text-emerald-700">My bookings</Link>
          </div>
        </div>
        <div>
          <div className="font-bold text-slate-950">Support</div>
          <div className="mt-3 space-y-2">
            <p>hello@eagleboxcricket.com</p>
            <p>+91 98765 43210</p>
            <p>Hyderabad, Telangana</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
