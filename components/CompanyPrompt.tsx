"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

/**
 * Company-details gate (BLOCKING).
 *
 * Every invoice is billed to the member's COMPANY NAME (see InvoiceList /
 * ReloadList — the bill-to prefers `billing.company`). So any signed-in member
 * who has not set a company name is shown this modal on entry and CANNOT
 * dismiss it — they must enter a company name to continue. The register number
 * and TIN are optional.
 *
 * Mounted globally in the root layout (inside AuthProvider). The overlay covers
 * the page, so nothing behind it is usable until a company name is saved.
 */
export default function CompanyPrompt() {
  const { user, loading, refresh } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [tin, setTin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-only: the modal never renders on the server, keeping SSR/first paint
  // consistent.
  useEffect(() => {
    setMounted(true);
  }, []);

  const companyName = (user?.billing?.company || "").trim();
  const show = mounted && !loading && !!user && !companyName;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Please enter your company name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({
        companyName: name.trim(),
        companyRegNo: regNo.trim(),
        companyTin: tin.trim(),
        companyConfirmed: true,
      });
      // Once the profile reloads with a company name, `show` becomes false and
      // this component unmounts on its own.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your company details.");
      setSaving(false);
    }
  }

  if (!show) return null;

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <h2>Add your company details</h2>
        <p className="login-sub">
          Your invoices are issued to your company name — please add it to continue.
        </p>
        <form onSubmit={save}>
          <label>
            Company Name *
            <input
              type="text"
              placeholder="Your company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Company Register Number <span className="login-optional">(optional)</span>
            <input
              type="text"
              placeholder="e.g. 202301234567"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
            />
          </label>
          <label>
            Company TIN Number <span className="login-optional">(optional)</span>
            <input
              type="text"
              placeholder="e.g. C1234567890"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save company details"}
          </button>
        </form>
      </div>
    </div>
  );
}
