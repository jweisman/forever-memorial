import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Fonts are self-hosted via next/font/google (no external CDN at runtime).
// S3 presigned URLs are HTTPS but on a variable hostname, so img/media/connect
// use 'https:' rather than a hardcoded origin. Script and style sources are kept
// strict; 'unsafe-inline' is required by Next.js App Router hydration scripts.
// In development, MinIO runs on http://localhost:9000 so http://localhost:* is added.
const isDev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${isDev ? " http://localhost:*" : ""}`,
  "font-src 'self' data:",
  `media-src 'self' blob: https:${isDev ? " http://localhost:*" : ""}`,
  // 'self' for API routes; https: covers S3 presigned uploads and Sentry
  `connect-src 'self' https:${isDev ? " http://localhost:*" : ""}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Google OAuth sign-in posts to accounts.google.com
  "form-action 'self' https://accounts.google.com",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pdfkit"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress sourcemap upload output during local builds
  silent: !process.env.CI,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Keep source maps out of the client bundle
  hideSourceMaps: true,
  // Remove Sentry debug logging from the bundle (replaces deprecated disableLogger)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
