import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Ascend Foods Pvt Ltd collects, uses, and protects your information, including data processed through our WhatsApp Business messaging.",
  alternates: {
    canonical: "/privacy-policy"
  }
};

const lastUpdated = "June 4, 2026";

export default function PrivacyPolicy() {
  return (
    <div className="ascend-marketing privacy-page">
      <Navbar />
      <main id="main">
        <section className="section-pad py-16 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Last updated: {lastUpdated}
            </p>

            <div className="mt-10 space-y-10 text-base leading-relaxed text-slate-700">
              <p>
                This Privacy Policy explains how Ascend Foods, a proprietorship
                firm (&quot;Ascend&quot;, &quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;), collects, uses, shares, and protects information
                when you use our website, platform, and services, including
                communications you exchange with us over WhatsApp. By using our
                services or messaging us on WhatsApp, you agree to the practices
                described in this policy.
              </p>

            <Section title="1. Who We Are">
              <p>
                Ascend Foods is a proprietorship firm providing data-driven
                FMCG distribution and go-to-market intelligence services in
                India. We operate a
                platform used by brands, distributors, retailers, and field
                sales teams to manage orders, distribution, and related
                operations.
              </p>
              <p className="mt-3">
                For any privacy-related questions, you can reach us at{" "}
                <a
                  href="mailto:pranshu@ascendfoods.in"
                  className="font-semibold text-[color:var(--color-accent-strong)] hover:underline"
                >
                  pranshu@ascendfoods.in
                </a>
                .
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We may collect the following categories of information:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  <strong>Contact information</strong> — name, business name,
                  phone number (including your WhatsApp number), and email
                  address.
                </li>
                <li>
                  <strong>Account and profile information</strong> — login
                  credentials, role, and organization details for users of our
                  platform.
                </li>
                <li>
                  <strong>Business and transaction data</strong> — orders,
                  invoices, outlet and retailer details, inventory, and other
                  operational records you submit to the platform.
                </li>
                <li>
                  <strong>WhatsApp messaging data</strong> — the content of
                  messages, media, and other information you send to or receive
                  from us through WhatsApp, along with associated metadata such
                  as timestamps and delivery status.
                </li>
                <li>
                  <strong>Technical and usage data</strong> — IP address,
                  device and browser type, and how you interact with our website
                  and platform.
                </li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Provide, operate, and improve our platform and services.</li>
                <li>
                  Communicate with you over WhatsApp and other channels,
                  including order confirmations, delivery updates, account
                  notifications, support, and service-related messages.
                </li>
                <li>
                  Process orders, manage distribution, and fulfil our business
                  operations.
                </li>
                <li>
                  Respond to your enquiries, requests, and support tickets.
                </li>
                <li>
                  Maintain the security, integrity, and reliability of our
                  services.
                </li>
                <li>Comply with legal and regulatory obligations.</li>
              </ul>
            </Section>

            <Section title="4. WhatsApp Business Messaging">
              <p>
                We use the WhatsApp Business Platform to communicate with our
                customers and partners. When you message us on WhatsApp, your
                messages are processed in accordance with this Privacy Policy
                and with WhatsApp&apos;s own terms and policies.
              </p>
              <p className="mt-3">
                We only send WhatsApp messages to recipients who have provided
                their phone number and opted in to receive communications from
                us, or where otherwise permitted under WhatsApp&apos;s policies.
                You can opt out at any time by replying &quot;STOP&quot; or by
                contacting us at{" "}
                <a
                  href="mailto:pranshu@ascendfoods.in"
                  className="font-semibold text-[color:var(--color-accent-strong)] hover:underline"
                >
                  pranshu@ascendfoods.in
                </a>
                . We do not use WhatsApp message content for advertising
                purposes, and we do not sell your WhatsApp data.
              </p>
            </Section>

            <Section title="5. How We Share Information">
              <p>
                We do not sell your personal information. We may share
                information with:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  <strong>Service providers</strong> who help us operate our
                  business, such as cloud hosting, messaging infrastructure
                  (including Meta Platforms / WhatsApp), and analytics providers,
                  under appropriate confidentiality obligations.
                </li>
                <li>
                  <strong>Business partners</strong> such as brands and
                  distributors, only as necessary to fulfil orders and provide
                  our services.
                </li>
                <li>
                  <strong>Legal and regulatory authorities</strong> when
                  required by applicable law or to protect our rights, users, or
                  the public.
                </li>
              </ul>
            </Section>

            <Section title="6. Data Retention">
              <p>
                We retain your information for as long as necessary to provide
                our services, fulfil the purposes described in this policy,
                comply with our legal obligations, resolve disputes, and enforce
                our agreements. When information is no longer needed, we securely
                delete or anonymize it.
              </p>
            </Section>

            <Section title="7. Data Security">
              <p>
                We implement reasonable technical and organizational measures to
                protect your information against unauthorized access, loss,
                misuse, or alteration. However, no method of transmission or
                storage is completely secure, and we cannot guarantee absolute
                security.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p>
                Subject to applicable law, you may have the right to access,
                correct, update, or delete your personal information, and to
                withdraw consent for certain processing. To exercise these
                rights, contact us at{" "}
                <a
                  href="mailto:pranshu@ascendfoods.in"
                  className="font-semibold text-[color:var(--color-accent-strong)] hover:underline"
                >
                  pranshu@ascendfoods.in
                </a>
                . We will respond in accordance with applicable law.
              </p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>
                Our services are intended for businesses and individuals aged 18
                and over. We do not knowingly collect personal information from
                children.
              </p>
            </Section>

            <Section title="10. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do,
                we will revise the &quot;Last updated&quot; date at the top of
                this page. We encourage you to review this policy periodically.
              </p>
            </Section>

            <Section title="11. Contact Us">
              <p>
                If you have any questions or concerns about this Privacy Policy
                or our handling of your information, please contact us:
              </p>
              <p className="mt-3">
                <strong>Ascend Foods</strong> (Proprietorship Firm)
                <br />
                Khasra No. 1046/3, Wazirabad Marg,
                <br />
                Gurugram, Haryana 122003, India
                <br />
                GSTIN: 06DLXPB3523G1Z3
                <br />
                Phone: +91 78916 61335
                <br />
                Email:{" "}
                <a
                  href="mailto:pranshu@ascendfoods.in"
                  className="font-semibold text-[color:var(--color-accent-strong)] hover:underline"
                >
                  pranshu@ascendfoods.in
                </a>
              </p>
            </Section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
