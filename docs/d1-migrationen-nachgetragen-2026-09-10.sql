-- **Die Buchführung holt nach, was längst gilt.**
--
-- Stand 10.09.2026: `wrangler d1 migrations list` führte 018 bis 028 unter
-- „Migrations to be applied" — dabei liest und schreibt der Worker ihre Spalten
-- seit Wochen. Sie wurden einzeln über `d1 execute` angewandt, und die Tabelle
-- `d1_migrations` weiß nichts davon.
--
-- **Jede Zeile hier ist belegt**, abgefragt am 10.09.2026 gegen die
-- Produktivdatenbank — keine Vermutung:
--
--   018-prime-folge-titel     idx_prime_folge_titel   (sqlite_master)
--   019-franchise-hinweis     subscribers.franchise_hinweis, .pending_franchise_hinweis
--   020-seiten-kennung        pruefung.seiten_kennung
--   021-rohfolge-plattform    prime_folge_plattform   (sqlite_master)
--   022-pruefung-url-index    pruefung_url_zeit       (sqlite_master)
--   023-netzfund-url-index    netzfund_url            (sqlite_master)
--   024-pruefung-titel-id     pruefung.titel_id
--   025-pruefung-such-url     pruefung_such_url       (sqlite_master)
--   026-such-erwartung        Tabelle such_erwartung
--   027-vorfall               Tabelle vorfall
--   028-pruefung-folgentitel  pruefung.folge
--
-- **Warum nicht `migrations apply`:** Der würde alle elf erneut fahren. Die
-- `CREATE TABLE IF NOT EXISTS` sind harmlos, ein `ALTER TABLE ADD COLUMN` auf
-- eine vorhandene Spalte bricht ab — mitten im Stapel, mit halb nachgetragener
-- Buchführung. Deshalb wird hier nur die Buchführung geschrieben, nicht das
-- Schema angefasst.
--
-- `applied_at` bleibt auf dem Vorgabewert (CURRENT_TIMESTAMP): Wann sie
-- wirklich liefen, weiß niemand mehr, und ein erfundenes Datum wäre schlechter
-- als das der Nachbuchung.
--
-- Danach gilt der Mechanismus wieder: Migration 029 läuft über
-- `wrangler d1 migrations apply` wie vorgesehen.

INSERT INTO d1_migrations (name)
SELECT '018-prime-folge-titel.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '018-prime-folge-titel.sql');

INSERT INTO d1_migrations (name)
SELECT '019-franchise-hinweis.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '019-franchise-hinweis.sql');

INSERT INTO d1_migrations (name)
SELECT '020-seiten-kennung.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '020-seiten-kennung.sql');

INSERT INTO d1_migrations (name)
SELECT '021-rohfolge-plattform.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '021-rohfolge-plattform.sql');

INSERT INTO d1_migrations (name)
SELECT '022-pruefung-url-index.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '022-pruefung-url-index.sql');

INSERT INTO d1_migrations (name)
SELECT '023-netzfund-url-index.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '023-netzfund-url-index.sql');

INSERT INTO d1_migrations (name)
SELECT '024-pruefung-titel-id.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '024-pruefung-titel-id.sql');

INSERT INTO d1_migrations (name)
SELECT '025-pruefung-such-url.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '025-pruefung-such-url.sql');

INSERT INTO d1_migrations (name)
SELECT '026-such-erwartung.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '026-such-erwartung.sql');

INSERT INTO d1_migrations (name)
SELECT '027-vorfall.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '027-vorfall.sql');

INSERT INTO d1_migrations (name)
SELECT '028-pruefung-folgentitel.sql'
WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '028-pruefung-folgentitel.sql');
