import NextAuth, { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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

        // Dev-only: quick login when ENABLE_DEV_LOGIN is set (e.g. Vercel preview)
        if (process.env.ENABLE_DEV_LOGIN === "true") {
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
        (session.user as any).id = token.sub;
        (session.user as any).role = (token as any).role;
        (session.user as any).gymId = (token as any).gymId;
        (session.user as any).memberId = (token as any).memberId;
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
