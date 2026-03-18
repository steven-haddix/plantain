"use client";

import { ArrowRight, MapPinned } from "lucide-react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export default function Home() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const hasIdentified = useRef(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data && !hasIdentified.current) {
      hasIdentified.current = true;
      posthog.identify(data.user.id, {
        email: data.user.email,
        name: data.user.name,
      });
      posthog.capture("user_signed_in", {
        method: "google_oauth",
      });
      router.replace("/dashboard");
    }
  }, [data, router]);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsSigningIn(true);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });

    if (result.error) {
      setIsSigningIn(false);
      setErrorMessage("Google sign-in could not be started.");
    }
  };

  if (isPending || data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_60%_30%,oklch(0.96_0.05_85),transparent_52%),linear-gradient(135deg,oklch(0.97_0.02_90),oklch(0.92_0.03_75))]">
      {/* Soft ambient blobs */}
      <div className="pointer-events-none absolute right-[15%] top-[12%] h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[14%] left-[12%] h-36 w-36 rounded-full bg-accent/30 blur-3xl" />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-3xl border border-white/60 bg-white/85 px-10 py-12 shadow-[0_16px_56px_rgba(40,35,20,0.13)] backdrop-blur-xl">

        {/* Brand pill */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-foreground px-3.5 py-1.5">
          <MapPinned className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-background">
            Plantain
          </span>
        </div>

        {/* Heading + tagline */}
        <h1 className="text-[2rem] font-black leading-none tracking-[-0.045em] text-foreground">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your collaborative trip planner.
        </p>

        {/* Sign-in button */}
        <div className="mt-8 space-y-3">
          <Button
            className="h-12 w-full justify-between rounded-2xl px-5 text-sm font-semibold"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            <span>Continue with Google</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
