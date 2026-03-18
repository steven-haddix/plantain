DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "users"
		WHERE "email" IS NULL OR btrim("email") = ''
	) THEN
		RAISE EXCEPTION 'Better Auth migration blocked: users.email contains null or blank values.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "users"
		WHERE "email" IS NOT NULL AND btrim("email") <> ''
		GROUP BY lower(btrim("email"))
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Better Auth migration blocked: users.email contains duplicates after normalization.';
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "email_verified" boolean;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone;
--> statement-breakpoint

UPDATE "users"
SET
	"email" = lower(btrim("email")),
	"name" = COALESCE(
		NULLIF(btrim("name"), ''),
		NULLIF(
			regexp_replace(
				initcap(
					regexp_replace(split_part(lower(btrim("email")), '@', 1), '[._-]+', ' ', 'g')
				),
				'\s+',
				' ',
				'g'
			),
			''
		),
		'Traveler'
	),
	"email_verified" = true,
	"created_at" = COALESCE("created_at", now()),
	"updated_at" = COALESCE("updated_at", now());
--> statement-breakpoint

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
--> statement-breakpoint

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
