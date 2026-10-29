'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/auth/protected-route';
import { useAuth } from '@/hooks/use-auth';
import {
  User as UserIcon,
  Shield,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Fingerprint,
  Mail,
  Sparkles,
  Store,
  ArrowRight,
  PackagePlus,
} from 'lucide-react';

function ProfileContent() {
  const { user, logout, refreshSession, becomeSeller } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) return null;

  const isSeller = user.roles && user.roles.includes('seller');
  const isAdmin = user.roles && user.roles.includes('admin');

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      setStatusMessage(null);
      await refreshSession();
      setStatusMessage({ type: 'success', text: 'Session token refreshed successfully via Redux!' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to refresh session.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleBecomeSeller = async () => {
    try {
      setUpgrading(true);
      setStatusMessage(null);
      await becomeSeller();
      setStatusMessage({
        type: 'success',
        text: 'Congratulations! Your account has been upgraded to Seller. You can now list and manage products!',
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upgrade to seller.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 bg-slate-50 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Account Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            User Profile
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your credentials, roles, and seller privileges
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Session</span>
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Dynamic Status Alert */}
      {statusMessage && (
        <div
          className={`rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
        {/* Colorful Gradient Header */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative" />

        <div className="px-6 sm:px-8 pb-8 pt-0 relative">
          {/* Avatar & Status Row */}
          <div className="-mt-14 mb-6 flex items-end justify-between">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <span className="text-3xl font-extrabold">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isSeller && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Store className="h-3 w-3" /> Seller
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border ${
                  user.status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    user.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                Status: {user.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              {user.displayName}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <Mail className="h-4 w-4 text-slate-400" />
              <span>{user.email}</span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* User ID */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <Fingerprint className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">User ID</p>
                <p className="mt-1 text-xs font-mono font-medium text-slate-900 truncate">
                  {user.id}
                </p>
              </div>
            </div>

            {/* Email Verification */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                {user.emailVerifiedAt ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Verification</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {user.emailVerifiedAt
                    ? `Verified (${new Date(user.emailVerifiedAt).toLocaleDateString()})`
                    : 'Pending Verification'}
                </p>
              </div>
            </div>

            {/* Roles */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned Roles</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200"
                      >
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">Standard User</span>
                  )}
                </div>
              </div>
            </div>

            {/* Created At */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Member Since</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Capabilities Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">Seller Program</h3>
            </div>
            <p className="text-sm text-slate-500">
              {isSeller
                ? 'Your account has full Seller privileges. You can list, price, update, and manage your product catalog.'
                : 'Want to sell on CloudStore? Upgrade your account to become an authorized Seller.'}
            </p>
          </div>

          <div>
            {isSeller ? (
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Seller Privileges Active</span>
              </div>
            ) : (
              <button
                onClick={handleBecomeSeller}
                disabled={upgrading || user.status !== 'active'}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 disabled:opacity-50"
              >
                {upgrading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    <span>Become a Seller</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
