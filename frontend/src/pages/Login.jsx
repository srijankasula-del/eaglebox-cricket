import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        {
          email,
          password,
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

      if (response.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      setMessage(
        error?.response?.data?.error ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };
const handleGoogleSuccess = async (credentialResponse) => {
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

    if (response.data.user.role === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/dashboard");
    }
  } catch (error) {
    console.error(error);

    setMessage("Google login failed.");
  }
};

  return (
    <div className="min-h-screen bg-[#08111F]">

      <div className="grid min-h-screen lg:grid-cols-2">

        <div className="relative hidden overflow-hidden lg:flex">

          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-900 to-slate-950" />

          <div className="absolute inset-0 bg-black/35" />

          <div className="relative z-10 flex h-full flex-col justify-between p-16 text-white">

            <div>

              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm backdrop-blur-md">
                Eagle Box
              </span>

            </div>

            <div className="max-w-lg">

              <h1 className="text-6xl font-black leading-tight">
                Book.
                <br />
                Play.
                <br />
                Repeat.
              </h1>

              <p className="mt-8 text-lg text-slate-200 leading-8">
                Reserve premium indoor box cricket grounds
                across Hyderabad in just a few clicks.
              </p>

            </div>

          </div>

        </div>

        <div className="flex items-center justify-center px-4 py-8 sm:p-8">

          <motion.div
            initial={{
              opacity: 0,
              y: 30,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.45,
            }}
            className="w-full max-w-md"
          >

            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Home
            </Link>

            <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8 lg:p-10">

              <h2 className="text-4xl font-bold text-slate-900">
                Welcome Back
              </h2>

              <p className="mt-3 text-slate-500">
                Sign in to continue booking your next game.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
              >

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <div className="flex items-center rounded-2xl border border-slate-200 px-4 transition focus-within:border-emerald-600">

                    <EnvelopeIcon className="h-5 w-5 text-slate-400" />

                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder="Enter your email"
                      className="w-full bg-transparent px-3 py-4 outline-none"
                    />

                  </div>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>

                  <div className="flex items-center rounded-2xl border border-slate-200 px-4 transition focus-within:border-emerald-600">

                    <LockClosedIcon className="h-5 w-5 text-slate-400" />

                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter your password"
                      className="w-full bg-transparent px-3 py-4 outline-none"
                    />

                  </div>

                </div>
                                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-emerald-700 py-4 font-semibold text-white transition duration-200 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Signing In..." : "Sign In"}
                </button>

              </form>

              {message && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {message}
                </div>
              )}

              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-sm text-slate-400">
                  OR
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="flex justify-center overflow-hidden">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() =>
                    setMessage(
                      "Google Sign-In failed."
                    )
                  }
                  theme="outline"
                  shape="pill"
                  size="large"
                  width="330"
                />
              </div>

              <p className="mt-8 text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-emerald-700 transition hover:text-emerald-800"
                >
                  Create one
                </Link>
              </p>

            </div>

          </motion.div>

        </div>

      </div>

    </div>
  );
}
