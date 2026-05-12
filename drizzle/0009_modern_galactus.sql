CREATE TYPE "public"."trip_invitation_role" AS ENUM('member');--> statement-breakpoint
CREATE TYPE "public"."trip_invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "trip_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"status" "trip_invitation_status" DEFAULT 'pending' NOT NULL,
	"role" "trip_invitation_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_invitations_token_unique" ON "trip_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "trip_invitations_trip_status_idx" ON "trip_invitations" USING btree ("trip_id","status");--> statement-breakpoint
CREATE INDEX "trip_invitations_trip_email_idx" ON "trip_invitations" USING btree ("trip_id","normalized_email");