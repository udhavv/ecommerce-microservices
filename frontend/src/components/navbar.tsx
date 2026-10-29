'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon, Shield, ShoppingBag, Store } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, isInitialLoading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-slate-900 group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 transition-transform group-hover:scale-105">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="leading-tight text-slate-900 font-extrabold tracking-tight">CloudStore</span>
            <span className="text-[10px] font-medium tracking-wider uppercase text-indigo-600">Microservices</span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="flex items-center gap-3">
          {isInitialLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200/70" />
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/profile"
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:border-slate-300"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 text-xs shadow-xs">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="h-3.5 w-3.5" />}
                </div>
                <span className="hidden sm:inline font-semibold text-slate-800">{user.displayName}</span>
                {user.roles?.includes('seller') && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 border border-indigo-200">
                    <Store className="h-3 w-3" /> Seller
                  </span>
                )}
                {user.roles?.includes('admin') && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                    <Shield className="h-3 w-3" /> Admin
                  </span>
                )}
              </Link>

              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-red-50 hover:border-red-200 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-indigo-600 hover:bg-indigo-50/60"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Sign Up
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
