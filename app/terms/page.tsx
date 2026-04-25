import type { Metadata } from "next";
import { PageShell, Prose } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Terms of Service — Moonbag.ai",
  description: "The terms governing your use of Moonbag.ai.",
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms of Service"
      lead="Plain-language terms for using Moonbag.ai. Last updated April 2026."
    >
      <Prose>
        <p>
          These terms govern your access to and use of Moonbag.ai (the
          "Service"). By using the Service — including joining the waitlist —
          you agree to these terms.
        </p>

        <h2>Not financial advice</h2>
        <p>
          <strong>
            Nothing produced by Moonbag.ai is financial, investment, legal, or
            tax advice.
          </strong>{" "}
          The Service provides market intelligence, ratings, and setup
          structures for informational purposes only. All trading decisions and
          their consequences are yours alone.
        </p>

        <h2>Risk disclosure</h2>
        <p>
          Trading crypto, equities, commodities, and derivatives involves
          substantial risk of loss. Past performance of any asset, strategy, or
          rating does not predict future results. Only trade with capital you
          can afford to lose.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>
            You are responsible for keeping your credentials and email secure.
          </li>
          <li>
            You agree to provide accurate information and to use the Service
            lawfully.
          </li>
          <li>
            We may suspend or terminate access for abuse, illegal activity, or
            violation of these terms.
          </li>
        </ul>

        <h2>Acceptable use</h2>
        <p>
          You agree not to reverse-engineer the Service, resell outputs as your
          own trading product, scrape content at abusive rates, or use the
          Service to facilitate market manipulation or other illegal conduct.
        </p>

        <h2>Intellectual property</h2>
        <p>
          Moonbag.ai, its name, logo, ratings methodology, and all software are
          owned by us. You receive a limited, revocable, non-transferable
          license to use the Service for its intended purpose.
        </p>

        <h2>No warranty</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties
          of any kind, whether express or implied. We do not guarantee
          uninterrupted availability, data accuracy, or specific outcomes.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Moonbag.ai and its operators
          will not be liable for indirect, incidental, special, consequential,
          or punitive damages, or for any loss of profits, trades, or data —
          even if advised of the possibility of such damages.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms as the product evolves. Material changes
          will be announced via email to waitlist members. Continued use after
          changes take effect constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:hello@moonbag.ai">hello@moonbag.ai</a>.
        </p>
      </Prose>
    </PageShell>
  );
}
