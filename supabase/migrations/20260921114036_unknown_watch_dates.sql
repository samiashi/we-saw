-- A watch can be logged without a date ("Not sure"): store null instead of
-- guesswork. Date-based analytics skip these rows; ratings and taste stats
-- still count them.
alter table public.watches alter column watched_on drop not null;
