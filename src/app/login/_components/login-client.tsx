"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import type { AuthMode } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface Props {
  authMode: AuthMode;
}

export function LoginClient({ authMode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [serverError, setServerError] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  const showCredentials = authMode === "credentials" || authMode === "both";
  const showSso = authMode === "sso" || authMode === "both";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      setServerError("Invalid email or password. Please try again.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleSsoSignIn() {
    setSsoLoading(true);
    await signIn("microsoft-entra-id", { callbackUrl });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#001245] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/kirby_learning_academy_logo.png"
            alt="Kirby Learning Academy"
            width={240}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">Sign In</h1>
            <p className="mt-1 text-sm text-white/60">
              Welcome back to Kirby Learning Academy
            </p>
          </div>

          {/* SSO button */}
          {showSso && (
            <div className={showCredentials ? "mb-5" : undefined}>
              <Button
                type="button"
                onClick={handleSsoSignIn}
                disabled={ssoLoading}
                className="w-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                variant="outline"
              >
                {ssoLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  /* Microsoft logo SVG */
                  <svg
                    className="mr-2 h-4 w-4 shrink-0"
                    viewBox="0 0 21 21"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                )}
                {ssoLoading ? "Redirecting…" : "Sign in with Microsoft"}
              </Button>
            </div>
          )}

          {/* Divider between SSO and credentials */}
          {showSso && showCredentials && (
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30">or sign in with password</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          )}

          {/* Credentials form */}
          {showCredentials && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {serverError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {serverError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/80">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@kirbycorp.com"
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-0"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/80">
                    Password
                  </Label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-0"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          © {new Date().getFullYear()} Kirby Corporation. All rights reserved.
        </p>
      </div>
    </div>
  );
}
