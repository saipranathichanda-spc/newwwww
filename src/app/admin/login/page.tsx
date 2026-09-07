"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_ADMIN_PASSCODE = "chennai-admin-2026";

export default function AdminLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [officerId, setOfficerId] = useState("GCC-CMD-409");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("astra_admin_token");
      if (token) {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (passcode.trim() === DEFAULT_ADMIN_PASSCODE) {
        const token = `AUTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6)}`;
        sessionStorage.setItem("astra_admin_token", token);
        sessionStorage.setItem("astra_admin_officer", officerId.trim() || "Incident Commander");
        // Also set cookie for persistence
        document.cookie = `astra_admin_auth=${token}; path=/; max-age=86400; SameSite=Lax`;
        router.push("/dashboard");
      } else {
        setError("Invalid Administrative Authorization Passcode. Access restricted to authorized disaster commanders.");
        setLoading(false);
      }
    }, 400);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_20%,#11314d_0,transparent_55%),#07111f] px-4 text-[#e6edf7]">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-[#2b4966] bg-[#0d1b2d] p-8 shadow-2xl shadow-black/70">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#39d4b4]/40 bg-[#113c3d] text-2xl shadow-lg shadow-[#39d4b4]/20">
            🛡️
          </div>
          <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-[#39d4b4]">
            GREATER CHENNAI DISASTER MANAGEMENT
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#e6edf7]">
            Admin Command Portal
          </h1>
          <p className="mt-2 text-xs leading-5 text-[#9aabc1]">
            Authorized personnel only. Restrict access to emergency evacuation coordinators, decision-twin operators, and rescue dispatchers.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-[#b6c4d5]">
              Officer / Station ID
            </label>
            <input
              type="text"
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-3 font-mono text-sm text-[#e6edf7] outline-none transition-colors focus:border-[#39d4b4]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#b6c4d5]">
                Authorization Passcode
              </label>
              <span className="text-[11px] text-[#39d4b4]/80">
                Default: chennai-admin-2026
              </span>
            </div>
            <input
              type="password"
              placeholder="Enter secure admin passcode…"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-3 text-sm text-[#e6edf7] outline-none transition-colors focus:border-[#39d4b4]"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] py-3.5 text-sm font-bold text-[#062019] shadow-xl shadow-[#39d4b4]/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Verifying Authorization…" : "Authorize & Enter Command Center →"}
          </button>
        </form>

        <div className="rounded-xl border border-[#23354d] bg-[#07111f]/60 p-3 text-center text-[11px] text-[#6f839b]">
          🔒 Unauthorized access attempts are monitored and recorded under National Disaster Management protocols.
        </div>
      </div>
    </main>
  );
}
