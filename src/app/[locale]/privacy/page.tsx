import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – Leolam Forever",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <article className="space-y-6 text-warm-700">
        <header>
          <h1 className="font-heading text-3xl font-bold text-warm-800">
            Privacy Policy
          </h1>
          <p className="mt-1 text-sm text-warm-400">
            Effective Date: April 9, 2026
          </p>
        </header>

        <p>
          Welcome to <strong>Leolam Forever</strong>. Your privacy is important
          to us. This Privacy Policy explains what information we collect, how we
          use it, and your rights.
        </p>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            1. Information We Collect
          </h2>

          <h3 className="font-heading text-lg font-medium text-warm-700">
            a. Information You Provide
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>Name (including Hebrew name, if provided)</li>
            <li>Email address</li>
            <li>Content you upload (memories, photos, stories, locations)</li>
            <li>Account profile details</li>
          </ul>

          <h3 className="font-heading text-lg font-medium text-warm-700">
            b. Automatically Collected Information
          </h3>
          <ul className="list-disc space-y-1 pl-6">
            <li>IP address</li>
            <li>Browser type and device information</li>
            <li>Usage data (pages visited, interactions)</li>
          </ul>

          <h3 className="font-heading text-lg font-medium text-warm-700">
            c. Information from Third Parties (OAuth)
          </h3>
          <p>
            If you sign in using Google or another provider, we may receive your
            name, email address, and profile picture (if available).
          </p>
          <p>
            We use this information{" "}
            <strong>only for authentication and account access</strong>. We do
            not use Google user data for any other purpose.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            2. How We Use Information
          </h2>
          <p>We use your information to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Provide and operate the website</li>
            <li>Create and manage user accounts</li>
            <li>
              Display memorial (&ldquo;legacy&rdquo;) pages and associated
              content
            </li>
            <li>Enable sharing</li>
            <li>Communicate with you (including support)</li>
            <li>Improve the service</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            3. Public Content
          </h2>
          <p>
            Leolam Forever is designed as a public memorial platform. Legacy
            pages and their content are <strong>public by default</strong>.
            Content may be <strong>indexed by search engines</strong> (e.g.,
            Google). Information you upload may be visible to anyone on the
            internet.
          </p>
          <p>
            Please consider this before sharing personal or sensitive
            information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            4. Sharing of Information
          </h2>
          <p>
            We <strong>do not sell your personal data</strong>.
          </p>
          <p>We may share information:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>With service providers (hosting, analytics, email delivery)</li>
            <li>When required by law</li>
            <li>To protect rights, safety, or prevent abuse</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            5. Content Responsibility
          </h2>
          <p>You are responsible for the content you upload.</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              You should only upload content you have the right to share
            </li>
            <li>
              You should avoid sharing personal information about living
              individuals without their consent
            </li>
          </ul>
          <p>
            We may review, remove, or restrict content at our discretion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            6. Data Storage and Security
          </h2>
          <p>
            We take reasonable measures to protect your information. However, no
            system is completely secure. Data may be stored on servers located in
            various jurisdictions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            7. Your Rights
          </h2>
          <p>You may:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Access or update your information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Contact us with privacy concerns</li>
          </ul>
          <p>
            To do so, email:{" "}
            <a
              href="mailto:leolamforever@gmail.com"
              className="text-accent hover:underline"
            >
              leolamforever@gmail.com
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            8. Children&apos;s Privacy
          </h2>
          <p>
            Leolam Forever is not intended for children under 13, and we do not
            knowingly collect data from them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            9. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Continued use
            of the site means you accept the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            10. Contact Us
          </h2>
          <p>
            If you have questions, contact us at:{" "}
            <a
              href="mailto:leolamforever@gmail.com"
              className="text-accent hover:underline"
            >
              leolamforever@gmail.com
            </a>
          </p>
        </section>
      </article>
    </div>
  );
}
