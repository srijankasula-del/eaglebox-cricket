import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    'http://127.0.0.1:5000';

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        {
          email,
          password,
        }
      );

      const user = response.data.user;

      if (user.role !== 'admin') {
        setError('Access denied');
        return;
      }

      localStorage.setItem(
        'token',
        response.data.token
      );

      localStorage.setItem(
        'user',
        JSON.stringify(user)
      );

      navigate('/admin/dashboard');
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">

        <h1 className="text-3xl font-bold text-center">
          Admin Login
        </h1>

        <p className="mt-2 text-center text-slate-500">
          Eagle Box Cricket
        </p>

        <form
          onSubmit={handleLogin}
          className="mt-8 space-y-4"
        >

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full rounded-xl border p-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full rounded-xl border p-3"
          />

          {error && (
            <p className="text-red-600 text-sm">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-700 py-3 text-white font-medium hover:bg-emerald-800"
          >
            Login
          </button>

        </form>

      </div>

    </div>
  );
}
