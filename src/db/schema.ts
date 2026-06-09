import { pgTable, uuid, varchar, integer, boolean } from "drizzle-orm/pg-core";

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
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  firstName: varchar("first_name", { length: 50 }).notNull(),
  lastName: varchar("last_name", { length: 50 }).notNull(),
  age: integer("age").notNull(),
  hometown: varchar("hometown", { length: 100 }).notNull(),
  isFilAm: boolean("is_fil_am").default(false).notNull(),
  overall: integer("overall").notNull(),
  threePoint: integer("three_point").notNull(),
  insideScoring: integer("inside_scoring").notNull(),
  playmaking: integer("playmaking").notNull(),
  perimeterDefense: integer("perimeter_defense").notNull(),
  interiorDefense: integer("interior_defense").notNull(),
  rebounding: integer("rebounding").notNull(),
  speed: integer("speed").notNull(),
  stamina: integer("stamina").notNull(),
});
