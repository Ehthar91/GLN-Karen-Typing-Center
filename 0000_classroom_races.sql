PRAGMA foreign_keys=ON;
CREATE TABLE `race_rooms` (
  `code` text PRIMARY KEY NOT NULL,
  `host_token` text NOT NULL,
  `passage` text NOT NULL,
  `status` text DEFAULT 'waiting' NOT NULL CHECK (`status` IN ('waiting','racing','finished')),
  `created_at` integer NOT NULL,
  `started_at` integer,
  `finished_at` integer
);
CREATE INDEX `idx_race_rooms_created_at` ON `race_rooms` (`created_at`);
CREATE TABLE `race_players` (
  `id` text PRIMARY KEY NOT NULL,
  `room_code` text NOT NULL REFERENCES `race_rooms`(`code`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `player_token` text NOT NULL,
  `progress` real DEFAULT 0 NOT NULL,
  `wpm` integer DEFAULT 0 NOT NULL,
  `accuracy` integer DEFAULT 100 NOT NULL,
  `color` integer DEFAULT 0 NOT NULL,
  `joined_at` integer NOT NULL,
  `finished_at` integer
);
CREATE INDEX `idx_race_players_room_code` ON `race_players` (`room_code`);
CREATE UNIQUE INDEX `idx_race_players_room_name` ON `race_players` (`room_code`,`name`);
PRAGMA optimize;
