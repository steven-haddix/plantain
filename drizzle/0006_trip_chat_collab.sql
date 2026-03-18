CREATE TYPE "public"."trip_member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."chat_thread_kind" AS ENUM('ai_dm', 'team_room');--> statement-breakpoint

CREATE TABLE "trip_members" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "trip_member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_members_trip_user_unique" ON "trip_members" USING btree ("trip_id","user_id");--> statement-breakpoint

INSERT INTO "trip_members" ("id", "trip_id", "user_id", "role")
SELECT 'tm_' || md5("id" || ':' || "owner_id"), "id", "owner_id", 'owner'::"trip_member_role"
FROM "trips"
ON CONFLICT ("trip_id", "user_id") DO NOTHING;--> statement-breakpoint

ALTER TABLE "chat_threads" RENAME COLUMN "user_id" TO "owner_user_id";--> statement-breakpoint
ALTER TABLE "chat_threads" DROP COLUMN "is_private";--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "kind" "chat_thread_kind" DEFAULT 'ai_dm' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD COLUMN "last_message_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

UPDATE "chat_threads"
SET
	"key" = 'ai:' || "owner_user_id",
	"last_message_at" = COALESCE(
		(
			SELECT MAX("chat_messages"."created_at")
			FROM "chat_messages"
			WHERE "chat_messages"."thread_id" = "chat_threads"."id"
		),
		"chat_threads"."created_at"
	);--> statement-breakpoint

ALTER TABLE "chat_threads" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_trip_key_unique" ON "chat_threads" USING btree ("trip_id","key");--> statement-breakpoint

ALTER TABLE "chat_messages" ADD COLUMN "author_user_id" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "client_message_id" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_thread_client_message_unique" ON "chat_messages" USING btree ("thread_id","client_message_id");--> statement-breakpoint

UPDATE "chat_messages"
SET "author_user_id" = "chat_threads"."owner_user_id"
FROM "chat_threads"
WHERE
	"chat_messages"."thread_id" = "chat_threads"."id"
	AND "chat_messages"."role" = 'user'
	AND "chat_messages"."author_user_id" IS NULL;
