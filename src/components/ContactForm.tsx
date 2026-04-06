"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-warm-800 placeholder-warm-400 transition-colors focus:border-accent focus:outline-none";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; theme?: string },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export default function ContactForm() {
  const t = useTranslations("About");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Turnstile
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) return;

    function renderWidget() {
      if (!window.turnstile || !turnstileRef.current) return;
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey!,
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        theme: "light",
      });
    }

    // If script already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load Turnstile script
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }, [siteKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
        turnstileToken: turnstileToken || undefined,
      }),
    });

    if (res.ok) {
      setSent(true);
    } else {
      const data = await res.json();
      setError(data.error || t("sendError"));
      // Reset turnstile on failure
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="py-8 text-center">
        <p className="font-heading text-lg font-semibold text-warm-800">
          {t("sentTitle")}
        </p>
        <p className="mt-2 text-sm text-muted">{t("sentDescription")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from real users */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-warm-700">
            {t("nameLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-warm-700">
            {t("emailLabel")} <span className="text-red-500">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            placeholder={t("emailPlaceholder")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-warm-700">
          {t("subjectLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className={inputClass}
          placeholder={t("subjectPlaceholder")}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-warm-700">
          {t("messageLabel")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          className={inputClass}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      {siteKey && <div ref={turnstileRef} className="mt-2" />}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={sending || (!!siteKey && !turnstileToken)}
        >
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
}
