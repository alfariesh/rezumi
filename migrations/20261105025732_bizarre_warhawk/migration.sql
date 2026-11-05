ALTER TABLE "billing_payment" DROP COLUMN "snap_token";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "payment_type";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "transaction_id";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "fraud_status";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "receipt_sent_at";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "receipt_attempts";--> statement-breakpoint
ALTER TABLE "billing_payment" DROP COLUMN "receipt_attempted_at";--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "transaction_status";--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "status_code";--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "fraud_status";--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "gross_amount";--> statement-breakpoint
ALTER TABLE "billing_payment_event" DROP COLUMN "signature_valid";