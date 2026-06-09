ALTER TABLE "games" ADD COLUMN "stage" varchar(20) DEFAULT 'Regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "playoff_round" varchar(30);--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "series_id" varchar(50);