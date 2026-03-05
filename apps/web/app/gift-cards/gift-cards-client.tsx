"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/http";

type GiftCardProduct = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  amountUsd: number;
  amountCents: number;
  currency: string;
  durationMonths: number;
  plan: { code: string; name: string; interval: string };
};

export function GiftCardsClient() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<GiftCardProduct[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finalizedSessionId, setFinalizedSessionId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<{ products: GiftCardProduct[] }>("/v1/gift-cards/products", { method: "GET" });
        setProducts(res.products);
        if (res.products[0]) {
          setSelectedCode(res.products[0].code);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load gift card options");
      }
    })();
  }, []);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout === "cancel") {
      setNotice("Gift card checkout was canceled.");
      return;
    }
    if (checkout === "success" && sessionId && finalizedSessionId !== sessionId) {
      setBusy(true);
      setFinalizedSessionId(sessionId);
      void (async () => {
        try {
          const result = await apiFetch<{ code: string }>("/v1/gift-cards/finalize-checkout", {
            method: "POST",
            body: JSON.stringify({ sessionId })
          });
          setNotice(`Gift card purchase completed. Code issued: ${result.code}. The recipient email should receive it shortly.`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to finalize gift card purchase");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    if (checkout === "success") {
      setNotice("Gift card purchase completed. The recipient email should receive the code shortly.");
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<{ checkoutUrl?: string | null }>("/v1/gift-cards/checkout-session", {
        method: "POST",
        body: JSON.stringify({
          productCode: selectedCode,
          purchaserName,
          purchaserEmail,
          recipientName,
          recipientEmail,
          message
        })
      });
      if (!result.checkoutUrl) {
        throw new Error("Gift card checkout URL was not returned");
      }
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start gift card checkout");
      setBusy(false);
    }
  }

  return (
    <div className="gift-cards-layout">
      <div className="gift-card-product-grid">
        {products.map((product) => {
          const isSelected = selectedCode === product.code;
          return (
            <button
              key={product.id}
              type="button"
              className={`gift-card-product ${isSelected ? "is-selected" : ""}`}
              onClick={() => setSelectedCode(product.code)}
            >
              <div className="gift-card-product__price">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.amountUsd)}
              </div>
              <h2>{product.name}</h2>
              <p>{product.description || `${product.durationMonths} month(s) of ${product.plan.name}`}</p>
            </button>
          );
        })}
      </div>

      <div className="contact-form-wrap">
        <form className="contact-form" onSubmit={onSubmit}>
          <h2>Gift card delivery</h2>
          <p className="card__meta">We email the gift card code to the recipient after checkout completes.</p>
          {error ? <p className="web-status web-status--error">{error}</p> : null}
          {notice ? <p className="web-status web-status--ok">{notice}</p> : null}
          <label>Your name
            <input value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} required />
          </label>
          <label>Your email
            <input type="email" value={purchaserEmail} onChange={(e) => setPurchaserEmail(e.target.value)} required />
          </label>
          <label>Recipient name
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </label>
          <label>Recipient email
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
          </label>
          <label>Your message (optional)
            <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enjoy the catalog." />
          </label>
          <button className="btn btn--header-primary" type="submit" disabled={busy || !selectedCode}>
            {busy ? "Starting checkout..." : "Buy Gift Card"}
          </button>
        </form>
      </div>
    </div>
  );
}
