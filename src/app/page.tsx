"use client";

import { MapPinned } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPinned className="h-5 w-5 text-primary" />
            <span className="text-xl font-extrabold tracking-tighter text-primary">
              Plantain
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Your collaborative trip planner.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            <Image src="/google_icon.png" alt="Google" width={18} height={18} />
            Continue with Google
          </button>

          {errorMessage ? (
            <p className="text-center text-xs text-destructive">{errorMessage}</p>
          ) : null}
        </div>

      </div>
    </div>
  );
}
