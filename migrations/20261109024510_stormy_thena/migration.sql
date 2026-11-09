CREATE TABLE "portfolio_message" (
	"id" text PRIMARY KEY,
	"portfolio_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"body" text NOT NULL,
	"service_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "portfolio" ADD COLUMN "message_email_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portfolio_statistics_daily" ADD COLUMN "clicks" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_statistics_daily" ADD COLUMN "works" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_statistics_daily" ADD COLUMN "sources" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_statistics_daily" ADD COLUMN "messages" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "portfolio_message_portfolio_id_created_at_index" ON "portfolio_message" ("portfolio_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_message_created_at_index" ON "portfolio_message" ("created_at");--> statement-breakpoint
ALTER TABLE "portfolio_message" ADD CONSTRAINT "portfolio_message_portfolio_id_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE CASCADE;