ALTER TABLE "billing_account" ADD COLUMN "provider_customer_id" text;--> statement-breakpoint
ALTER TABLE "billing_payment" ALTER COLUMN "provider" SET DEFAULT 'dodo';--> statement-breakpoint
ALTER TABLE "billing_subscription" ALTER COLUMN "provider" SET DEFAULT 'dodo';--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_provider_customer_id_key" UNIQUE("provider_customer_id");--> statement-breakpoint
ALTER TABLE "billing_refund" DROP CONSTRAINT "billing_refund_method", ADD CONSTRAINT "billing_refund_method" CHECK ("method" IN ('dodo', 'polar', 'midtrans', 'manual'));--> statement-breakpoint
ALTER TABLE "billing_subscription" DROP CONSTRAINT "billing_subscription_status";--> statement-breakpoint
-- Subscriptions mirrored from Polar (test rows only) take the nearest Dodo Payments status.
UPDATE "billing_subscription" SET "status" = CASE "status" WHEN 'canceled' THEN 'cancelled' WHEN 'incomplete' THEN 'pending' WHEN 'incomplete_expired' THEN 'failed' WHEN 'unpaid' THEN 'on_hold' ELSE "status" END WHERE "status" IN ('canceled', 'incomplete', 'incomplete_expired', 'unpaid');--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_status" CHECK ("status" IN ('pending', 'trialing', 'active', 'past_due', 'on_hold', 'paused', 'cancelled', 'failed', 'expired'));
