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

type Company = { name: string; regNo: string; tin: string; confirmed: boolean };
type Contact = { email: string; address: string; postcode: string; city: string; state: string; mobile: string };

const COMPANY_KEY = "sf.editDetail.company";
const CONTACT_KEY = "sf.editDetail.contact";
const EMPTY_COMPANY: Company = { name: "", regNo: "", tin: "", confirmed: false };
const EMPTY_CONTACT: Contact = { email: "", address: "", postcode: "", city: "", state: "", mobile: "" };

export default function EditDetail() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company>(EMPTY_COMPANY);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [companyMsg, setCompanyMsg] = useState("");
  const [contactMsg, setContactMsg] = useState("");

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(COMPANY_KEY) || "null");
      if (c) setCompany(c);
      // Seed Company Name from the member's account company (My Details).
      else setCompany((prev) => ({ ...prev, name: user?.billing?.company || "" }));
      const k = JSON.parse(localStorage.getItem(CONTACT_KEY) || "null");
      if (k) setContact(k);
      // Seed Phone + Email from the member's account.
      else
        setContact((prev) => ({
          ...prev,
          mobile: user?.phone || "",
          email: user?.email || "",
        }));
    } catch {
      /* ignore malformed storage */
    }
  }, [user]);

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
      localStorage.setItem(COMPANY_KEY, JSON.stringify(next));
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
            localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
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
              onChange={(e) => setContact({ ...contact, postcode: e.target.value.replace(/\D/g, "") })}
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
