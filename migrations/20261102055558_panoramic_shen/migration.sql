CREATE TABLE "ai_credit_grant" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"payment_id" text,
	"amount" integer NOT NULL,
	"remaining" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_grant_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "ai_credit_grant_source" CHECK ("source" IN ('trial', 'plan', 'admin')),
	CONSTRAINT "ai_credit_grant_remaining_in_range" CHECK ("remaining" >= 0 AND "remaining" <= "amount")
);
--> statement-breakpoint
CREATE TABLE "ai_credit_usage" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"operation_key" text NOT NULL UNIQUE,
	"action" text NOT NULL,
	"credits" integer NOT NULL,
	"status" text NOT NULL,
	"allocations" jsonb DEFAULT '[]' NOT NULL,
	"provider" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd_micros" bigint,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "ai_credit_usage_credits_positive" CHECK ("credits" > 0),
	CONSTRAINT "ai_credit_usage_status" CHECK ("status" IN ('reserved', 'committed', 'released'))
);
--> statement-breakpoint
CREATE INDEX "ai_credit_grant_user_id_expires_at_index" ON "ai_credit_grant" ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "ai_credit_usage_user_id_created_at_index" ON "ai_credit_usage" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_credit_usage_status_created_at_index" ON "ai_credit_usage" ("status","created_at");--> statement-breakpoint
ALTER TABLE "ai_credit_grant" ADD CONSTRAINT "ai_credit_grant_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_credit_usage" ADD CONSTRAINT "ai_credit_usage_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;