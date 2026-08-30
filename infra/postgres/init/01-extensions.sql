-- Runs once, on an empty data directory.
-- pg_stat_statements is what turns "the app is slow" into "this statement is slow";
-- it needs shared_preload_libraries, which compose sets on the postgres command.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
