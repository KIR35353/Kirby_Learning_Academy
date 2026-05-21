import { Suspense } from "react";
import { LoginClient } from "./_components/login-client";
import type { AuthMode } from "@/lib/auth";

export const metadata = { title: "Sign In" };

/**
 * Server component — reads AUTH_MODE from the environment and passes it to
 * the client component. The value never reaches the browser as a raw env var.
 *
 * AUTH_MODE values:
 *   credentials  — email/password form only (default)
 *   sso          — Microsoft Entra ID SSO button only
 *   both         — show both options
 */
export default function LoginPage() {
  const authMode: AuthMode =
    (process.env.AUTH_MODE as AuthMode | undefined) ?? "credentials";

  return (
    <Suspense>
      <LoginClient authMode={authMode} />
    </Suspense>
  );
}

