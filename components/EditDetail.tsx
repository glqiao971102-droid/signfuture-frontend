"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, PROFESSIONS, type ProfileUpdate } from "@/lib/api";

/**
 * Edit Detail — the customer's registration details.
 *
 * Two groups:
 *   • Company (Name / Register No / TIN) — editable until the member confirms
 *     them; after that they are LOCKED and changing them needs a request
 *     (WhatsApp to the consultant).
 *   • Contact & login (password, email, address, postcode, city, state, mobile)
 *     — directly editable at any time.
 *
 * Everything is persisted to the member's own account via PATCH /api/v1/profile
 * (WordPress users + usermeta). There is NO browser-local storage, so the data
 * is the single source of truth and follows the member across every device.
 */

const STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu",
];

// Malaysian postcodes are allocated by state; the first two digits pick it out.
// Built as a lookup on the 2-digit prefix (e.g. 46700 -> 46 -> Selangor).
const POSTCODE_PREFIX_STATE: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  const add = (from: number, to: number, state: string) => {
    for (let i = from; i <= to; i++) map[i] = state;
  };
  add(1, 2, "Perlis");
  add(5, 9, "Kedah");
  add(10, 14, "Penang");
  add(15, 18, "Kelantan");
  add(20, 24, "Terengganu");
  add(25, 28, "Pahang");
  add(30, 36, "Perak");
  map[39] = "Pahang"; // Cameron Highlands
  add(40, 48, "Selangor");
  map[49] = "Pahang"; // Genting Highlands (Bentong)
  add(50, 60, "Kuala Lumpur");
  map[62] = "Putrajaya";
  add(63, 64, "Selangor"); // Cyberjaya
  map[68] = "Selangor"; // Ampang / Batu Caves
  map[69] = "Pahang"; // Genting Highlands
  add(70, 73, "Negeri Sembilan");
  add(75, 78, "Melaka");
  add(79, 86, "Johor");
  map[87] = "Labuan";
  add(88, 91, "Sabah");
  add(93, 98, "Sarawak");
  return map;
})();

/** Resolves a Malaysian state from a (full, 5-digit) postcode, or "" if unknown. */
function stateFromPostcode(postcode: string): string {
  const digits = (postcode || "").replace(/\D/g, "");
  if (digits.length < 5) return "";
  return POSTCODE_PREFIX_STATE[Math.floor(parseInt(digits.slice(0, 5), 10) / 1000)] || "";
}

type Company = { name: string; regNo: string; tin: string; confirmed: boolean };
type Contact = { email: string; address: string; postcode: string; city: string; state: string; mobile: string };

const EMPTY_COMPANY: Company = { name: "", regNo: "", tin: "", confirmed: false };
const EMPTY_CONTACT: Contact = { email: "", address: "", postcode: "", city: "", state: "", mobile: "" };

