CREATE TABLE "billing_subscription" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"external_customer_id" text NOT NULL,
	"provider" text DEFAULT 'polar' NOT NULL,
	"provider_subscription_id" text NOT NULL UNIQUE,
	"provider_customer_id" text,
	"provider_product_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"interval" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone,
	"paid_through" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"pending_product_id" text,
	"provider_modified_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone,
	"revoked_for_deletion_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscription_status" CHECK ("status" IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
	CONSTRAINT "billing_subscription_interval" CHECK ("interval" IN ('month', 'year')),
	CONSTRAINT "billing_subscription_amount_not_negative" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "billing_payment" DROP CONSTRAINT "billing_payment_amount_positive";--> statement-breakpoint
DROP INDEX "billing_payment_event_provider_order_id_received_at_index";--> statement-breakpoint
ALTER TABLE "ai_credit_grant" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "provider_checkout_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "interval" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "billing_reason" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "total_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD COLUMN "period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD COLUMN "webhook_id" text;--> statement-breakpoint
-- Events from before Polar were Midtrans notifications and status checks; name them so the column can be required.
ALTER TABLE "billing_payment_event" ADD COLUMN "event_type" text DEFAULT 'midtrans' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ALTER COLUMN "event_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD COLUMN "provider_object_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "provider_order_id";--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "provider" SET DEFAULT 'polar';--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "provider_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "duration_days" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "credits" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "currency" SET DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_provider_checkout_id_key" UNIQUE("provider_checkout_id");--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD CONSTRAINT "billing_payment_event_webhook_id_key" UNIQUE("webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_grant_subscription_month" ON "ai_credit_grant" ("subscription_id","expires_at");--> statement-breakpoint
CREATE INDEX "billing_payment_subscription_id_index" ON "billing_payment" ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_payment_event_provider_object_id_received_at_index" ON "billing_payment_event" ("provider_object_id","received_at");--> statement-breakpoint
CREATE INDEX "billing_payment_event_subscription_id_index" ON "billing_payment_event" ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_payment_event_event_type_received_at_index" ON "billing_payment_event" ("event_type","received_at");--> statement-breakpoint
CREATE INDEX "billing_subscription_user_id_status_index" ON "billing_subscription" ("user_id","status");--> statement-breakpoint
CREATE INDEX "billing_subscription_status_current_period_end_index" ON "billing_subscription" ("status","current_period_end");--> statement-breakpoint
ALTER TABLE "ai_credit_grant" ADD CONSTRAINT "ai_credit_grant_subscription_id_billing_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscription"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_subscription_id_billing_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscription"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_payment_event" ADD CONSTRAINT "billing_payment_event_wN85iNsz3CxT_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscription"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_amount_not_negative" CHECK ("amount" >= 0);--> statement-breakpoint
ALTER TABLE "billing_refund" DROP CONSTRAINT "billing_refund_method", ADD CONSTRAINT "billing_refund_method" CHECK ("method" IN ('polar', 'midtrans', 'manual'));