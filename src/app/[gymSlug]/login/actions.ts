"use server";

export type LoginState = { error: string } | null;

export async function loginWithSlug(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  return null;
}

