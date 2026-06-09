CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"season_year" integer NOT NULL,
	"game_day" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
