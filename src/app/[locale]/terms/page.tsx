import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use – Leolam Forever",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <article className="space-y-6 text-warm-700">
        <header>
          <h1 className="font-heading text-3xl font-bold text-warm-800">
            Terms of Use
          </h1>
          <p className="mt-1 text-sm text-warm-400">
            Effective Date: April 9, 2026
          </p>
        </header>

        <p>
          Welcome to <strong>Leolam Forever</strong>. By using our website, you
          agree to the following terms.
        </p>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            1. Use of the Service
          </h2>
          <p>
            Leolam Forever provides a platform to create and share memorial
            (&ldquo;legacy&rdquo;) pages. You agree to use the service
            respectfully and in accordance with all applicable laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            2. Ownership of Pages
          </h2>
          <p>
            Each legacy page is owned and managed by a single user account. We
            reserve the right, at our discretion, to{" "}
            <strong>transfer ownership of a page</strong>, including in cases
            such as family requests or disputes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            3. User Content
          </h2>
          <p>
            You retain ownership of content you upload, including text, photos,
            names, and biographical details.
          </p>
          <p>
            By uploading content, you grant Leolam Forever a non-exclusive
            license to host, display, and share the content as part of the
            service.
          </p>
          <p>
            You are responsible for ensuring you have the right to upload any
            content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            4. Public Nature of the Service
          </h2>
          <p>Legacy pages are:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Public by default</strong>
            </li>
            <li>
              <strong>Searchable and indexable by search engines</strong>
            </li>
          </ul>
          <p>
            You should not upload content you do not wish to be publicly
            available.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            5. Acceptable Use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Post false, misleading, or harmful content</li>
            <li>Violate privacy or rights of others</li>
            <li>Upload illegal or abusive material</li>
            <li>
              Share personal information about living individuals without
              appropriate consent
            </li>
            <li>Attempt to disrupt or hack the service</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            6. Moderation and Removal
          </h2>
          <p>
            We reserve the right to remove or edit content, suspend or terminate
            accounts, and restrict access to pages. This includes cases
            involving violations of these terms, privacy concerns, disputes
            regarding accuracy, or family objections.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            7. Account Deletion
          </h2>
          <p>
            If you delete your account, legacy pages and associated content
            created by your account will be <strong>deleted</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            8. Requests for Removal or Correction
          </h2>
          <p>We understand the sensitive nature of memorial content.</p>
          <p>
            We may, at our discretion, review and respond to reasonable requests
            to remove content, correct inaccuracies, or address family concerns.
          </p>
          <p>
            Requests can be sent to:{" "}
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
            9. Privacy
          </h2>
          <p>
            Your use of the service is also governed by our{" "}
            <a href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            10. Third-Party Services
          </h2>
          <p>
            We may use third-party services (e.g., Google login). We are not
            responsible for their policies or behavior.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            11. Disclaimer
          </h2>
          <p>
            The service is provided <strong>&ldquo;as is&rdquo;</strong> without
            warranties of any kind. We do not guarantee continuous availability,
            error-free operation, or accuracy of user-generated content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            12. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Leolam Forever is not liable
            for loss of data, damages arising from use of the service, or
            user-generated content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            13. Termination
          </h2>
          <p>
            We may suspend or terminate access if you violate these terms. You
            may stop using the service at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            14. Changes to Terms
          </h2>
          <p>
            We may update these Terms. Continued use of the service means you
            accept the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold text-warm-800">
            15. Contact
          </h2>
          <p>
            For questions, contact:{" "}
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
