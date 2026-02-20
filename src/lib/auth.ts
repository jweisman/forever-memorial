import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

// In development, log magic link to console instead of sending email
const devMailTransport = {
  host: "localhost",
  port: 25,
  auth: { user: "", pass: "" },
  // This will fail to send, but we capture the link in sendVerificationRequest
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Nodemailer({
      server: process.env.EMAIL_SERVER ?? devMailTransport,
      from: process.env.SES_FROM_EMAIL || "Forever <noreply@forever.local>",
      ...(process.env.NODE_ENV !== "production"
        ? {
            sendVerificationRequest: async ({ identifier, url }) => {
              console.log("\n========================================");
              console.log("  MAGIC LINK for", identifier);
              console.log("  ", url);
              console.log("========================================\n");
            },
          }
        : {}),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        // Look up role from DB
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "USER";

        // Auto-promote admin by email
        if (
          process.env.ADMIN_EMAIL &&
          user.email === process.env.ADMIN_EMAIL
        ) {
          token.role = "ADMIN";
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
        }
      }

      // Handle client-side session updates (e.g. name change)
      if (trigger === "update" && session?.name !== undefined) {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
