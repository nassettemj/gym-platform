"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

export type SignupState = { error?: string } | null;

export async function register(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const gymSlug = String(formData.get("gymSlug") ?? "").trim();

  if (!email || !password || !gymSlug) {
    return { error: "Email, password, and gym are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
  });

  if (!gym) {
    return { error: "Gym not found for this URL." };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return {
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || null,
      gymId: gym.id,
      role: "MEMBER",
    },
  });

  const nameParts = (name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || email.split("@")[0] || "Member";
  const lastName = nameParts.slice(1).join(" ") || "—";

  const newMember = await prisma.member.create({
    data: {
      gymId: gym.id,
      firstName,
      lastName,
      email,
      memberType: "ADULT",
    },
  });

  await prisma.user.update({
    where: { id: newUser.id },
    data: { memberId: newMember.id },
  });

  let result;
  try {
    result = await signIn("credentials", {
      email,
      password,
      gymSlug,
      redirect: false,
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e?.name === "CredentialsSignin") {
      redirect(`/${gymSlug}/login`);
    }
    throw err;
  }

  if (!result) {
    redirect(`/${gymSlug}/login`);
  }

  redirect(`/${gymSlug}/admin/members/${newMember.id}`);
}

