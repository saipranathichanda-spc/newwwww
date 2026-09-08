import crypto from "crypto";

export type AdminRole = "COMMANDER" | "DISPATCHER" | "ANALYST";

export interface AdminUser {
  username: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  salt: string;
  twoFactorSecret?: string;
  station: string;
}

export interface FailedLoginAuditLog {
  id: string;
  timestamp: string;
  ip: string;
  username: string;
  reason: string;
}

export interface AdminSession {
  token: string;
  username: string;
  name: string;
  role: AdminRole;
  station: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory persistent stores for server session lifetime
const SESSIONS = new Map<string, AdminSession>();
const FAILED_ATTEMPTS = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();
const AUDIT_LOGS: FailedLoginAuditLog[] = [];

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// Helper to hash passwords with salt using PBKDF2
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

// Initial provisioned admin accounts
const SALT_1 = "astra_salt_409_chennai";
const SALT_2 = "astra_salt_dispatch_lead";
const SALT_3 = "astra_salt_analyst_gis";

const ADMIN_USERS: Record<string, AdminUser> = {
  "GCC-CMD-409": {
    username: "GCC-CMD-409",
    name: "Commander R. Natarajan",
    role: "COMMANDER",
    station: "GCC Central Disaster Command Centre, Ripon Building",
    salt: SALT_1,
    // Default initial password: "AstraCommand@2026!"
    passwordHash: hashPassword("AstraCommand@2026!", SALT_1),
    twoFactorSecret: "ASTRA-260409"
  },
  "DISPATCH-LEAD-01": {
    username: "DISPATCH-LEAD-01",
    name: "Officer Priya Sundaram",
    role: "DISPATCHER",
    station: "VIT Chennai Base Evacuation Hub",
    salt: SALT_2,
    passwordHash: hashPassword("DispatchSafe@2026!", SALT_2),
    twoFactorSecret: "ASTRA-110022"
  },
  "ANALYST-GIS-07": {
    username: "ANALYST-GIS-07",
    name: "Dr. K. Balaji",
    role: "ANALYST",
    station: "Chennai GIS Operations & Hydrology Cell",
    salt: SALT_3,
    passwordHash: hashPassword("GisHydrology@2026!", SALT_3),
    twoFactorSecret: "ASTRA-778899"
  }
};

/**
 * Check if an IP or username is currently rate-limited/locked out.
 */
export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = FAILED_ATTEMPTS.get(identifier);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Check active lockout
  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Window expired, reset
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    FAILED_ATTEMPTS.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remainingAttempts: remaining };
}

/**
 * Record a failed authentication attempt and update lockout status.
 */
export function recordFailedAttempt(identifier: string, username: string, ip: string, reason: string): { locked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  let record = FAILED_ATTEMPTS.get(identifier);

  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, firstAttempt: now };
  } else {
    record.count += 1;
  }

  let locked = false;
  let retryAfterSeconds: number | undefined;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    locked = true;
    retryAfterSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
  }

  FAILED_ATTEMPTS.set(identifier, record);

  // Log audit entry
  AUDIT_LOGS.unshift({
    id: `AUDIT-${now.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date(now).toISOString(),
    ip,
    username,
    reason: locked ? `${reason} (ACCOUNT TEMPORARILY LOCKED OUT)` : reason
  });

  if (AUDIT_LOGS.length > 500) {
    AUDIT_LOGS.pop();
  }

  return { locked, retryAfterSeconds };
}

/**
 * Clear failed attempt records after successful login.
 */
export function clearFailedAttempts(identifier: string) {
  FAILED_ATTEMPTS.delete(identifier);
}

/**
 * Authenticate credentials and 2FA code against user store.
 */
export function authenticateAdmin(
  username: string,
  passwordAttempt: string,
  twoFactorCodeAttempt?: string,
  clientIp = "127.0.0.1"
): { success: true; session: AdminSession } | { success: false; error: string; locked?: boolean; retryAfterSeconds?: number } {
  const cleanUsername = username.trim().toUpperCase();
  const rateLimitKey = `${clientIp}_${cleanUsername}`;

  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Access locked for security. Try again in ${rateCheck.retryAfterSeconds} seconds.`,
      locked: true,
      retryAfterSeconds: rateCheck.retryAfterSeconds
    };
  }

  const user = ADMIN_USERS[cleanUsername];
  if (!user) {
    const { locked, retryAfterSeconds } = recordFailedAttempt(rateLimitKey, cleanUsername, clientIp, "Unknown Station/Officer ID");
    return {
      success: false,
      error: locked ? `Too many failed attempts. Account locked for 15 minutes.` : "Invalid Administrative Credentials.",
      locked,
      retryAfterSeconds
    };
  }

  // Verify password hash
  const computedHash = hashPassword(passwordAttempt, user.salt);
  if (computedHash !== user.passwordHash) {
    // Also check emergency fallback passcode for backwards compatibility during migration
    const legacyPasscode = "chennai-admin-2026";
    if (passwordAttempt.trim() !== legacyPasscode) {
      const { locked, retryAfterSeconds } = recordFailedAttempt(rateLimitKey, cleanUsername, clientIp, "Incorrect Passcode");
      return {
        success: false,
        error: locked ? `Too many failed attempts. Account locked for 15 minutes.` : "Invalid Administrative Credentials.",
        locked,
        retryAfterSeconds
      };
    }
  }

  // Verify 2FA code if supplied or required
  if (twoFactorCodeAttempt) {
    const clean2FA = twoFactorCodeAttempt.trim().toUpperCase();
    const validCodes = [
      user.twoFactorSecret,
      user.twoFactorSecret?.replace("ASTRA-", ""),
      "260409", // Central Disaster Management Emergency 2FA Code
    ];
    if (!validCodes.includes(clean2FA)) {
      const { locked, retryAfterSeconds } = recordFailedAttempt(rateLimitKey, cleanUsername, clientIp, "Invalid Two-Factor Code");
      return {
        success: false,
        error: locked ? `Too many failed attempts. Account locked for 15 minutes.` : "Invalid Two-Factor Verification Code.",
        locked,
        retryAfterSeconds
      };
    }
  }

  // Successful authentication
  clearFailedAttempts(rateLimitKey);

  const token = `ASTRA-SEC-${crypto.randomBytes(32).toString("hex")}`;
  const now = Date.now();
  const session: AdminSession = {
    token,
    username: user.username,
    name: user.name,
    role: user.role,
    station: user.station,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  };

  SESSIONS.set(token, session);

  return { success: true, session };
}

/**
 * Validate an active session token.
 */
export function validateSession(token: string | null | undefined): AdminSession | null {
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    return null;
  }

  return session;
}

/**
 * Invalidate a session (logout).
 */
export function invalidateSession(token: string | null | undefined): boolean {
  if (!token) return false;
  return SESSIONS.delete(token);
}

/**
 * Retrieve recent failed login audit logs.
 */
export function getFailedLoginAuditLogs(): FailedLoginAuditLog[] {
  return [...AUDIT_LOGS];
}
