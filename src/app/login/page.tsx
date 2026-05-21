import { LoginClient } from "./_components/login-client";
import type { AuthMode } from "@/lib/auth";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  const authMode: AuthMode =
    (process.env.AUTH_MODE as AuthMode | undefined) ?? "credentials";

  return <LoginClient authMode={authMode} />;
}

