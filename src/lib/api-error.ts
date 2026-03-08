import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * Wraps an API route handler with standard error handling:
 * - Malformed JSON bodies → 400 "Invalid request body"
 * - Any other unhandled exception → captured by Sentry + 500 "Internal server error"
 *
 * Usage:
 *   export const GET = withHandler(async (request, { params }) => { ... });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withHandler<F extends (...args: any[]) => Promise<Response>>(fn: F): F {
  return (async (...args: Parameters<F>): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }
      Sentry.captureException(err);
      console.error("[API Error]", err instanceof Error ? err.message : String(err));
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }) as F;
}
