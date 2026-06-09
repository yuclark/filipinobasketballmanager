import { pgTable, uuid, varchar, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  city: varchar("city", { length: 50 }).notNull(),
  conference: varchar("conference", { length: 20 }).$type<"Luzon" | "VisMin">().notNull(),
  budget: integer("budget").default(50000000).notNull(),
});

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "set null" }), // Nullable so free agents can exist
  firstName: varchar("first_name", { length: 50 }).notNull(),
  lastName: varchar("last_name", { length: 50 }).notNull(),
  age: integer("age").notNull(),
  hometown: varchar("hometown", { length: 100 }).notNull(),
  isFilAm: boolean("is_fil_am").default(false).notNull(),
  overall: integer("overall").notNull(),
  salary: integer("salary").default(3000000).notNull(), // Added in Phase 2
  position: varchar("position", { length: 5 }).default("SG").notNull(), // Added in Phase 2
  threePoint: integer("three_point").notNull(),
  insideScoring: integer("inside_scoring").notNull(),
  playmaking: integer("playmaking").notNull(),
  perimeterDefense: integer("perimeter_defense").notNull(),
  interiorDefense: integer("interior_defense").notNull(),
  rebounding: integer("rebounding").notNull(),
  speed: integer("speed").notNull(),
  stamina: integer("stamina").notNull(),
  contractYearsRemaining: integer("contract_years_remaining").default(3).notNull(),
  status: varchar("status", { length: 20 }).default("Active").notNull(), // 'Active' | 'Retired' | 'DraftPool'
});

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  homeTeamId: uuid("home_team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  awayTeamId: uuid("away_team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  seasonYear: integer("season_year").notNull(),
  gameNumber: integer("game_number").notNull(), // 1 to 82 for schedule days, 83+ for playoffs
  status: varchar("status", { length: 20 }).default("Scheduled").notNull(), // 'Scheduled' or 'Completed'
  homeScore: integer("home_score").default(0).notNull(),
  awayScore: integer("away_score").default(0).notNull(),
  stage: varchar("stage", { length: 20 }).default("Regular").notNull(), // 'Regular' or 'Playoffs'
  playoffRound: varchar("playoff_round", { length: 30 }), // 'Quarterfinals', 'Semifinals', etc.
  seriesId: varchar("series_id", { length: 50 }), // 'Q_Luzon_1v8', etc.
});

export const playerGameStats = pgTable("player_game_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => games.id, { onDelete: "cascade" })
    .notNull(),
  playerId: uuid("player_id")
    .references(() => players.id, { onDelete: "cascade" })
    .notNull(),
  points: integer("points").notNull(),
  rebounds: integer("rebounds").notNull(),
  assists: integer("assists").notNull(),
  steals: integer("steals").notNull(),
  blocks: integer("blocks").notNull(),
  turnovers: integer("turnovers").notNull(),
  fieldGoalsMade: integer("field_goals_made").notNull(),
  fieldGoalsAttempted: integer("field_goals_attempted").notNull(),
  minutes: integer("minutes").default(0).notNull(),
  threePointMade: integer("three_point_made").default(0).notNull(),
  threePointAttempted: integer("three_point_attempted").default(0).notNull(),
  freeThrowsMade: integer("free_throws_made").default(0).notNull(),
  freeThrowsAttempted: integer("free_throws_attempted").default(0).notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'Trade' | 'Signing' | 'Release'
  description: text("description").notNull(),
  seasonYear: integer("season_year").notNull(),
  gameDay: integer("game_day").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
