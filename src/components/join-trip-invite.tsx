"use client";

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPinned,
  ShieldQuestion,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type InvitePreview =
  | { status: "invalid" }
  | {
      status: "pending" | "accepted" | "revoked";
      invite: {
        id: string;
        tripId: string;
        email: string;
        normalizedEmail: string;
        role: "member";
        token: string;
        createdAt: string;
        acceptedAt: string | null;
        revokedAt: string | null;
        tripTitle: string | null;
        startDate: string | null;
        endDate: string | null;
        partySize: number | null;
        inviter: {
          id: string | null;
          name: string | null;
          email: string | null;
          avatarUrl: string | null;
        };
        acceptedBy: {
          id: string | null;
          name: string | null;
          email: string | null;
        } | null;
      };
    };

const formatTripDates = (startDate?: string | null, endDate?: string | null) => {
  if (!startDate && !endDate) {
    return "Dates still flexible";
  }

  if (startDate && endDate) {
    return `${new Date(startDate).toLocaleDateString()} - ${new Date(
      endDate,
    ).toLocaleDateString()}`;
  }

  return startDate
    ? `Starts ${new Date(startDate).toLocaleDateString()}`
    : `Ends ${new Date(endDate!).toLocaleDateString()}`;
};

export function JoinTripInvite({ token }: { token: string }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStartingSignIn, setIsStartingSignIn] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const attemptedAutoSignInRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const response = await fetch(
          `/api/trip-invitations/${encodeURIComponent(token)}`,
          {
            credentials: "include",
          },
        );

        const data = (await response.json()) as InvitePreview;
        if (cancelled) return;
        setPreview(data);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setPreview({ status: "invalid" });
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const inviteDetails =
    preview && preview.status !== "invalid" ? preview.invite : null;
  const invitedEmail = inviteDetails?.email ?? null;
  const normalizedInvitedEmail = inviteDetails?.normalizedEmail ?? null;
  const normalizedSessionEmail = useMemo(
    () => session?.user.email?.trim().toLowerCase() ?? null,
    [session?.user.email],
  );
  const isEmailMatch =
    Boolean(normalizedInvitedEmail) &&
    Boolean(normalizedSessionEmail) &&
    normalizedInvitedEmail === normalizedSessionEmail;

  const startGoogleSignIn = async () => {
    setActionError(null);
    setIsStartingSignIn(true);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `/join/${encodeURIComponent(token)}`,
    });

    if (result.error) {
      setIsStartingSignIn(false);
      setActionError("Google sign-in could not be started.");
      attemptedAutoSignInRef.current = false;
    }
  };

  useEffect(() => {
    if (
      isLoadingPreview ||
      isSessionPending ||
      preview?.status !== "pending" ||
      session ||
      attemptedAutoSignInRef.current
    ) {
      return;
    }

    attemptedAutoSignInRef.current = true;
    void startGoogleSignIn();
  }, [isLoadingPreview, isSessionPending, preview, session]);

  const handleSwitchAccount = async () => {
    setActionError(null);
    attemptedAutoSignInRef.current = false;
    await authClient.signOut();
    await startGoogleSignIn();
  };

  const handleAccept = async () => {
    if (!preview || preview.status !== "pending" || !isEmailMatch || isAccepting) {
      return;
    }

    setActionError(null);
    setIsAccepting(true);
    try {
      const response = await fetch(
        `/api/trip-invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json()) as {
        error?: string;
        redirectUrl?: string;
      };

      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.error ?? "Unable to accept invitation.");
      }

      router.replace(data.redirectUrl);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to accept invitation.",
      );
      setIsAccepting(false);
    }
  };

  const openTrip = () => {
    if (!preview || preview.status === "invalid") {
      return;
    }

    router.replace(
      `/dashboard?trip=${encodeURIComponent(preview.invite.tripId)}&chat=team`,
    );
  };

  if (isLoadingPreview || !preview) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading invitation...
        </div>
      </div>
    );
  }

  const tripTitle =
    preview.status === "invalid"
      ? "Trip invite"
      : preview.invite.tripTitle || "Untitled Trip";

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.15),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_35%)]" />
      <Card className="relative w-full max-w-xl border-white/10 bg-background/90 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-5 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="size-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-primary">Plantain</div>
              <CardTitle className="text-2xl tracking-tight">
                {tripTitle}
              </CardTitle>
            </div>
          </div>

          {preview.status !== "invalid" ? (
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Trip window
                </div>
                <div className="text-sm font-medium">
                  {formatTripDates(preview.invite.startDate, preview.invite.endDate)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <Users className="size-3.5" />
                  Group size
                </div>
                <div className="text-sm font-medium">
                  {preview.invite.partySize ?? "Not set"}
                </div>
              </div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5 p-6">
          {preview.status === "invalid" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <ShieldQuestion className="mt-0.5 size-5 text-destructive" />
                <div className="space-y-1">
                  <div className="font-medium">This invite link isn’t valid.</div>
                  <p className="text-sm text-muted-foreground">
                    Ask the trip owner for a fresh invite link.
                  </p>
                </div>
              </div>
              <Button type="button" onClick={() => router.replace("/")}>
                Back to Plantain
              </Button>
            </div>
          ) : null}

          {preview.status === "revoked" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 text-destructive" />
                <div className="space-y-1">
                  <div className="font-medium">This invite was revoked.</div>
                  <p className="text-sm text-muted-foreground">
                    {preview.invite.inviter.name ?? "The trip owner"} canceled
                    this link for {preview.invite.email}.
                  </p>
                </div>
              </div>
              <Button type="button" onClick={() => router.replace("/")}>
                Back to Plantain
              </Button>
            </div>
          ) : null}

          {preview.status === "accepted" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
                <div className="space-y-1">
                  <div className="font-medium">This invite has already been accepted.</div>
                  <p className="text-sm text-muted-foreground">
                    {preview.invite.acceptedBy?.name ??
                      preview.invite.acceptedBy?.email ??
                      invitedEmail} is already on the trip.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {session ? (
                  <Button type="button" onClick={openTrip}>
                    Open trip
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      void startGoogleSignIn();
                    }}
                    disabled={isStartingSignIn}
                  >
                    {isStartingSignIn ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Continue with Google
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {preview.status === "pending" ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {preview.invite.inviter.name ?? "A trip owner"} invited{" "}
                  <span className="text-foreground">{preview.invite.email}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Accepting this invite adds you to the trip as a full planner,
                  including team chat and shared map planning.
                </p>
              </div>

              {!session && !isSessionPending ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
                  {isStartingSignIn
                    ? "Redirecting you to Google sign-in..."
                    : "Continuing to Google sign-in..."}
                </div>
              ) : null}

              {session && !isEmailMatch ? (
                <div className="space-y-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="space-y-1">
                    <div className="font-medium">This invite is for a different email.</div>
                    <p className="text-sm text-muted-foreground">
                      Signed in as {session.user.email}, but this invite is for{" "}
                      {preview.invite.email}.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleSwitchAccount();
                    }}
                    disabled={isStartingSignIn}
                  >
                    {isStartingSignIn ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Use the invited Google account
                  </Button>
                </div>
              ) : null}

              {session && isEmailMatch ? (
                <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="space-y-1">
                    <div className="font-medium">You’re signed in with the invited email.</div>
                    <p className="text-sm text-muted-foreground">
                      Continue as {session.user.email} to join this trip.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      void handleAccept();
                    }}
                    disabled={isAccepting}
                  >
                    {isAccepting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Accept invite
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
