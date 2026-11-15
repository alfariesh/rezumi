ALTER TABLE "agent_threads" ADD COLUMN "portfolio_id" text;--> statement-breakpoint
CREATE INDEX "agent_threads_portfolio_id_index" ON "agent_threads" ("portfolio_id");--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_portfolio_id_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE SET NULL;