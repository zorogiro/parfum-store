"use server";

import { AuthError } from "next-auth";
import { loginSchema } from "@/lib/validators/auth";
import { t } from "@/lib/strings";
import { signIn, signOut } from "@/server/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  // Same generic message as a wrong password, so nothing about accounts leaks.
  if (!parsed.success) return { error: t.admin.login.invalid };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      return { error: code === "rate_limited" ? t.admin.login.rateLimited : t.admin.login.invalid };
    }
    throw error; // the redirect on success
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
