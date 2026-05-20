"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email }),
    });
    // Always show success to prevent email enumeration
    setSubmitted(true);
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
          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
              <h1 className="text-xl font-semibold text-white">Check your email</h1>
              <p className="mt-2 text-sm text-white/60">
                If that address is registered, you&apos;ll receive a password reset link
                within a few minutes.
              </p>
              <a
                href="/login"
                className="mt-6 inline-block text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                ← Back to sign in
              </a>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-semibold text-white">Forgot Password</h1>
                <p className="mt-1 text-sm text-white/60">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <a
                  href="/login"
                  className="text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  ← Back to sign in
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
