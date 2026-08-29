'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Email/password fields are non-functional placeholders per SPEC.md (Google OAuth is the primary auth flow)
    loginWithGoogle();
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Top Header Label (matches wireframe top banner) */}
      <div className="absolute top-4 left-4 text-xs font-semibold text-slate-400 tracking-wider uppercase">
        Login Screen
      </div>

      {/* Centered White Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-slate-800 text-center tracking-tight">
          Login
        </h1>

        {/* 1. Login with Google Button (Light Green Background, Rounded) */}
        <button
          onClick={loginWithGoogle}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-[#eaf7ee] hover:bg-[#dcf2e3] border border-emerald-100 text-slate-700 text-sm font-medium transition duration-150 shadow-sm"
        >
          {/* Google "G" Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Login with Google
        </button>

        {/* 2. Divider Line with Text */}
        <div className="relative flex items-center my-4">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="mx-4 flex-shrink-0 text-xs text-slate-400 font-normal">
            or sign up through email
          </span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        {/* 3. Form Fields */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* 4. Solid Green Full-Width Button */}
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-[#00a854] hover:bg-[#009249] text-white text-sm font-semibold transition duration-150 shadow-md shadow-emerald-600/20"
          >
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
