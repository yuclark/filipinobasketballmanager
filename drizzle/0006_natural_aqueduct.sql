CREATE TABLE "all_league_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_year" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"position" varchar(5) NOT NULL,
	"player_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_team_id" uuid,
	"original_team_id" uuid,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"pick_number" integer,
	"is_used" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_year" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"current_pick_number" integer DEFAULT 1 NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"offseason_phase" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "draft_sessions_season_year_unique" UNIQUE("season_year")
);
--> statement-breakpoint
CREATE TABLE "player_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_year" integer NOT NULL,
	"award_type" varchar(20) NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "save_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"user_team_id" uuid,
	"managed_team_name" varchar(50),
	"managed_team_city" varchar(50),
	"current_league_day" integer DEFAULT 1 NOT NULL,
	"current_season_year" integer DEFAULT 2026 NOT NULL,
	"game_state_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_champions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_year" integer NOT NULL,
	"champion_team_id" uuid NOT NULL,
	"runner_up_team_id" uuid NOT NULL,
	"finals_mvp_player_id" uuid NOT NULL,
	"series_score" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_year" integer NOT NULL,
	"proposer_team_id" uuid NOT NULL,
	"receiver_team_id" uuid NOT NULL,
	"outgoing_player_ids" text[] NOT NULL,
	"incoming_player_ids" text[] NOT NULL,
	"status" varchar(20) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_rookie" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "injury_days_remaining" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "injury_type" varchar(100);--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_on_trade_block" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "years_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "all_league_teams" ADD CONSTRAINT "all_league_teams_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_original_team_id_teams_id_fk" FOREIGN KEY ("original_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_awards" ADD CONSTRAINT "player_awards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_awards" ADD CONSTRAINT "player_awards_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_champions" ADD CONSTRAINT "season_champions_champion_team_id_teams_id_fk" FOREIGN KEY ("champion_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_champions" ADD CONSTRAINT "season_champions_runner_up_team_id_teams_id_fk" FOREIGN KEY ("runner_up_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_champions" ADD CONSTRAINT "season_champions_finals_mvp_player_id_players_id_fk" FOREIGN KEY ("finals_mvp_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_proposals" ADD CONSTRAINT "trade_proposals_proposer_team_id_teams_id_fk" FOREIGN KEY ("proposer_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_proposals" ADD CONSTRAINT "trade_proposals_receiver_team_id_teams_id_fk" FOREIGN KEY ("receiver_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;