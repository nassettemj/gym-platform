"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LoginState = { error: string } | null;

export async function loginWithSlug(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const gymSlug = String(formData.get("gymSlug") ?? "").trim();

  if (!email || !password) return null;

  let result;
  try {
    result = await signIn("credentials", {
      email,
      password,
      gymSlug,
      redirect: false,
      redirectTo: gymSlug ? `/${gymSlug}/admin` : "/platform/gyms",
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === "CredentialsSignin") {
      return { error: "Invalid email or password." };
    }
    throw err;
  }

  if (!result) return null;
  // Decide final landing page based on role.
  const user = await prisma.user.findFirst({
    where: {
      email,
      ...(gymSlug
        ? {
            gym: {
              slug: gymSlug,
            },
          }
        : {}),
    },
    select: { role: true, memberId: true },
  });

  if (user?.role === "PLATFORM_ADMIN") {
    redirect("/platform/gyms");
  }

  if (gymSlug && user?.role === "GYM_ADMIN") {
    redirect(`/${gymSlug}/admin`);
  }

  if (gymSlug && user?.role === "MEMBER" && user.memberId) {
    redirect(`/${gymSlug}/admin/members/${user.memberId}`);
  }

  if (typeof result === "string") {
    redirect(result);
  }

  const url = (result as { url?: string })?.url;
  if (url) {
    redirect(url);
  }

  return null;
}

