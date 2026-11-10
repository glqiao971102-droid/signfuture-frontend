"use client";

import { useEffect, useState } from "react";
import { api, submitToGateway, ApiError, type PaymentInitiation } from "@/lib/api";

/**
 * Public MYR 1.00 iPay88 activation-test checkout.
 *
 * iPay88's risk team is given this URL (https://www.signfuturegroup.com/ipay88-test)
 * to verify the merchant account for activation — it needs no login and no
 * password. The form is submitted FROM this page so the Request URL matches the
 * registered domain (www.signfuturegroup.com). A successful test does NOT credit
 * any wallet (it settles as an order payment with no order).
 */
export default function Ipay88TestPage() {
  const [init, setInit] = useState<PaymentInitiation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .ipay88Test()
      .then(setInit)
      .catch((e) =>
        setError(
          e instanceof ApiError
            ? e.message
            : "Could not start the iPay88 test. Please try again.",
        ),
      );
  }, []);

  function pay() {
    if (!init) return;
    setBusy(true);
    submitToGateway(init);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f6fa",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 28,
          textAlign: "center",
          color: "#1a1a2e",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Sign Future" style={{ height: 40, margin: "0 auto 18px" }} />

        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Payment Verification</h1>
        <p style={{ fontSize: 13.5, color: "#6b7280", margin: "0 0 20px" }}>
          iPay88 online payment test item
        </p>

        <div
          style={{
            border: "1px solid #e6e6ee",
            borderRadius: 10,
            padding: "14px 16px",
            textAlign: "left",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>iPay88 Activation Test</span>
            <strong>RM 1.00</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 13 }}>
            <span>Shipping fee</span>
            <span>RM 0.00</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid #eee",
              marginTop: 10,
              paddingTop: 10,
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span>RM 1.00</span>
          </div>
        </div>

        {error ? (
          <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>
        ) : (
          <button
            type="button"
            onClick={pay}
            disabled={!init || busy}
            style={{
              width: "100%",
              padding: "13px 16px",
              border: "none",
              borderRadius: 10,
              background: init && !busy ? "#6d28d9" : "#b7a7e6",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: init && !busy ? "pointer" : "default",
            }}
          >
            {busy ? "Redirecting to iPay88…" : init ? "Pay RM 1.00 with iPay88" : "Loading…"}
          </button>
        )}

        <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 16 }}>
          Secure payment via iPay88 (NTT DATA). This is a MYR 1.00 verification item.
        </p>
      </div>
    </main>
  );
}
