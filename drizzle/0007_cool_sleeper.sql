CREATE TABLE "player_evolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"game_day" integer NOT NULL,
	"old_overall" integer NOT NULL,
	"new_overall" integer NOT NULL,
	"attribute_changes_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_salary_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season_year" integer NOT NULL,
	"team_id" uuid,
	"salary" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "dead_cap" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_evolutions" ADD CONSTRAINT "player_evolutions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_salary_history" ADD CONSTRAINT "player_salary_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_salary_history" ADD CONSTRAINT "player_salary_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;