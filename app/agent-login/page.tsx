"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";

/**
 * Agent (proxy) login — staff log in as a customer to order on their behalf.
 * Gated by a master password + an OTP sent to the authorising inbox. Every
 * login is audited server-side; orders placed here are flagged 代理下单.
 */
export default function AgentLoginPage() {
  const { refresh } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"start" | "otp">("start");
  const [masterPassword, setMasterPassword] = useState("");
  const [agentLabel, setAgentLabel] = useState("");
  const [target, setTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!masterPassword || !agentLabel.trim() || !target.trim()) {
      setError("Fill in your name, the customer email, and the master password.");
      return;
    }
    setBusy(true);
    try {
      await api.agentRequestOtp(masterPassword);
      setStep("otp");
      setNotice("A login code was sent to the authorising email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.agentLogin({
        masterPassword,
        otp: otp.trim(),
        targetIdentifier: target.trim(),
        agentLabel: agentLabel.trim(),
      });
      try {
        localStorage.setItem("signfuture.agent", JSON.stringify({ label: res.agentLabel, email: res.user.email }));
      } catch { /* ignore */ }
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="cart-head">
          <div>
            <h1>Agent Login</h1>
            <p>Staff only — log in as a customer to place an order on their behalf.</p>
          </div>
        </section>

        <section className="login-overlay" style={{ position: "static", background: "none", backdropFilter: "none", padding: 0, display: "block" }}>
          <div className="login-modal" style={{ margin: "0 auto" }}>
            {step === "start" ? (
              <form onSubmit={requestOtp}>
                <h2>Start agent session</h2>
                <p className="login-sub">A verification code will be sent to the authorising inbox.</p>
                <label>Your name (agent)
                  <input type="text" value={agentLabel} onChange={(e) => setAgentLabel(e.target.value)} placeholder="e.g. Sales Alice" required autoFocus />
                </label>
                <label>Customer email or username
                  <input type="text" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="customer@example.com" required />
                </label>
                <label>Master password
                  <input type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} placeholder="••••••••" required />
                </label>
                {error && <p className="login-error" role="alert">{error}</p>}
                <button type="submit" className="login-submit" disabled={busy}>{busy ? "Sending…" : "Send login code"}</button>
              </form>
            ) : (
              <form onSubmit={doLogin}>
                <h2>Enter login code</h2>
                {notice && <p className="login-notice" role="status">{notice}</p>}
                <p className="login-sub">Acting as <strong>{target}</strong></p>
                <label>Verification code
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" required autoFocus />
                </label>
                {error && <p className="login-error" role="alert">{error}</p>}
                <button type="submit" className="login-submit" disabled={busy}>{busy ? "Logging in…" : "Log in as customer"}</button>
                <button type="button" className="login-back" onClick={() => { setStep("start"); setError(null); setNotice(null); }}>← Back</button>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
