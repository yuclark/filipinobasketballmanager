ALTER TABLE "players" ADD COLUMN "draft_round" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "draft_pick" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "draft_year" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "fans" integer DEFAULT 10000 NOT NULL;