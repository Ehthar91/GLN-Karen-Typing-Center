import { integer, real, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const raceRooms=sqliteTable('race_rooms',{
  code:text('code').primaryKey(),
  hostToken:text('host_token').notNull(),
  passage:text('passage').notNull(),
  status:text('status').notNull().default('waiting'),
  createdAt:integer('created_at').notNull(),
  startedAt:integer('started_at'),
  finishedAt:integer('finished_at')
},table=>({createdAtIndex:index('idx_race_rooms_created_at').on(table.createdAt)}));

export const racePlayers=sqliteTable('race_players',{
  id:text('id').primaryKey(),
  roomCode:text('room_code').notNull().references(()=>raceRooms.code,{onDelete:'cascade'}),
  name:text('name').notNull(),
  playerToken:text('player_token').notNull(),
  progress:real('progress').notNull().default(0),
  wpm:integer('wpm').notNull().default(0),
  accuracy:integer('accuracy').notNull().default(100),
  color:integer('color').notNull().default(0),
  joinedAt:integer('joined_at').notNull(),
  finishedAt:integer('finished_at')
},table=>({roomIndex:index('idx_race_players_room_code').on(table.roomCode),roomNameUnique:uniqueIndex('idx_race_players_room_name').on(table.roomCode,table.name)}));
