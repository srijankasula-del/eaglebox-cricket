import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from "@react-oauth/google";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'http://127.0.0.1:5000';

export default function Signup() {
  const navigate = useNavigate();
const handleGoogleSignup = async (credentialResponse) => {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/auth/google`,
      {
        credential: credentialResponse.credential,
      }
    );

    localStorage.setItem(
      "token",
      response.data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(response.data.user)
    );

    navigate("/dashboard");
  } catch {
    setMessage("Google signup failed.");
  }
};

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage('');

    try {
      await axios.post(
        `${BACKEND_URL}/api/auth/signup`,
        formData
      );

      setMessage('Account created successfully.');

      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      setMessage(
        error?.response?.data?.error ||
        'Signup failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08111F] px-4 py-8 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            to="/"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-3xl font-semibold">
            Create Account
          </h1>

          <p className="mt-2 text-slate-500">
            Create your account and start booking cricket slots.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >
            <input
              type="text"
              name="full_name"
              placeholder="Full Name"
              required
              value={formData.full_name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-emerald-600"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-emerald-600"
            />

            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-emerald-600"
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none focus:border-emerald-600"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-700 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-sm">
              {message}
            </p>
          )}
          <div className="my-8 flex items-center gap-4">
  <div className="h-px flex-1 bg-slate-200" />
  <span className="text-sm text-slate-400">
    OR
  </span>
  <div className="h-px flex-1 bg-slate-200" />
</div>

<div className="flex justify-center">
  <GoogleLogin
    onSuccess={handleGoogleSignup}
    onError={() =>
      setMessage("Google signup failed.")
    }
  />
</div>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-emerald-700 font-semibold"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
