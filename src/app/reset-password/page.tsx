"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: values.password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        (data as { error?: string }).error ??
          "This reset link is invalid or has expired.",
      );
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#001245] px-4">
        <p className="text-white/60">Invalid reset link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#001245] px-4">
      <div className="w-full max-w-md">
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

        <div className="rounded-xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
              <h1 className="text-xl font-semibold text-white">Password Updated</h1>
              <p className="mt-2 text-sm text-white/60">
                Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-semibold text-white">Reset Password</h1>
                <p className="mt-1 text-sm text-white/60">
                  Choose a new password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                {serverError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {serverError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-white/80">
                    New Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-0"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-white/80">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    className="border-white/20 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-white/40 focus-visible:ring-0"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-400">
                      {errors.confirmPassword.message}
                    </p>
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
                      Updating…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
