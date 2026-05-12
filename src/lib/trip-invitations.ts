import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  tripInvitations,
  tripMembers,
  tripInvitationStatus,
  trips,
  users,
} from "@/db/schema";
import { assertTripOwnerAccess } from "@/lib/trip-access";

type TripInvitationStatus = (typeof tripInvitationStatus.enumValues)[number];

export type TripInvitationSummary = {
  id: string;
  tripId: string;
  email: string;
  normalizedEmail: string;
  status: TripInvitationStatus;
  role: "member";
  token: string;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type TripInvitationPreview =
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
        createdAt: Date;
        acceptedAt: Date | null;
        revokedAt: Date | null;
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

export class TripInvitationError extends Error {
  constructor(
    readonly code:
      | "already_member"
      | "email_mismatch"
      | "invalid_email"
      | "not_found"
      | "revoked",
    message: string,
  ) {
    super(message);
    this.name = "TripInvitationError";
  }
}

const inviterUsers = alias(users, "trip_inviter_users");
const acceptedByUsers = alias(users, "trip_accepted_by_users");

const mapSummary = (invite: typeof tripInvitations.$inferSelect): TripInvitationSummary => ({
  id: invite.id,
  tripId: invite.tripId,
  email: invite.email,
  normalizedEmail: invite.normalizedEmail,
  status: invite.status,
  role: invite.role,
  token: invite.token,
  createdAt: invite.createdAt,
  acceptedAt: invite.acceptedAt ?? null,
  revokedAt: invite.revokedAt ?? null,
});

export const normalizeTripInviteEmail = (email: string) =>
  email.trim().toLowerCase();

export const createTripInviteShareUrl = (token: string, origin: string) =>
  new URL(`/join/${encodeURIComponent(token)}`, origin).toString();

export async function createTripInvitation(input: {
  tripId: string;
  invitedByUserId: string;
  invitedByEmail: string;
  email: string;
}) {
  await assertTripOwnerAccess(input.tripId, input.invitedByUserId);

  const normalizedEmail = normalizeTripInviteEmail(input.email);
  if (!normalizedEmail) {
    throw new TripInvitationError("invalid_email", "Invite email is required.");
  }

  if (normalizedEmail === normalizeTripInviteEmail(input.invitedByEmail)) {
    throw new TripInvitationError(
      "already_member",
      "You are already a member of this trip.",
    );
  }

  const [existingMember] = await db
    .select({ id: tripMembers.id })
    .from(tripMembers)
    .innerJoin(users, eq(tripMembers.userId, users.id))
    .where(
      and(
        eq(tripMembers.tripId, input.tripId),
        eq(users.email, normalizedEmail),
      ),
    );

  if (existingMember) {
    throw new TripInvitationError(
      "already_member",
      "That traveler is already on this trip.",
    );
  }

  const [existingInvite] = await db
    .select()
    .from(tripInvitations)
    .where(
      and(
        eq(tripInvitations.tripId, input.tripId),
        eq(tripInvitations.normalizedEmail, normalizedEmail),
        eq(tripInvitations.status, "pending"),
      ),
    );

  if (existingInvite) {
    return mapSummary(existingInvite);
  }

  const [invite] = await db
    .insert(tripInvitations)
    .values({
      id: nanoid(),
      tripId: input.tripId,
      email: input.email.trim(),
      normalizedEmail,
      status: "pending",
      role: "member",
      token: nanoid(32),
      invitedByUserId: input.invitedByUserId,
    })
    .returning();

  if (!invite) {
    throw new Error("Failed to create trip invitation.");
  }

  return mapSummary(invite);
}

export async function listPendingTripInvitations(tripId: string) {
  const invites = await db
    .select()
    .from(tripInvitations)
    .where(
      and(
        eq(tripInvitations.tripId, tripId),
        eq(tripInvitations.status, "pending"),
      ),
    );

  return invites
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(mapSummary);
}

export async function revokeTripInvitation(input: {
  tripId: string;
  inviteId: string;
  revokedByUserId: string;
}) {
  await assertTripOwnerAccess(input.tripId, input.revokedByUserId);

  const [invite] = await db
    .select()
    .from(tripInvitations)
    .where(
      and(
        eq(tripInvitations.id, input.inviteId),
        eq(tripInvitations.tripId, input.tripId),
        eq(tripInvitations.status, "pending"),
      ),
    );

  if (!invite) {
    throw new TripInvitationError(
      "not_found",
      "Trip invitation was not found.",
    );
  }

  const [revokedInvite] = await db
    .update(tripInvitations)
    .set({
      status: "revoked",
      revokedAt: new Date(),
    })
    .where(eq(tripInvitations.id, invite.id))
    .returning();

  if (!revokedInvite) {
    throw new Error("Failed to revoke trip invitation.");
  }

  return mapSummary(revokedInvite);
}

export async function getTripInvitationPreview(
  token: string,
): Promise<TripInvitationPreview> {
  const [invite] = await db
    .select({
      id: tripInvitations.id,
      tripId: tripInvitations.tripId,
      email: tripInvitations.email,
      normalizedEmail: tripInvitations.normalizedEmail,
      status: tripInvitations.status,
      role: tripInvitations.role,
      token: tripInvitations.token,
      createdAt: tripInvitations.createdAt,
      acceptedAt: tripInvitations.acceptedAt,
      revokedAt: tripInvitations.revokedAt,
      tripTitle: trips.title,
      startDate: trips.startDate,
      endDate: trips.endDate,
      partySize: trips.partySize,
      inviterId: inviterUsers.id,
      inviterName: inviterUsers.name,
      inviterEmail: inviterUsers.email,
      inviterAvatarUrl: inviterUsers.avatarUrl,
      acceptedById: acceptedByUsers.id,
      acceptedByName: acceptedByUsers.name,
      acceptedByEmail: acceptedByUsers.email,
    })
    .from(tripInvitations)
    .innerJoin(trips, eq(tripInvitations.tripId, trips.id))
    .leftJoin(inviterUsers, eq(tripInvitations.invitedByUserId, inviterUsers.id))
    .leftJoin(
      acceptedByUsers,
      eq(tripInvitations.acceptedByUserId, acceptedByUsers.id),
    )
    .where(eq(tripInvitations.token, token));

  if (!invite) {
    return { status: "invalid" };
  }

  return {
    status: invite.status,
    invite: {
      id: invite.id,
      tripId: invite.tripId,
      email: invite.email,
      normalizedEmail: invite.normalizedEmail,
      role: invite.role,
      token: invite.token,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt ?? null,
      revokedAt: invite.revokedAt ?? null,
      tripTitle: invite.tripTitle,
      startDate: invite.startDate,
      endDate: invite.endDate,
      partySize: invite.partySize,
      inviter: {
        id: invite.inviterId,
        name: invite.inviterName,
        email: invite.inviterEmail,
        avatarUrl: invite.inviterAvatarUrl,
      },
      acceptedBy: invite.acceptedById
        ? {
            id: invite.acceptedById,
            name: invite.acceptedByName,
            email: invite.acceptedByEmail,
          }
        : null,
    },
  };
}

export async function acceptTripInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const normalizedUserEmail = normalizeTripInviteEmail(input.userEmail);
  if (!normalizedUserEmail) {
    throw new TripInvitationError("invalid_email", "User email is required.");
  }

  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(tripInvitations)
      .where(eq(tripInvitations.token, input.token));

    if (!invite) {
      throw new TripInvitationError(
        "not_found",
        "Trip invitation was not found.",
      );
    }

    if (invite.normalizedEmail !== normalizedUserEmail) {
      throw new TripInvitationError(
        "email_mismatch",
        "This invite belongs to a different email address.",
      );
    }

    if (invite.status === "revoked") {
      throw new TripInvitationError(
        "revoked",
        "This trip invitation has been revoked.",
      );
    }

    await tx
      .insert(tripMembers)
      .values({
        id: nanoid(),
        tripId: invite.tripId,
        userId: input.userId,
        role: "member",
      })
      .onConflictDoNothing();

    if (invite.status === "accepted") {
      return {
        tripId: invite.tripId,
        status: "accepted" as const,
        alreadyAccepted: true,
      };
    }

    await tx
      .update(tripInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
      })
      .where(eq(tripInvitations.id, invite.id));

    return {
      tripId: invite.tripId,
      status: "accepted" as const,
      alreadyAccepted: false,
    };
  });
}
