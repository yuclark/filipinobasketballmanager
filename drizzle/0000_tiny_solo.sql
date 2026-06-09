CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"age" integer NOT NULL,
	"hometown" varchar(100) NOT NULL,
	"is_fil_am" boolean DEFAULT false NOT NULL,
	"overall" integer NOT NULL,
	"three_point" integer NOT NULL,
	"inside_scoring" integer NOT NULL,
	"playmaking" integer NOT NULL,
	"perimeter_defense" integer NOT NULL,
	"interior_defense" integer NOT NULL,
	"rebounding" integer NOT NULL,
	"speed" integer NOT NULL,
	"stamina" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"city" varchar(50) NOT NULL,
	"conference" varchar(20) NOT NULL,
	"budget" integer DEFAULT 50000000 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;