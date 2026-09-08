"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [officerId, setOfficerId] = useState("GCC-CMD-409");
  const [passcode, setPasscode] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState<number | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if already authenticated via server session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {
        // Unauthenticated fallback
      });
  }, [router]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutCountdown === null || lockoutCountdown <= 0) return;
    const interval = setInterval(() => {
      setLockoutCountdown((cur) => {
        if (cur === null || cur <= 1) {
          setIsLockedOut(false);
          return null;
        }
        return cur - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutCountdown]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (loading || isLockedOut) return;

    setLoading(true);
    setError("");

    // Fallback safety timeout: never leave button in permanent loading state
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError("Authentication request timed out. Please verify your network and retry.");
    }, 8000);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: officerId.trim(),
          password: passcode,
          twoFactorCode: twoFactorCode.trim() || undefined,
        }),
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const data = await response.json();

      if (response.ok && data.success) {
        // Session cookie is automatically stored as HttpOnly by browser
        router.push("/dashboard");
      } else {
        setError(data.error || "Authentication failed. Access denied.");
        if (data.locked) {
          setIsLockedOut(true);
          setLockoutCountdown(data.retryAfterSeconds || 900);
        }
        setLoading(false);
      }
    } catch {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setError("Network or server connection error. Please try again.");
      setLoading(false);
    }
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
            Official Command Operations
          </h1>
          <p className="mt-2 text-xs leading-5 text-[#9aabc1]">
            Authorized personnel only. Restrict access to emergency evacuation coordinators, decision-twin operators, and rescue dispatchers.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          <div>
            <label htmlFor="officer-id-input" className="block text-xs font-medium text-[#b6c4d5]">
              Officer / Station ID
            </label>
            <input
              id="officer-id-input"
              type="text"
              value={officerId}
              onChange={(e) => setOfficerId(e.target.value)}
              required
              aria-label="Officer or Station ID"
              autoComplete="username"
              className="mt-1.5 w-full rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-3 font-mono text-sm text-[#e6edf7] outline-none transition-colors focus:border-[#39d4b4] focus:ring-2 focus:ring-[#39d4b4]/20"
            />
          </div>

          <div>
            <label htmlFor="passcode-input" className="block text-xs font-medium text-[#b6c4d5]">
              Authorization Passcode
            </label>
            <input
              id="passcode-input"
              type="password"
              placeholder="Enter secure admin passcode…"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              required
              aria-label="Admin Authorization Passcode"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-3 text-sm text-[#e6edf7] outline-none transition-colors focus:border-[#39d4b4] focus:ring-2 focus:ring-[#39d4b4]/20"
            />
          </div>

          {/* Optional Two-Factor Authentication Expandable Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTwoFactor(!showTwoFactor)}
              className="text-[11px] font-semibold text-[#69e8d1] hover:underline focus:outline-none"
            >
              {showTwoFactor ? "− Hide Two-Factor Authentication" : "+ Enter Two-Factor Code (Optional/Emergency)"}
            </button>

            {showTwoFactor && (
              <div className="mt-2 animate-fadeIn">
                <label htmlFor="2fa-code-input" className="block text-xs font-medium text-[#b6c4d5]">
                  Two-Factor Authentication Code / Emergency OTP
                </label>
                <input
                  id="2fa-code-input"
                  type="text"
                  placeholder="e.g. ASTRA-XXXXXX or 6-digit OTP"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  aria-label="Two-Factor Authentication Code"
                  className="mt-1.5 w-full rounded-xl border border-[#39506e] bg-[#07111f] px-4 py-2.5 font-mono text-sm text-[#e6edf7] outline-none transition-colors focus:border-[#39d4b4] focus:ring-2 focus:ring-[#39d4b4]/20"
                />
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200"
            >
              <div className="flex items-center gap-2 font-semibold text-red-300">
                <span>⚠️</span>
                <span>Security Notice:</span>
              </div>
              <p className="mt-1">{error}</p>
              {lockoutCountdown !== null && lockoutCountdown > 0 && (
                <p className="mt-1 font-mono text-[11px] text-amber-300">
                  Rate-limit active: Retry available in {lockoutCountdown}s
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode.trim() || isLockedOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#39d4b4] to-[#2db397] py-3.5 text-sm font-bold text-[#062019] shadow-xl shadow-[#39d4b4]/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#39d4b4]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#062019] border-t-transparent" />
                <span>Verifying Authorization…</span>
              </span>
            ) : isLockedOut ? (
              `Temporarily Locked (${lockoutCountdown ?? 0}s)`
            ) : (
              "Authorize & Enter Command Center →"
            )}
          </button>
        </form>

        <div className="rounded-xl border border-[#23354d] bg-[#07111f]/60 p-3 text-center text-[11px] text-[#6f839b]">
          🔒 Unauthorized access attempts are monitored, logged, and rate-limited under National Disaster Management protocols.
        </div>
      </div>
    </main>
  );
}
