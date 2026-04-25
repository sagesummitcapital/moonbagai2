import type { Metadata } from "next";
import { PageShell, Prose } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Moonbag.ai",
  description:
    "How Moonbag.ai collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      lead="We keep this short and readable. Last updated April 2026."
    >
      <Prose>
        <p>
          Moonbag.ai ("Moonbag", "we", "us") is building an AI market
          intelligence and execution layer. This policy describes what we
          collect, why we collect it, and the controls you have over your data.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Waitlist email.</strong> When you join our waitlist, we
            store the email address you provide and a short "source" tag (e.g.{" "}
            <em>hero</em>, <em>beta</em>) so we know where signups come from.
          </li>
          <li>
            <strong>Product usage (future).</strong> When early access launches,
            we will record feature usage, performance metrics, and errors so we
            can improve the product.
          </li>
          <li>
            <strong>Technical data.</strong> Standard server logs (IP address,
            user agent, timestamps) retained for a short window to protect the
            service.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To send you a one-time waitlist confirmation email.</li>
          <li>
            To notify you when early access opens, and occasionally to share
            progress updates.
          </li>
          <li>To operate, secure, and improve the Moonbag.ai product.</li>
        </ul>

        <h2>What we don't do</h2>
        <ul>
          <li>We don't sell your data.</li>
          <li>We don't share your email with third-party advertisers.</li>
          <li>
            We don't execute trades, transfer funds, or access your exchange
            accounts without explicit, revocable consent.
          </li>
        </ul>

        <h2>Third parties</h2>
        <p>
          We use a small number of trusted infrastructure providers to run the
          service:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — stores waitlist emails.
          </li>
          <li>
            <strong>Resend</strong> — sends confirmation emails.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website.
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can request access, correction, export, or deletion of your data
          at any time. Email{" "}
          <a href="mailto:privacy@moonbag.ai">privacy@moonbag.ai</a> and we'll
          respond within a reasonable window.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Reach us at{" "}
          <a href="mailto:hello@moonbag.ai">hello@moonbag.ai</a>.
        </p>
      </Prose>
    </PageShell>
  );
}
