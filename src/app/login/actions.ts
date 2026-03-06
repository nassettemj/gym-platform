"use server";

export type LoginState = { error: string } | null;

// This server action is no longer used; login is handled on the client with next-auth/react.
export async function login(
  _prevState: LoginState,
  _formData: FormData,
): Promise<LoginState> {
  return null;
}
