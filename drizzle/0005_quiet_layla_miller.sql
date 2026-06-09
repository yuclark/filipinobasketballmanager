ALTER TABLE "player_game_stats" ADD COLUMN "minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD COLUMN "three_point_made" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD COLUMN "three_point_attempted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD COLUMN "free_throws_made" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD COLUMN "free_throws_attempted" integer DEFAULT 0 NOT NULL;