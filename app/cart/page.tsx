"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart, formatRM } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { isDeliverable } from "@/lib/products";
import { tierIndex, tierLabel, TIER_LABELS, TIER_THRESHOLD } from "@/lib/tier";
import { api, ApiError, type MemberVoucher } from "@/lib/api";

const CHECKOUT_KEY = "sign-studio-checkout";

// Nothing includes delivery. Delivery is arranged on request via the consultant
// (WhatsApp) — no fee is added at checkout; the consultant confirms it separately.
const SHIPPING = [
  { id: "pickup", label: "Self Collect", note: "Pick up at our outlet", cost: 0, request: false },
  { id: "west", label: "Request Delivery", note: "+Extra Working Day", cost: 0, request: true },
];

const WEST_STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
  "Perak", "Perlis", "Pulau Pinang", "Selangor", "Terengganu",
  "Kuala Lumpur", "Putrajaya",
];

const EMPTY_ADDR = { profile: "", receiver: "", mobile: "", tel: "", address1: "", address2: "", postcode: "", city: "", state: "" };
type Address = typeof EMPTY_ADDR & { id: string };
const ADDR_KEY = "sign-studio-addresses";

export default function CartPage() {
  const router = useRouter();
  const { items, count, setQty, setArtworks, remove, clear } = useCart();
  const { user } = useAuth();

  // The customer's entitled tier (Agent for guests) is the CHEAPEST price they
  // qualify for. On the cart they may switch to a lower rank (Agent/Silver…),
  // which is MORE expensive, so it's safe; cheaper tiers than their entitlement
  // stay locked (unlock by topping up). Tier index: Agent 0 … Diamond 3, and a
  // higher index is cheaper — so "allowed to pay" means index ≤ entitled.
  const myTier = tierIndex(user?.tier);
  const [payTier, setPayTier] = useState<number | null>(null);
  const effTier = payTier != null && payTier <= myTier ? payTier : myTier;
  const unitAt = (i: (typeof items)[number], t: number) =>
    i.tierPrices && i.tierPrices.length === 4 ? i.tierPrices[t] : i.price;
  const unit = (i: (typeof items)[number]) => unitAt(i, effTier);
  const subtotal = items.reduce((n, i) => n + unit(i) * i.qty, 0);
  // Cart total at each tier (items without member pricing are constant).
  const tierCart = [0, 1, 2, 3].map((t) => items.reduce((n, i) => n + unitAt(i, t) * i.qty, 0));
  const hasTierItems = items.some((i) => i.tierPrices && i.tierPrices.length === 4);
  // Upsell to the cheapest tier (Diamond) they don't yet have.
  const bestSaving = Math.max(0, tierCart[effTier] - tierCart[3]);
  const bestSavingPct = tierCart[effTier] > 0 ? Math.round((bestSaving / tierCart[effTier]) * 100) : 0;

  // ----- Vouchers (moved here from checkout) -----
  const [vouchers, setVouchers] = useState<MemberVoucher[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherMsg, setVoucherMsg] = useState<string | null>(null);
  useEffect(() => {
    if (user) api.myVouchers().then((r) => setVouchers(r.data)).catch(() => setVouchers([]));
    else setVouchers([]);
  }, [user]);
  const orderScopeItems = () =>
    items.map((i) => ({ productName: i.label, lineTotal: unit(i) * i.qty }));
  async function applyVoucher(code: string) {
    setVoucherMsg(null);
    setVoucherDiscount(0);
    setVoucherCode(code);
    setVoucherInput(code);
    if (!code) return;
    try {
      const r = await api.previewVoucher(code, orderScopeItems());
      if (!r.applicable) {
        setVoucherMsg("This voucher doesn't apply to any item in your cart.");
        return;
      }
      setVoucherDiscount(r.discount);
      setVoucherMsg(`✓ − RM ${r.discount.toFixed(2)} on: ${r.eligibleNames.join(", ")}`);
    } catch (err) {
      setVoucherMsg(err instanceof ApiError ? err.message : "Could not apply voucher.");
      setVoucherCode("");
    }
  }

  // ----- Per-line artwork upload -----
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  async function handleArtwork(id: string, files: FileList | null, existing: { url: string; name: string }[]) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploadingId(id);
    try {
      const added: { url: string; name: string }[] = [];
      for (const file of list) {
        const res = await api.uploadArtwork(file);
        added.push({ url: res.url, name: file.name });
      }
      setArtworks(id, [...existing, ...added]);
    } catch {
      /* surfaced below via alert */
      alert("Artwork upload failed. Please try again.");
    } finally {
      setUploadingId(null);
    }
  }

  const [shipId, setShipId] = useState("pickup");

  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [addrModal, setAddrModal] = useState(false); // add/edit form
  const [bookModal, setBookModal] = useState(false); // saved-address picker
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bookProfile, setBookProfile] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [bookPage, setBookPage] = useState(1);
  const [bookPageSize, setBookPageSize] = useState(10);

  // Address book persists across sessions.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADDR_KEY);
      if (raw) {
        const list = JSON.parse(raw) as Address[];
        setAddresses(list);
        if (list[0]) setSelectedAddrId(list[0].id);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(ADDR_KEY, JSON.stringify(addresses));
    } catch {
      /* ignore */
    }
  }, [addresses]);

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId) || null;
  const newAddrId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // address-book picker: profile filter + keyword search + pagination
  const profiles = Array.from(new Set(addresses.map((a) => a.profile).filter(Boolean)));
  const bookFiltered = addresses.filter((a) => {
    if (bookProfile && a.profile !== bookProfile) return false;
    if (bookSearch.trim()) {
      const q = bookSearch.trim().toLowerCase();
      const hay = [a.receiver, a.city, a.state, a.postcode].map((x) => (x || "").toLowerCase());
      if (!hay.some((x) => x.includes(q))) return false;
    }
    return true;
  });
  const bookPageCount = Math.max(1, Math.ceil(bookFiltered.length / bookPageSize));
  const bookPg = Math.min(bookPage, bookPageCount);
  const bookPageItems = bookFiltered.slice((bookPg - 1) * bookPageSize, bookPg * bookPageSize);
  const openBook = () => {
    setBookProfile("");
    setBookSearch("");
    setBookPage(1);
    setBookModal(true);
  };

  const setField = (k: keyof typeof EMPTY_ADDR, v: string) => setAddr((a) => ({ ...a, [k]: v }));

  // Postcode -> city/state auto-fill (Malaysian postcode dataset, lazy-loaded).
  const pcMapRef = useRef<Map<string, { city: string; state: string }> | null>(null);
  const ensurePcMap = async () => {
    if (pcMapRef.current) return pcMapRef.current;
    try {
      const data = await (await fetch("/data/my-postcodes.json")).json();
      const map = new Map<string, { city: string; state: string }>();
      for (const st of data.state) {
        const stateName = String(st.name).replace(/^Wp\s+/i, "").trim();
        for (const c of st.city) {
          for (const pc of c.postcode) {
            if (!map.has(pc)) map.set(pc, { city: c.name, state: stateName });
          }
        }
      }
      pcMapRef.current = map;
      return map;
    } catch {
      return null;
    }
  };
  const onPostcode = async (raw: string) => {
    const pc = raw.replace(/[^0-9]/g, "").slice(0, 5);
    setField("postcode", pc);
    if (pc.length === 5) {
      const map = await ensurePcMap();
      const hit = map ? map.get(pc) : null;
      if (hit) setAddr((a) => (a.postcode === pc ? { ...a, city: hit.city, state: hit.state } : a));
    }
  };

  const selectShip = (id: string) => {
    // Request Delivery is arranged via the consultant — no address collected here.
    setShipId(id);
  };
  const openAddNew = () => {
    setEditingId(null);
    setAddr(EMPTY_ADDR);
    setBookModal(false);
    setAddrModal(true);
  };
  const openEdit = (id: string) => {
    const a = addresses.find((x) => x.id === id);
    if (!a) return;
    const { id: _id, ...rest } = a;
    setEditingId(id);
    setAddr(rest);
    setBookModal(false);
    setAddrModal(true);
  };
  const saveAddr = () => {
    if (editingId) {
      setAddresses((prev) => prev.map((a) => (a.id === editingId ? { ...addr, id: editingId } : a)));
      setSelectedAddrId(editingId);
    } else {
      const id = newAddrId();
      setAddresses((prev) => [...prev, { ...addr, id }]);
      setSelectedAddrId(id);
    }
    setAddrModal(false);
  };
  const cancelAddr = () => {
    setAddrModal(false);
    if (addresses.length === 0 && shipId !== "pickup") setShipId("pickup");
  };
  const chooseAddress = (id: string) => {
    setSelectedAddrId(id);
    setBookModal(false);
  };
  const deleteAddress = (id: string) => {
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (selectedAddrId === id) setSelectedAddrId(next[0]?.id ?? null);
      return next;
    });
  };

  const shipMethod = SHIPPING.find((s) => s.id === shipId);
  const shipping = shipMethod?.cost ?? 0;
  const total = Math.max(0, subtotal - voucherDiscount) + shipping;

  const proceed = () => {
    if (items.length === 0) return;
    const order = {
      items: items.map((i) => ({
        label: i.label, meta: i.meta, qty: i.qty, price: unit(i), image: i.image,
        href: i.href, deliverable: isDeliverable(i), spec: i.spec,
        // Artwork the customer attached to this exact line.
        artworks: i.artworks && i.artworks.length ? i.artworks : undefined,
      })),
      subtotal,
      coupon: null,
      // Chosen voucher (validated server-side again at order time).
      voucher: voucherCode && voucherDiscount > 0 ? { code: voucherCode, discount: voucherDiscount } : null,
      shipping: { id: shipId, label: shipMethod?.label ?? "", cost: shipping },
      // Request Delivery carries the chosen saved shipping address.
      address: shipId !== "pickup" ? selectedAddr : null,
      total,
      // Chosen pricing tier index — server re-checks entitlement at order time.
      tier: effTier,
      at: Date.now(),
    };
    try {
      localStorage.setItem(CHECKOUT_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
    router.push("/checkout");
  };

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="cart-head">
          <div>
            <h1>Your cart</h1>
            <p>{count} item{count === 1 ? "" : "s"}</p>
          </div>
          <Link href="/#categories" className="cart-continue">← Continue shopping</Link>
        </section>

        {items.length === 0 ? (
          <section className="cart-empty">
            <span className="cart-empty-glyph">🛒</span>
            <p>Your cart is empty.</p>
            <Link href="/#categories" className="hero-btn primary">
              Browse products
            </Link>
          </section>
        ) : (
          <section className="cart-layout">
            <div className="cart-table">
              <div className="cart-table-head">
                <span>Product</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Subtotal</span>
                <span />
              </div>

              {items.map((item) => (
                <div key={item.id} className="cart-row">
                  <div className="cart-prod">
                    <Link href={item.href} className="cart-prod-thumb" aria-label={item.label}>
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.label} />
                      ) : (
                        <span className="cart-prod-glyph">◆</span>
                      )}
                    </Link>
                    <div className="cart-prod-info">
                      <Link href={item.href} className="cart-prod-title">{item.label}</Link>
                      {item.meta && <span className="cart-prod-meta">{item.meta}</span>}

                      <div className="cart-art">
                        <label className="cart-art-btn">
                          {uploadingId === item.id ? "Uploading…" : (item.artworks?.length ? "+ Add more artwork" : "⬆ Upload artwork")}
                          <input
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.ai,.eps,.psd,.tif,.tiff,.zip"
                            disabled={uploadingId === item.id}
                            onChange={(e) => { handleArtwork(item.id, e.target.files, item.artworks ?? []); e.currentTarget.value = ""; }}
                          />
                        </label>
                        {item.artworks && item.artworks.length > 0 && (
                          <ul className="cart-art-list">
                            {item.artworks.map((a) => (
                              <li key={a.url}>
                                <a href={a.url} target="_blank" rel="noreferrer">✓ {a.name}</a>
                                <button
                                  type="button"
                                  aria-label={`Remove ${a.name}`}
                                  onClick={() => setArtworks(item.id, (item.artworks ?? []).filter((x) => x.url !== a.url))}
                                >✕</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="cart-cell" data-label="Price">
                    <span className="cart-unit">{formatRM(unit(item))}</span>
                    {item.tierPrices && (
                      <span className="cart-unit-tier">{tierLabel(effTier)} price</span>
                    )}
                  </div>

                  <div className="cart-cell" data-label="Quantity">
                    <div className="cart-qty">
                      <button type="button" aria-label="Decrease" onClick={() => setQty(item.id, item.qty - 1)}>−</button>
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => setQty(item.id, Number(e.target.value) || 1)}
                        aria-label={`Quantity for ${item.label}`}
                      />
                      <button type="button" aria-label="Increase" onClick={() => setQty(item.id, item.qty + 1)}>+</button>
                    </div>
                  </div>

                  <div className="cart-cell" data-label="Subtotal">
                    <strong className="cart-line">{formatRM(unit(item) * item.qty)}</strong>
                  </div>

                  <div className="cart-cell cart-cell-remove">
                    <button type="button" className="cart-remove" aria-label={`Remove ${item.label}`} onClick={() => remove(item.id)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              <div className="cart-table-foot">
                <button type="button" className="cart-clear" onClick={clear}>Clear cart</button>
              </div>
            </div>

            <aside className="cart-summary">
              <h2>Cart totals</h2>
              <div className="cart-sum-row">
                <span>Subtotal</span>
                <span>{formatRM(subtotal)}</span>
              </div>

              {voucherDiscount > 0 && (
                <div className="cart-sum-row discount">
                  <span>Voucher <strong>{voucherCode}</strong></span>
                  <span>− {formatRM(voucherDiscount)}</span>
                </div>
              )}

              {user && (
                <div className="cart-voucher">
                  <span className="cart-ship-title">Voucher</span>
                  {vouchers.length > 0 ? (
                    <ul className="ckv-list">
                      {vouchers.map((v) => {
                        const active = voucherCode === v.code;
                        const off = v.discountType === "percent" ? `${v.discountValue}%` : `RM${v.discountValue}`;
                        return (
                          <li key={v.code}>
                            <button
                              type="button"
                              className={`ckv-opt${active ? " is-active" : ""}`}
                              onClick={() => applyVoucher(active ? "" : v.code)}
                              aria-pressed={active}
                            >
                              <span className="ckv-off">{off}</span>
                              <span className="ckv-info">
                                <span className="ckv-code">{v.code}</span>
                                <span className="ckv-scope">{v.scopeType === "all" ? "Any product" : v.scopeValues.join(" / ")}{v.minSpend > 0 ? ` · min RM${v.minSpend}` : ""}</span>
                              </span>
                              <span className="ckv-check" aria-hidden="true">{active ? "✓" : ""}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="cart-voucher-hint">No vouchers on your account. Enter a code if you have one.</p>
                  )}
                  <div className="cart-voucher-manual">
                    <input type="text" placeholder="Have a code? Enter it here" value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} />
                    <button type="button" onClick={() => applyVoucher(voucherInput)}>Apply</button>
                  </div>
                  {voucherMsg && <p className={`cart-voucher-msg ${voucherMsg.startsWith("✓") ? "ok" : "error"}`}>{voucherMsg}</p>}
                </div>
              )}

              <div className="cart-ship">
                <span className="cart-ship-title">Shipping</span>
                {SHIPPING.map((s) => (
                  <label key={s.id} className={`cart-ship-opt${shipId === s.id ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name="shipping"
                      value={s.id}
                      checked={shipId === s.id}
                      onChange={() => selectShip(s.id)}
                    />
                    <span className="cart-ship-info">
                      <span className="cart-ship-label">{s.label}</span>
                      <span className="cart-ship-note">{s.note}</span>
                    </span>
                    <span className="cart-ship-cost">{s.request ? "Request" : s.cost === 0 ? "Free" : formatRM(s.cost)}</span>
                  </label>
                ))}

                {shipId !== "pickup" && (
                  <>
                    <div className="cart-ship-request">
                      <p className="cart-ship-request-title">Need Delivery Service? (+Extra Working Day)</p>
                      <p>Please contact your consultant via WhatsApp.</p>
                      <p>After checking your order, your consultant will confirm the delivery fee.</p>
                      <p>Please make payment and send the receipt via WhatsApp.</p>
                    </div>
                    <div className="cart-ship-addr">
                      <span className="cart-ship-addr-title">Shipping Address</span>
                      <div className="cart-ship-addr-actions">
                        <button type="button" className="cart-ship-opt cart-addr-choice" onClick={openAddNew}>
                          <span className="cart-ship-info">
                            <span className="cart-ship-label">+ Add New Address</span>
                            <span className="cart-ship-note">Save a new delivery address</span>
                          </span>
                        </button>
                        <button type="button" className="cart-ship-opt cart-addr-choice" onClick={openBook} disabled={addresses.length === 0}>
                          <span className="cart-ship-info">
                            <span className="cart-ship-label">My Addresses</span>
                            <span className="cart-ship-note">{addresses.length > 0 ? `${addresses.length} saved · pick by profile` : "No saved address yet"}</span>
                          </span>
                        </button>
                      </div>
                      {selectedAddr && (
                        <div className="cart-addr-saved">
                          <div className="cart-addr-saved-head">
                            <span className="cart-addr-title">Ship to{selectedAddr.profile ? " · " + selectedAddr.profile : ""}</span>
                            <button type="button" className="cart-addr-edit" onClick={() => openEdit(selectedAddr.id)}>Edit</button>
                          </div>
                          <p className="cart-addr-name">{selectedAddr.receiver || selectedAddr.profile}</p>
                          {selectedAddr.mobile && <p>{selectedAddr.mobile}{selectedAddr.tel ? " / " + selectedAddr.tel : ""}</p>}
                          <p>{[selectedAddr.address1, selectedAddr.address2].filter(Boolean).join(", ")}</p>
                          <p>{[selectedAddr.postcode, selectedAddr.city].filter(Boolean).join(" ")}{selectedAddr.state ? ", " + selectedAddr.state : ""}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {hasTierItems && (
                <div className="tier-compare">
                  <span className="tier-compare-title">Choose pricing tier — paying <strong>{tierLabel(effTier)}</strong></span>
                  <div className="tier-compare-rows">
                    {TIER_LABELS.map((label, t) => {
                      const allowed = t <= myTier; // own tier + lower ranks (more expensive)
                      const selected = t === effTier;
                      const locked = t > myTier; // cheaper than entitlement → needs top-up
                      return (
                        <button
                          key={label}
                          type="button"
                          className={`tier-compare-row${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
                          disabled={!allowed}
                          onClick={() => allowed && setPayTier(t)}
                        >
                          <span className="tier-compare-name">
                            {label}
                            {t === myTier && " · your tier"}
                          </span>
                          <span className="tier-compare-price">{formatRM(tierCart[t])}</span>
                          <span className="tier-compare-note">
                            {selected ? "✓ paying this" : locked ? "🔒 top up to unlock" : "tap to use"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {bestSaving > 0 && (
                    <p className="tier-compare-upsell">
                      💎 Reach <strong>Diamond</strong> to save <strong>{formatRM(bestSaving)}</strong> ({bestSavingPct}%) on this cart.{" "}
                      <Link href="/package">Top up RM{TIER_THRESHOLD.Diamond.toLocaleString("en-MY")} in one top-up →</Link>
                    </p>
                  )}
                  <p className="tier-compare-note-guest">
                    {myTier === 0
                      ? "You're on standard (Agent) pricing. Sign in & top up to unlock cheaper member tiers."
                      : "You can pay at a lower (more expensive) tier if you wish — cheaper tiers unlock by topping up."}
                  </p>
                </div>
              )}

              <div className="cart-sum-row total">
                <span>Total</span>
                <strong>{formatRM(total)}</strong>
              </div>
              <button type="button" className="hero-btn primary cart-checkout" onClick={proceed}>Proceed to checkout</button>
              <p className="cart-sum-note">Prices are estimates based on your configuration. Final quote is confirmed at checkout.</p>
            </aside>
          </section>
        )}

        {bookModal && (
          <div className="addr-modal" onClick={(e) => { if (e.target === e.currentTarget) setBookModal(false); }}>
            <div className="addr-panel addr-book">
              <div className="addr-book-top">
                <div className="addr-book-filter">
                  <label>Profile</label>
                  <select value={bookProfile} onChange={(e) => { setBookProfile(e.target.value); setBookPage(1); }}>
                    <option value="">-- Please Select --</option>
                    {profiles.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="addr-book-filter grow">
                  <label>Keywords</label>
                  <input
                    type="text"
                    placeholder="Receiver or Town or State or Postcode"
                    value={bookSearch}
                    onChange={(e) => { setBookSearch(e.target.value); setBookPage(1); }}
                  />
                </div>
                <button type="button" className="addr-book-close" onClick={() => setBookModal(false)} aria-label="Close">✕</button>
              </div>

              <div className="addr-book-tablewrap">
                <table className="addr-book-table">
                  <thead>
                    <tr>
                      <th>Receiver</th>
                      <th>Contact</th>
                      <th>Address</th>
                      <th>Postcode</th>
                      <th>Town</th>
                      <th>State</th>
                      <th className="act-col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookPageItems.map((a) => (
                      <tr key={a.id} className={selectedAddrId === a.id ? "is-selected" : ""}>
                        <td className="rcv">
                          {a.receiver || a.profile}
                          {selectedAddrId === a.id && <span className="addr-tick" title="Selected">✓</span>}
                        </td>
                        <td className="contact">
                          <span>Tel : {a.tel || "-"}</span>
                          <span>Mobile : {a.mobile || "-"}</span>
                        </td>
                        <td className="addr-cell">{[a.address1, a.address2].filter(Boolean).join(", ")}{a.address1 ? ", " : ""}{a.postcode} {a.city}, {a.state}</td>
                        <td>{a.postcode}</td>
                        <td>{a.city}</td>
                        <td>{a.state}</td>
                        <td className="act">
                          <button type="button" className="ic del" onClick={() => deleteAddress(a.id)} aria-label="Delete">🗑</button>
                          <button type="button" className="ic" onClick={() => openEdit(a.id)} aria-label="Edit">✎</button>
                          {selectedAddrId === a.id ? (
                            <span className="addr-current">Selected</span>
                          ) : (
                            <button type="button" className="addr-select-btn" onClick={() => chooseAddress(a.id)}>SELECT</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {bookFiltered.length === 0 && (
                      <tr><td colSpan={7} className="addr-book-empty">No addresses found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="addr-book-foot">
                <div className="addr-book-show">
                  Show
                  <select value={bookPageSize} onChange={(e) => { setBookPageSize(Number(e.target.value)); setBookPage(1); }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  entries
                </div>
                <button type="button" className="addr-book-add" onClick={openAddNew}>+ Add new address</button>
                <div className="addr-book-pager">
                  <button type="button" disabled={bookPg <= 1} onClick={() => setBookPage(bookPg - 1)}>Previous</button>
                  <span className="addr-book-pageinfo">Page {bookPg} of {bookPageCount}</span>
                  <button type="button" disabled={bookPg >= bookPageCount} onClick={() => setBookPage(bookPg + 1)}>Next</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {addrModal && (
          <div className="addr-modal" onClick={(e) => { if (e.target === e.currentTarget) cancelAddr(); }}>
            <div className="addr-panel">
              <h3 className="addr-panel-title">{editingId ? "Edit shipping address" : "Shipping address — West Malaysia"}</h3>
              <form className="addr-form" onSubmit={(e) => { e.preventDefault(); saveAddr(); }}>
                <div className="addr-field">
                  <span className="addr-label">Profile <i>*</i></span>
                  <input type="text" value={addr.profile} onChange={(e) => setField("profile", e.target.value)} required />
                </div>
                <div className="addr-field">
                  <span className="addr-label">Receiver <i>*</i></span>
                  <input type="text" value={addr.receiver} onChange={(e) => setField("receiver", e.target.value)} required />
                </div>
                <div className="addr-field pair">
                  <span className="addr-label">Mobile No. <i>*</i></span>
                  <input type="tel" value={addr.mobile} onChange={(e) => setField("mobile", e.target.value)} required />
                  <span className="addr-label addr-label-inline">Tel</span>
                  <input type="tel" value={addr.tel} onChange={(e) => setField("tel", e.target.value)} />
                </div>
                <div className="addr-field">
                  <span className="addr-label">Address <i>*</i></span>
                  <div className="addr-stack">
                    <input type="text" value={addr.address1} onChange={(e) => setField("address1", e.target.value)} required />
                    <input type="text" value={addr.address2} onChange={(e) => setField("address2", e.target.value)} />
                  </div>
                </div>
                <div className="addr-field pair">
                  <span className="addr-label">Postcode <i>*</i></span>
                  <input type="text" inputMode="numeric" maxLength={5} value={addr.postcode} onChange={(e) => onPostcode(e.target.value)} required />
                  <span className="addr-label addr-label-inline">City <i>*</i></span>
                  <input type="text" value={addr.city} onChange={(e) => setField("city", e.target.value)} required />
                </div>
                <div className="addr-field">
                  <span className="addr-label">State <i>*</i></span>
                  <select value={addr.state} onChange={(e) => setField("state", e.target.value)} required>
                    <option value="">-- Please Select --</option>
                    {WEST_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="addr-actions">
                  <button type="button" className="addr-cancel" onClick={cancelAddr}>CANCEL</button>
                  <button type="submit" className="addr-add">ADD</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
      <Footer />

      <style>{`
        .cart-art { margin-top: 8px; }
        .cart-art-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #35d8ff; cursor: pointer; border: 1px dashed rgba(53,216,255,.5); border-radius: 8px; padding: 5px 10px; }
        .cart-art-btn input { display: none; }
        .cart-art-list { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .cart-art-list li { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .cart-art-list a { color: #9fe6c0; text-decoration: none; word-break: break-all; }
        .cart-art-list button { background: none; border: none; color: #ff8f8f; cursor: pointer; font-size: 12px; }
        .cart-voucher { margin: 10px 0 4px; }
        .cart-voucher .cart-ship-title { display: block; margin-bottom: 8px; }
        .cart-voucher-manual { display: flex; gap: 8px; margin-top: 8px; }
        .cart-voucher-manual input { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(120,160,210,.35); background: rgba(10,23,48,.55); color: #e6eefc; }
        .cart-voucher-manual button { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(53,216,255,.6); background: transparent; color: #35d8ff; font-weight: 700; cursor: pointer; }
        .cart-voucher-hint { font-size: 12.5px; color: #9fb3c8; }
        .cart-voucher-msg { font-size: 12.5px; margin-top: 6px; }
        .cart-voucher-msg.ok { color: #9fe6c0; }
        .cart-voucher-msg.error { color: #ff8f8f; }
        .ckv-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .ckv-opt { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; text-align: left; border: 1px solid rgba(120,160,210,.35); background: rgba(10,23,48,.55); color: #e6eefc; }
        .ckv-opt:hover { border-color: rgba(53,216,255,.7); }
        .ckv-opt.is-active { border-color: #35d8ff; background: rgba(53,216,255,.12); }
        .ckv-off { font-weight: 800; color: #35d8ff; font-size: 15px; min-width: 52px; }
        .ckv-info { display: flex; flex-direction: column; min-width: 0; }
        .ckv-code { font-weight: 700; font-family: ui-monospace, monospace; font-size: 13px; }
        .ckv-scope { font-size: 12px; color: #9fb3c8; }
        .ckv-check { color: #35d8ff; font-weight: 800; }
      `}</style>
    </>
  );
}
