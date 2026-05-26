"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

/**
 * Server action for credentials sign-in.
 * Using a server action bypasses the cookie-based CSRF check that the
 * client-side `signIn()` from `next-auth/react` relies on, which fails
 * when running behind an nginx reverse proxy with `__Host-` cookies.
 *
 * On success: throws a Next.js redirect (handled transparently by the framework).
 * On failure: returns the AuthError type string (e.g. "CredentialsSignin").
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  callbackUrl: string,
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type;
    }
    // Re-throw Next.js redirect errors so the framework handles navigation
    throw error;
  }
}
