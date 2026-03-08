import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types/auth";

export type { AuthUser };

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Optional; used by custom per-gym login pages.
        gymSlug: { label: "Gym Slug", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        const gymSlug = String((credentials as any).gymSlug ?? "").trim();

        // Dev-only: quick login in development or when ENABLE_DEV_LOGIN is set (e.g. Vercel preview)
        const allowDevLogin =
          process.env.ENABLE_DEV_LOGIN === "true" ||
          process.env.NODE_ENV === "development";
        if (allowDevLogin) {
          if (email.toLowerCase() === "sup") {
            const platformAdmin = await prisma.user.findFirst({
              where: { role: "PLATFORM_ADMIN" },
            });
            if (platformAdmin) {
              return {
                id: platformAdmin.id,
                email: platformAdmin.email,
                name: platformAdmin.name,
                role: platformAdmin.role,
                gymId: platformAdmin.gymId,
                memberId: platformAdmin.memberId,
              };
            }
          }
          if (email === "__dev_admin__" && gymSlug) {
            const user = await prisma.user.findFirst({
              where: {
                role: "GYM_ADMIN",
                gym: { slug: gymSlug },
              },
            });
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                gymId: user.gymId,
                memberId: user.memberId,
              };
            }
          }
          if (email === "__dev_instructor__" && gymSlug) {
            const user = await prisma.user.findFirst({
              where: {
                role: "INSTRUCTOR",
                gym: { slug: gymSlug },
              },
            });
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                gymId: user.gymId,
                memberId: user.memberId,
              };
            }
          }
          if (email === "__dev_location_admin__" && gymSlug) {
            const user = await prisma.user.findFirst({
              where: {
                role: "LOCATION_ADMIN",
                gym: { slug: gymSlug },
              },
            });
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                gymId: user.gymId,
                memberId: user.memberId,
              };
            }
          }
          if (email === "__dev_staff__" && gymSlug) {
            const user = await prisma.user.findFirst({
              where: {
                role: "STAFF",
                gym: { slug: gymSlug },
              },
            });
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                gymId: user.gymId,
                memberId: user.memberId,
              };
            }
          }
          if (
            (email === "__dev_member__" || email === "__dev_random_member__") &&
            gymSlug
          ) {
            const members = await prisma.user.findMany({
              where: {
                role: "MEMBER",
                memberId: { not: null },
                gym: { slug: gymSlug },
              },
              take: 20,
            });
            const user = members[Math.floor(Math.random() * members.length)];
            if (user) {
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                gymId: user.gymId,
                memberId: user.memberId,
              };
            }
          }
        }

        if (!email || !password) return null;

        const user = gymSlug
          ? await prisma.user.findFirst({
              where: {
                email,
                gym: {
                  slug: gymSlug,
                },
              },
            })
          : await prisma.user.findUnique({
              where: { email },
            });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          gymId: user.gymId,
          memberId: user.memberId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        (token as any).gymId = (user as any).gymId;
        (token as any).memberId = (user as any).memberId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as AuthUser;
        u.id = token.sub ?? "";
        u.role = (token as { role?: AuthUser["role"] }).role ?? null;
        u.gymId = (token as { gymId?: string }).gymId ?? null;
        u.memberId = (token as { memberId?: string }).memberId ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export function auth() {
  return getServerSession(authOptions);
}
