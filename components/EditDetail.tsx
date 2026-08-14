"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

/**
 * Edit Detail — the customer's registration details.
 *
 * Two groups:
 *   • Company (Name / Register No / TIN) — editable until the member confirms
 *     them; after that they are LOCKED and changing them needs a request
 *     (WhatsApp to the consultant).
 *   • Contact & login (password, address, postcode, city, state, mobile) —
 *     directly editable at any time.
 *
 * Demo persistence: values are stored in localStorage so the flow works without
 * a backend. Wire the two save handlers to real profile endpoints for
 * production (the password field never persists locally).
 */

// "Request to change" for the locked company details goes to the consultant.
const CONSULTANT_WA = "60179907559";

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

// Legacy GLOBAL keys (not namespaced per user). They leaked one member's draft
// into every other member on the same device, so we purge them on mount and no
// longer read/write them — drafts now live under the per-user keys below.
const LEGACY_COMPANY_KEY = "sf.editDetail.company";
const LEGACY_CONTACT_KEY = "sf.editDetail.contact";
// Per-user draft keys so one account's Edit Detail never bleeds into another's.
const companyKeyFor = (id: number | undefined | null) => `sf.editDetail.company.${id ?? "anon"}`;
const contactKeyFor = (id: number | undefined | null) => `sf.editDetail.contact.${id ?? "anon"}`;
const EMPTY_COMPANY: Company = { name: "", regNo: "", tin: "", confirmed: false };
const EMPTY_CONTACT: Contact = { email: "", address: "", postcode: "", city: "", state: "", mobile: "" };

export default function EditDetail() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [companyMsg, setCompanyMsg] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const companyKey = companyKeyFor(user?.id);
  const contactKey = contactKeyFor(user?.id);

  useEffect(() => {
    try {
      // Purge the old GLOBAL drafts that leaked one member's data into another.
      localStorage.removeItem(LEGACY_COMPANY_KEY);
      localStorage.removeItem(LEGACY_CONTACT_KEY);

      // Seed every Edit Detail field from THIS member's own account (the same
      // registration data shown in My Details): Company, Email, Phone, Address,
      // Postcode, City, State. A draft this SAME member saved wins, but whenever
      // a field is still empty we fall back to the account value so it transfers
      // over automatically.
      const b: Record<string, string | null> = user?.billing || {};
      const acctAddress = [b.address_1, b.address_2].filter(Boolean).join(", ");

      const c = JSON.parse(localStorage.getItem(companyKey) || "null");
      setCompany({
        ...EMPTY_COMPANY,
        ...(c || {}),
        name: (c && c.name) || b.company || "",
      });
      const k = JSON.parse(localStorage.getItem(contactKey) || "null");
      const seededPostcode = (k && k.postcode) || b.postcode || "";
      setContact({
        ...EMPTY_CONTACT,
        ...(k || {}),
        email: (k && k.email) || user?.email || "",
        mobile: (k && k.mobile) || user?.phone || b.phone || "",
        address: (k && k.address) || acctAddress || "",
        postcode: seededPostcode,
        city: (k && k.city) || b.city || "",
        // State follows the postcode; fall back to any stored state only when
        // the postcode can't resolve one.
        state: stateFromPostcode(seededPostcode) || (k && k.state) || b.state || "",
      });
    } catch {
      /* ignore malformed storage */
    }
  }, [user, companyKey, contactKey]);

  const companyComplete =
    company.name.trim() !== "" && company.regNo.trim() !== "" && company.tin.trim() !== "";

  function confirmCompany() {
    if (!companyComplete) {
      setCompanyMsg("Please fill in all company fields first.");
      return;
    }
    const next = { ...company, confirmed: true };
    setCompany(next);
    try {
      localStorage.setItem(companyKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setCompanyMsg("Company details confirmed and locked.");
  }

  function requestCompanyChange() {
    const text = encodeURIComponent(
      `Hi, I'm member ${user?.memberNo ?? ""}. I'd like to request a change to my company details (Name / Register No / TIN).`,
    );
    window.open(`https://api.whatsapp.com/send?phone=${CONSULTANT_WA}&text=${text}`, "_blank", "noopener");
  }

  return (
    <section className="acct-card acct-section-card" id="edit-detail">
      <div className="acct-card-head">
        <h2>Edit Detail</h2>
        <span>Your registration details</span>
      </div>

      {/* Company — locked once confirmed */}
      <div className="edit-detail-block">
        <div className="edit-detail-block-head">
          <h3>Company Information</h3>
          {company.confirmed && <span className="edit-detail-lock">🔒 Locked</span>}
        </div>
        <div className="edit-detail-grid">
          <label>
            Company Name
            <input
              value={company.name}
              readOnly={company.confirmed}
              placeholder="Your company name"
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
          </label>
          <label>
            Company Register Number
            <input
              value={company.regNo}
              readOnly={company.confirmed}
              placeholder="e.g. 202301234567"
              onChange={(e) => setCompany({ ...company, regNo: e.target.value })}
            />
          </label>
          <label>
            Company TIN Number
            <input
              value={company.tin}
              readOnly={company.confirmed}
              placeholder="e.g. C1234567890"
              onChange={(e) => setCompany({ ...company, tin: e.target.value })}
            />
          </label>
        </div>
        <div className="edit-detail-actions">
          {company.confirmed ? (
            <>
              <p className="edit-detail-note">
                Company details are confirmed. To change them, please request an update.
              </p>
              <button type="button" className="hero-btn ghost" onClick={requestCompanyChange}>
                Request to change
              </button>
            </>
          ) : (
            <>
              <p className="edit-detail-note">
                Once confirmed, company details are locked — changing them later needs a request.
              </p>
              <button
                type="button"
                className="hero-btn primary"
                disabled={!companyComplete}
                onClick={confirmCompany}
              >
                Confirm company details
              </button>
            </>
          )}
        </div>
        {companyMsg && <p className="edit-detail-msg">{companyMsg}</p>}
      </div>

      {/* Contact & login — directly editable */}
      <form
        className="edit-detail-block"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw.next && pw.next !== pw.confirm) {
            setContactMsg("Passwords do not match.");
            return;
          }
          try {
            localStorage.setItem(contactKey, JSON.stringify(contact));
          } catch {
            /* ignore */
          }
          const hadPw = pw.next.length > 0;
          setPw({ next: "", confirm: "" });
          setContactMsg(hadPw ? "Details and password updated." : "Details updated.");
        }}
      >
        <div className="edit-detail-block-head">
          <h3>Contact &amp; Login</h3>
        </div>
        <div className="edit-detail-grid">
          <label className="span-2">
            Email
            <input
              type="email"
              value={contact.email}
              placeholder="you@example.com"
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
            />
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
          <button type="submit" className="hero-btn primary">
            Save changes
          </button>
          {contactMsg && <p className="edit-detail-msg">{contactMsg}</p>}
        </div>
      </form>
    </section>
  );
}
