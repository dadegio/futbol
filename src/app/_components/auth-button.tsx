"use client";

import { useRouter } from "next/navigation";
import { LogIn, LogOut, Shield, User } from "lucide-react";
import { useAuth, clearAuthToken } from "@/lib/client-auth";

export default function AuthButton() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--foreground)] transition"
      >
        <LogIn size={18} className="opacity-80" />
        <span className="text-[15px] font-medium">Accedi</span>
      </button>
    );
  }

  async function handleLogout() {
    clearAuthToken();
    await refresh();
    router.push("/");
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-1">
      {/* User info pill */}
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--card-2)] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10">
          {isAdmin ? (
            <Shield size={14} className="text-[var(--accent)]" />
          ) : (
            <User size={14} className="text-[var(--accent)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--foreground)]">
            {user.username}
          </div>
          <div className="text-[10px] font-medium text-[var(--muted)]">
            {isAdmin ? "Admin" : "Capitano"}
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600 transition"
      >
        <LogOut size={16} className="opacity-80" />
        <span className="text-[14px] font-medium">Esci</span>
      </button>
    </div>
  );
}
