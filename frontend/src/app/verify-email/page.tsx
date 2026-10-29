'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { getErrorMessage } from '@/lib/axios';
import { CheckCircle, AlertCircle, ArrowRight, KeyRound, MailCheck } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyToken = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify) return;

    try {
      setLoading(true);
      setError(null);
      const res = await authService.verifyEmail({ token: tokenToVerify });
      setSuccess(true);
      setMessage(res.message || 'Email verified successfully! You can now log in.');
    } catch (err) {
      setSuccess(false);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tokenFromUrl) {
      verifyToken(tokenFromUrl);
    }
  }, [tokenFromUrl, verifyToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please provide a verification token.');
      return;
    }
    verifyToken(token.trim());
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 text-center shadow-xl shadow-slate-200/50">
        {loading ? (
          <div className="py-8 space-y-4">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent shadow-xs" />
            <h2 className="text-xl font-bold text-slate-900">
              Verifying your email...
            </h2>
            <p className="text-sm text-slate-500">
              Validating activation token with the Auth microservice.
            </p>
          </div>
        ) : success ? (
          <div className="space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-xs">
              <CheckCircle className="h-9 w-9" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Email Verified!
            </h2>
            <p className="text-sm text-slate-600">
              {message}
            </p>
            <Link
              href="/login?verified=true"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-4 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700"
            >
              <span>Proceed to Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
              <MailCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Verify Your Email
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {error
                  ? 'Verification failed. Please re-enter your verification token below.'
                  : 'Enter the verification token received in your confirmation email.'}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-4 border border-red-200 text-red-800 text-left">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Verification Token
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste verification token"
                    className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm font-mono text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-4 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-50"
              >
                <span>Verify Token</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="pt-2">
              <Link
                href="/login"
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition"
              >
                Back to Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
