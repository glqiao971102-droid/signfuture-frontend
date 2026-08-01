"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  api,
  ApiError,
  getToken,
  setToken,
  PASSWORD_RESET_REQUIRED,
  PROFESSIONS,
  type MemberProfile,
  type MemberTier,
} from "@/lib/api";

export type { MemberTier };

/**
 * The signed-in member, as returned by the backend from the legacy WordPress
 * tables. `tier` is null for a plain `customer` account (no membership role).
 */
export type Member = MemberProfile;

type AuthContextValue = {
  user: Member | null;
  /** True until the stored token has been checked on first load. */
  loading: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  /**
   * Demo-only, local-to-this-tab adjustment of the displayed balance, used by
   * the mock checkout flow. It does NOT write to the wallet — the backend is
   * read-only against the legacy WooWallet data. Calling refresh() (or a page
   * reload) restores the real balance from the server.
   */
  adjustWallet: (delta: number) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  // Referral code pulled from a ?ref=CODE link (e.g. a sales admin's QR code).
  const [pendingReferral, setPendingReferral] = useState<string | null>(null);

  // A ?ref=CODE in the URL (from a QR code / referral link) opens the register
  // modal with the code pre-filled.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) {
        setPendingReferral(ref.trim().toUpperCase());
        setOpen(true);
      }
    } catch {
      /* no-op */
    }
  }, []);

  // Restore the session from a stored token on first mount. Starting signed-out
  // keeps SSR and first paint consistent; the token check then fills the user in.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch (err) {
        // 401 means the token expired or was revoked — clear it. Any other
        // error (backend down) leaves the token alone so a refresh can recover.
        if (err instanceof ApiError && err.status === 401) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openLogin = useCallback(() => setOpen(true), []);
  const closeLogin = useCallback(() => setOpen(false), []);

  const login = useCallback(async (identifier: string, password: string) => {
    const me = await api.login(identifier, password);
    setUser(me);
    setOpen(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void api.logout();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      /* keep the current view; the next action will surface the error */
    }
  }, []);

  // See the doc comment on AuthContextValue.adjustWallet: display-only.
  const adjustWallet = useCallback((delta: number) => {
    setUser((u) =>
      u
        ? {
            ...u,
            wallet: {
              ...u.wallet,
              balance: Math.max(0, Math.round((u.wallet.balance + delta) * 100) / 100),
            },
          }
        : u,
    );
  }, []);

  const onAuthenticated = useCallback((me: Member) => {
    setUser(me);
    setOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, openLogin, closeLogin, login, logout, refresh, adjustWallet }}
    >
      {children}
      {open && (
        <LoginModal
          onClose={closeLogin}
          onAuthenticated={onAuthenticated}
          initialReferral={pendingReferral}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Minimum length the backend enforces — mirrored here for instant feedback. */
const MIN_PASSWORD = 8;

function LoginModal({
  onClose,
  onAuthenticated,
  initialReferral,
}: {
  onClose: () => void;
  onAuthenticated: (user: Member) => void;
  initialReferral?: string | null;
}) {
  // "signin" -> normal login. "reset" -> the member has never set a password on
  // the new site and must choose one before they can get in. "register" ->
  // brand-new customer creating an account. A referral link lands on register.
  const [step, setStep] = useState<"signin" | "reset" | "register">(
    initialReferral ? "register" : "signin",
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Register-only fields.
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regReferral, setRegReferral] = useState(initialReferral ?? "");
  const [regProfessions, setRegProfessions] = useState<string[]>([]);
  const [regOtp, setRegOtp] = useState("");

  const toggleProfession = (p: string) =>
    setRegProfessions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  // Register is two sub-steps: fill the form, then verify the emailed code.
  const [otpSent, setOtpSent] = useState(false);

  /** Step 1: validate the form, then email a verification code. */
  async function sendRegisterCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!regName.trim()) return setError("Please enter your name.");
    if (!regReferral.trim()) return setError("A referral code is required.");
    if (password.length < MIN_PASSWORD) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirmPassword) {
      return setError("The two passwords do not match.");
    }

    setBusy(true);
    try {
      await api.sendRegisterOtp(regEmail.trim());
      setOtpSent(true);
      setNotice(`We've sent a 6-digit code to ${regEmail.trim()}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not send the verification code.",
      );
    } finally {
      setBusy(false);
    }
  }

  /** Step 2: submit the code + form to create the account and sign in. */
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (regOtp.trim().length !== 6) {
      return setError("Enter the 6-digit code from your email.");
    }

    setBusy(true);
    try {
      onAuthenticated(
        await api.register({
          name: regName.trim(),
          email: regEmail.trim(),
          password,
          referralCode: regReferral.trim(),
          otp: regOtp.trim(),
          phone: regPhone.trim() || undefined,
          professions: regProfessions.length ? regProfessions : undefined,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      onAuthenticated(await api.login(identifier.trim(), password));
    } catch (err) {
      if (err instanceof ApiError && err.code === PASSWORD_RESET_REQUIRED) {
        // First sign-in since the migration — send them to the reset step
        // instead of showing a password error they could never get right.
        setNotice(err.message);
        setStep("reset");
        setPassword("");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (newPassword.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      onAuthenticated(await api.firstTimeReset(identifier.trim(), newPassword));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {step === "signin" && (
          <>
            <h2>Welcome back</h2>
            <p className="login-sub">Sign in to your Sign Future account</p>
            <form onSubmit={submitSignIn}>
              <label>
                Email or username
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <div className="login-row">
                <label className="remember">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>
              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <p className="login-foot">
              New to Sign Future?{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => {
                  setStep("register");
                  setError(null);
                  setNotice(null);
                }}
              >
                Create an account
              </button>
            </p>
          </>
        )}

        {step === "register" && !otpSent && (
          <>
            <h2>Create your account</h2>
            <p className="login-sub">Join Sign Future to order and manage signage</p>
            <form onSubmit={sendRegisterCode}>
              <label>
                Full name
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Phone <span className="login-optional">(optional)</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="01x-xxx xxxx"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>
              <label>
                Referral code
                <input
                  type="text"
                  placeholder="Enter your referral code"
                  value={regReferral}
                  onChange={(e) => setRegReferral(e.target.value.toUpperCase())}
                  required
                />
              </label>

              <div className="reg-professions">
                <span className="reg-professions-label">
                  What do you do? <span className="login-optional">(select all that apply)</span>
                </span>
                <div className="reg-chips">
                  {PROFESSIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`reg-chip${regProfessions.includes(p) ? " is-active" : ""}`}
                      onClick={() => toggleProfession(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Sending code…" : "Send verification code"}
              </button>
            </form>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setStep("signin");
                setError(null);
                setNotice(null);
                setPassword("");
                setConfirmPassword("");
              }}
            >
              ← Back to sign in
            </button>
          </>
        )}

        {step === "register" && otpSent && (
          <>
            <h2>Verify your email</h2>
            <p className="login-sub">Enter the 6-digit code we sent you</p>

            {notice && (
              <p className="login-notice" role="status">
                {notice}
              </p>
            )}

            <form onSubmit={submitRegister}>
              <label>
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={regOtp}
                  onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Creating account…" : "Verify & create account"}
              </button>
            </form>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setOtpSent(false);
                setRegOtp("");
                setError(null);
                setNotice(null);
              }}
            >
              ← Change details
            </button>
          </>
        )}

        {step === "reset" && (
          <>
            <h2>Set your new password</h2>
            <p className="login-sub">
              This is your first sign-in on the new Sign Future site.
            </p>

            {notice && (
              <p className="login-notice" role="status">
                {notice}
              </p>
            )}

            <form onSubmit={submitReset}>
              <label>
                Account
                <input type="text" value={identifier} readOnly className="login-readonly" />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? "Saving…" : "Set password & sign in"}
              </button>
            </form>
            <button
              type="button"
              className="login-back"
              onClick={() => {
                setStep("signin");
                setError(null);
                setNotice(null);
              }}
            >
              ← Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
