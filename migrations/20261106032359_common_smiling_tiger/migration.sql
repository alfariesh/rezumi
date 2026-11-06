CREATE TABLE "portfolio_statistics_daily" (
	"id" text PRIMARY KEY,
	"portfolio_id" text NOT NULL,
	"date" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_statistics_daily_unique" UNIQUE("portfolio_id","date")
);
--> statement-breakpoint
ALTER TABLE "portfolio_statistics_daily" ADD CONSTRAINT "portfolio_statistics_daily_portfolio_id_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE CASCADE;