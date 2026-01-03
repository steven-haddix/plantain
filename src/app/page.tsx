"use client";

import { AuthView } from "@neondatabase/neon-js/auth/react/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth/client";
import posthog from "posthog-js";

export default function Home() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const hasIdentified = useRef(false);

  useEffect(() => {
    if (data?.session && !hasIdentified.current) {
      hasIdentified.current = true;
      // Identify user in PostHog when they sign in
      posthog.identify(data.user.id, {
        email: data.user.email,
        name: data.user.name,
      });
      posthog.capture("user_signed_in", {
        method: "google_oauth",
      });
      router.push("/dashboard");
    }
  }, [data, router]);

  if (isPending || data?.session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            Plantain
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Sign in to access your workouts.
          </p>
        </div>
        <div className="mt-8 w-full flex justify-center">
          <AuthView path="signin" />
        </div>
      </div>
    </div>
  );
}
