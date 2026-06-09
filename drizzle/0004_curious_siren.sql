ALTER TABLE "players" ADD COLUMN "contract_years_remaining" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "status" varchar(20) DEFAULT 'Active' NOT NULL;