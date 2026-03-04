"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export type LoginState = { error: string } | null;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) return null;

  let result;
  try {
    result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: "/platform/gyms",
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === "CredentialsSignin") {
      return { error: "Invalid email or password." };
    }
    throw err;
  }

  if (!result) return null;

  if (typeof result === "string") {
    redirect(result);
  }

  const url = (result as { url?: string })?.url;
  if (url) {
    redirect(url);
  }

  return null;
}
