"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Copy,
  Link2,
  Loader2,
  Mail,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

type PendingInvite = {
  id: string;
  email: string;
  status: string;
  role: string;
  createdAt: string | Date;
  shareUrl: string;
};

const memberInitials = (name: string | null, email: string | null) =>
  (name ?? email ?? "?").slice(0, 2).toUpperCase();

export function TripPeopleSheet({
  tripId,
  tripTitle,
  currentUserRole,
  members,
  pendingInvites,
  open,
  onOpenChange,
  onPeopleChanged,
}: {
  tripId: string;
  tripTitle?: string | null;
  currentUserRole: "owner" | "member" | null;
  members: Member[];
  pendingInvites: PendingInvite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPeopleChanged: () => Promise<void>;
}) {
  const canManageInvites = currentUserRole === "owner";
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const copyInviteLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Couldn’t copy the invite link.");
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || isInviting) {
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/invites`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email }),
        },
      );

      const data = (await response.json()) as { error?: string; shareUrl?: string };
      if (!response.ok || !data.shareUrl) {
        throw new Error(data.error ?? "Failed to create invite.");
      }

      await copyInviteLink(data.shareUrl);
      setInviteEmail("");
      await onPeopleChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite traveler.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (pendingActionId) {
      return;
    }

    setPendingActionId(inviteId);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/invites/${encodeURIComponent(
          inviteId,
        )}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to revoke invite.");
      }

      toast.success("Invite revoked.");
      await onPeopleChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke invite.");
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-white/10 bg-background/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-lg">Trip People</SheetTitle>
              <SheetDescription>
                {tripTitle ?? "Current Trip"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="space-y-6 overflow-y-auto px-6 py-6">
            {canManageInvites ? (
              <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <UserPlus className="size-4 text-primary" />
                    Invite a traveler
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create a private join link tied to one email address.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="border-white/10 bg-background/70"
                  />
                  <Button
                    type="button"
                    onClick={handleInvite}
                    disabled={isInviting || !inviteEmail.trim()}
                    className="shrink-0"
                  >
                    {isInviting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Invite
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-tight">Members</h3>
                <Badge variant="secondary">{members.length}</Badge>
              </div>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10 border border-white/10">
                        <AvatarFallback className="text-xs">
                          {memberInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {member.name ?? member.email ?? "Traveler"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {member.email ?? "No email available"}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={member.role === "owner" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {member.role === "owner" ? (
                        <Shield className="mr-1 size-3" />
                      ) : null}
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            {canManageInvites ? (
              <section className="space-y-3 pb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Pending invites
                  </h3>
                  <Badge variant="secondary">{pendingInvites.length}</Badge>
                </div>

                {pendingInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-muted-foreground">
                    No invites waiting right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => {
                      const isPendingAction = pendingActionId === invite.id;

                      return (
                        <div
                          key={invite.id}
                          className="space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Mail className="size-4 text-muted-foreground" />
                              <span className="truncate">{invite.email}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Sent{" "}
                              {formatDistanceToNow(new Date(invite.createdAt), {
                                addSuffix: true,
                              })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="flex-1"
                              onClick={() => {
                                void copyInviteLink(invite.shareUrl);
                              }}
                            >
                              <Copy className="size-4" />
                              Copy link
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="border border-white/10"
                              disabled={isPendingAction}
                              onClick={() => {
                                void handleRevoke(invite.id);
                              }}
                            >
                              {isPendingAction ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <X className="size-4" />
                              )}
                              Revoke
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Link2 className="size-3.5" />
                            Email-specific join link
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
