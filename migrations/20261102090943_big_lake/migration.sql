CREATE TABLE "billing_payment" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"provider" text DEFAULT 'midtrans' NOT NULL,
	"provider_order_id" text NOT NULL UNIQUE,
	"idempotency_key" text,
	"plan_id" text NOT NULL,
	"catalog_version" integer NOT NULL,
	"amount" integer NOT NULL,
	"duration_days" integer NOT NULL,
	"credits" integer NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"status" text NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"snap_token" text,
	"redirect_url" text,
	"expires_at" timestamp with time zone,
	"payment_type" text,
	"transaction_id" text,
	"provider_status" text,
	"fraud_status" text,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"receipt_sent_at" timestamp with time zone,
	"receipt_attempts" integer DEFAULT 0 NOT NULL,
	"receipt_attempted_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"check_attempts" integer DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payment_status" CHECK ("status" IN ('creating', 'pending', 'paid', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded', 'reversed')),
	CONSTRAINT "billing_payment_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "billing_payment_refunded_in_range" CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "amount")
);
--> statement-breakpoint
CREATE TABLE "billing_payment_event" (
	"id" text PRIMARY KEY,
	"payment_id" text,
	"provider_order_id" text NOT NULL,
	"source" text NOT NULL,
	"transaction_status" text,
	"status_code" text,
	"fraud_status" text,
	"gross_amount" text,
	"signature_valid" boolean,
	"outcome" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_period" ADD COLUMN "payment_id" text;--> statement-breakpoint
CREATE INDEX "ai_credit_grant_payment_id_index" ON "ai_credit_grant" ("payment_id");--> statement-breakpoint
CREATE INDEX "billing_payment_status_created_at_index" ON "billing_payment" ("status","created_at");--> statement-breakpoint
CREATE INDEX "billing_payment_user_id_created_at_index" ON "billing_payment" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payment_user_id_idempotency_key_index" ON "billing_payment" ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "billing_payment_event_provider_order_id_received_at_index" ON "billing_payment_event" ("provider_order_id","received_at");--> statement-breakpoint
CREATE INDEX "billing_payment_event_payment_id_index" ON "billing_payment_event" ("payment_id");--> statement-breakpoint
CREATE INDEX "membership_period_payment_id_index" ON "membership_period" ("payment_id");--> statement-breakpoint
ALTER TABLE "ai_credit_grant" ADD CONSTRAINT "ai_credit_grant_payment_id_billing_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payment"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD CONSTRAINT "billing_payment_event_payment_id_billing_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payment"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "membership_period" ADD CONSTRAINT "membership_period_payment_id_billing_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payment"("id") ON DELETE SET NULL;