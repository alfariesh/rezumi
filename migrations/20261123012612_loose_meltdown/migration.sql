CREATE TABLE "billing_limit_override" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"limit_key" text NOT NULL,
	"value" integer NOT NULL,
	"expires_at" timestamp with time zone,
	"reason" text NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_limit_override_value_not_negative" CHECK ("value" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_limit_override_user_id_limit_key_index" ON "billing_limit_override" ("user_id","limit_key");--> statement-breakpoint
ALTER TABLE "billing_limit_override" ADD CONSTRAINT "billing_limit_override_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_limit_override" ADD CONSTRAINT "billing_limit_override_granted_by_user_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE SET NULL;