export default function EditDetail() {
  const { user, refresh } = useAuth();
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  // The member's trades ("What do you do?") — saved with the contact form.
  const [professions, setProfessions] = useState<string[]>([]);
  const [companyMsg, setCompanyMsg] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // One-time cleanup: remove any drafts left by the old localStorage version so
  // no stale (or previously-leaked) local data lingers on the device.
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sf.editDetail"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  // Seed every field from THIS member's own account (the single source of
  // truth). Re-runs after a save refreshes `user`, so the form reflects what
  // was actually stored.
  useEffect(() => {
    const b: Record<string, string | null> = user?.billing || {};
    const acctAddress = [b.address_1, b.address_2].filter(Boolean).join(", ");
    const postcode = b.postcode || "";
    setCompany({
      name: b.company || "",
      regNo: user?.company?.regNo || "",
      tin: user?.company?.tin || "",
      confirmed: !!user?.company?.confirmed,
    });
    setContact({
      email: user?.email || "",
      address: acctAddress,
      postcode,
      city: b.city || "",
      // State follows the postcode; fall back to the stored state when the
      // postcode can't resolve one.
      state: stateFromPostcode(postcode) || b.state || "",
      mobile: user?.phone || b.phone || "",
    });
    setProfessions(user?.professions ?? []);
  }, [user]);

  function toggleProfession(p: string) {
    setProfessions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  // Company details are freely editable and saved on demand.
  async function saveCompany() {
    setSavingCompany(true);
    setCompanyMsg("");
    try {
      await api.updateProfile({
        companyName: company.name.trim(),
        companyRegNo: company.regNo.trim(),
        companyTin: company.tin.trim(),
        companyConfirmed: true,
      });
      await refresh();
      setCompanyMsg("Company details saved.");
    } catch (err) {
      setCompanyMsg(err instanceof Error ? err.message : "Could not save company details.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next && pw.next.length < 6) {
      setContactMsg("Password must be at least 6 characters.");
      return;
    }
    if (pw.next && pw.next !== pw.confirm) {
      setContactMsg("Passwords do not match.");
      return;
    }
    setSavingContact(true);
    setContactMsg("");
    try {
      const patch: ProfileUpdate = {
        phone: contact.mobile.trim(),
        address: contact.address.trim(),
        postcode: contact.postcode.trim(),
        city: contact.city.trim(),
        state: contact.state.trim(),
        professions,
      };
      if (pw.next) patch.password = pw.next;
      await api.updateProfile(patch);
      await refresh();
      const hadPw = pw.next.length > 0;
      setPw({ next: "", confirm: "" });
      setContactMsg(hadPw ? "Details and password updated." : "Details updated.");
    } catch (err) {
      setContactMsg(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <section className="acct-card acct-section-card" id="edit-detail">
      <div className="acct-card-head">
        <h2>Edit Detail</h2>
        <span>Your registration details</span>
      </div>

      {/* Company — freely editable */}
      <div className="edit-detail-block">
        <div className="edit-detail-block-head">
          <h3>Company Information</h3>
        </div>
        <div className="edit-detail-grid">
          <label>
            Company Name
            <input
              value={company.name}
              placeholder="Your company name"
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
          </label>
          <label>
            Company Register Number
            <input
              value={company.regNo}
              placeholder="e.g. 202301234567"
              onChange={(e) => setCompany({ ...company, regNo: e.target.value })}
            />
          </label>
          <label>
            Company TIN Number
            <input
              value={company.tin}
              placeholder="e.g. C1234567890"
              onChange={(e) => setCompany({ ...company, tin: e.target.value })}
            />
          </label>
        </div>
        <div className="edit-detail-actions">
          <button
            type="button"
            className="hero-btn primary"
            disabled={savingCompany}
            onClick={saveCompany}
          >
            {savingCompany ? "Saving…" : "Save company details"}
          </button>
        </div>
        {companyMsg && <p className="edit-detail-msg">{companyMsg}</p>}
      </div>

      {/* Contact & login — directly editable */}
      <form className="edit-detail-block" onSubmit={saveContact}>
        <div className="edit-detail-block-head">
          <h3>Contact &amp; Login</h3>
        </div>

        {/* What do you do? — the member's trades (select all that apply). */}
        <div className="edit-detail-professions">
          <span className="edit-detail-professions-label">
            What do you do? <span className="login-optional">(select all that apply)</span>
          </span>
          <div className="reg-chips">
            {PROFESSIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`reg-chip${professions.includes(p) ? " is-active" : ""}`}
                onClick={() => toggleProfession(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="edit-detail-grid">
          <label className="span-2">
            Email
            <input
              type="email"
              value={contact.email}
              readOnly
              disabled
              className="edit-detail-locked-input"
              title="Your registered email can't be changed"
            />
            <span className="edit-detail-field-note">
              Your registered email — this can’t be changed.
            </span>
          </label>
          <label className="span-2">
            Address
            <input
              value={contact.address}
              placeholder="Your address"
              onChange={(e) => setContact({ ...contact, address: e.target.value })}
            />
          </label>
          <label>
            Postal Code
            <input
              value={contact.postcode}
              inputMode="numeric"
              maxLength={5}
              placeholder="e.g. 47500"
              onChange={(e) => {
                const postcode = e.target.value.replace(/\D/g, "");
                // Auto-fill State from the postcode; keep the current state when
                // the postcode is still incomplete / unrecognised.
                const state = stateFromPostcode(postcode);
                setContact((prev) => ({ ...prev, postcode, state: state || prev.state }));
              }}
            />
          </label>
          <label>
            City
            <input
              value={contact.city}
              placeholder="City"
              onChange={(e) => setContact({ ...contact, city: e.target.value })}
            />
          </label>
          <label>
            State
            <select value={contact.state} onChange={(e) => setContact({ ...contact, state: e.target.value })}>
              <option value="">Select state</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mobile Number
            <input
              value={contact.mobile}
              inputMode="tel"
              placeholder="01x-xxx xxxx"
              onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              value={pw.next}
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
            />
          </label>
          <label>
            Confirm Password
            <input
              type="password"
              value={pw.confirm}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            />
          </label>
        </div>
        <div className="edit-detail-actions">
          <button type="submit" className="hero-btn primary" disabled={savingContact}>
            {savingContact ? "Saving…" : "Save changes"}
          </button>
          {contactMsg && <p className="edit-detail-msg">{contactMsg}</p>}
        </div>
      </form>
    </section>
  );
}
