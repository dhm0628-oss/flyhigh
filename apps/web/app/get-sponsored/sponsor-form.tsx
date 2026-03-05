"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "../../lib/http";

type FormState = {
  name: string;
  email: string;
  ridingYears: string;
  advancedTricks: string;
  sponsorshipLevel: "Pro" | "Advanced" | "Beginner";
  whyWakeboarding: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  ridingYears: "",
  advancedTricks: "",
  sponsorshipLevel: "Beginner",
  whyWakeboarding: ""
};

export function GetSponsoredForm() {
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
      await apiFetch("/v1/inquiries/sponsorship", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          website: "",
          formStartedAt
        })
      });
      setNotice("Your sponsorship form was sent to david@flyhigh.tv.");
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send sponsorship form");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sponsor-form-wrap">
      <form className="sponsor-form" onSubmit={onSubmit}>
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
          How long have you been riding?
          <input value={form.ridingYears} onChange={(e) => setForm((current) => ({ ...current, ridingYears: e.target.value }))} required />
        </label>
        <label>
          What are a few of the most advanced tricks that you can do?
          <textarea
            value={form.advancedTricks}
            onChange={(e) => setForm((current) => ({ ...current, advancedTricks: e.target.value }))}
            rows={5}
            required
          />
        </label>
        <label>
          What level of sponsorship are you seeking?
          <select
            value={form.sponsorshipLevel}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                sponsorshipLevel: e.target.value as FormState["sponsorshipLevel"]
              }))
            }
          >
            <option value="Pro">Pro</option>
            <option value="Advanced">Advanced</option>
            <option value="Beginner">Beginner</option>
          </select>
        </label>
        <label>
          What do you love about wakeboarding?
          <textarea
            value={form.whyWakeboarding}
            onChange={(e) => setForm((current) => ({ ...current, whyWakeboarding: e.target.value }))}
            rows={6}
            required
          />
        </label>

        {error ? <p className="web-status web-status--error" role="alert" aria-live="polite">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok" role="status" aria-live="polite">{notice}</p> : null}

        <button className="btn btn--header-primary" type="submit" disabled={busy}>
          {busy ? "Sending..." : "Send Application"}
        </button>
      </form>
    </div>
  );
}
