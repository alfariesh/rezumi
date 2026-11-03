CREATE TABLE "billing_notification" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"kind" text NOT NULL,
	"user_id" text,
	"count" integer DEFAULT 1 NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"attempted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_refund" (
	"id" text PRIMARY KEY,
	"payment_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"refund_key" text NOT NULL UNIQUE,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"revoke_benefits" boolean DEFAULT false NOT NULL,
	"actor_user_id" text,
	"failure_reason" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_refund_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "billing_refund_method" CHECK ("method" IN ('midtrans', 'manual')),
	CONSTRAINT "billing_refund_status" CHECK ("status" IN ('requesting', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "billing_account" ADD COLUMN "locale" text;--> statement-breakpoint
CREATE INDEX "billing_notification_sent_at_created_at_index" ON "billing_notification" ("sent_at","created_at");--> statement-breakpoint
CREATE INDEX "billing_notification_kind_created_at_index" ON "billing_notification" ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_refund_payment_id_sequence_index" ON "billing_refund" ("payment_id","sequence");--> statement-breakpoint
CREATE INDEX "billing_refund_status_created_at_index" ON "billing_refund" ("status","created_at");--> statement-breakpoint
ALTER TABLE "billing_notification" ADD CONSTRAINT "billing_notification_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_refund" ADD CONSTRAINT "billing_refund_payment_id_billing_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "billing_payment"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_refund" ADD CONSTRAINT "billing_refund_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;