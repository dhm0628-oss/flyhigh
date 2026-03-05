"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/http";

type FormState = {
  name: string;
  email: string;
  inquiryType: "General" | "Billing" | "Technical" | "TV Activation" | "Business";
  message: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  inquiryType: "General",
  message: ""
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [formStartedAt] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/v1/inquiries/contact", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          website: "",
          formStartedAt
        })
      });
      setNotice("Your message was sent to info@flyhigh.tv.");
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send contact form");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-form-wrap">
      <form className="contact-form" onSubmit={onSubmit}>
        <input type="text" name="website" autoComplete="off" tabIndex={-1} style={{ display: "none" }} />
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} required />
        </label>
        <label>
          Inquiry Type
          <select
            value={form.inquiryType}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                inquiryType: e.target.value as FormState["inquiryType"]
              }))
            }
          >
            <option value="General">General</option>
            <option value="Billing">Billing</option>
            <option value="Technical">Technical</option>
            <option value="TV Activation">TV Activation</option>
            <option value="Business">Business</option>
          </select>
        </label>
        <label>
          Your Question
          <textarea
            value={form.message}
            onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
            rows={7}
            required
          />
        </label>

        {error ? <p className="web-status web-status--error" role="alert" aria-live="polite">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok" role="status" aria-live="polite">{notice}</p> : null}

        <button className="btn btn--header-primary" type="submit" disabled={busy}>
          {busy ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}
