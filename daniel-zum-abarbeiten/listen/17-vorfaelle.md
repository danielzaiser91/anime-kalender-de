# Vorfälle aus der Erweiterung

Was der Browser-Erweiterung aufgefallen ist, seit dieser Lauf zuletzt gelesen hat.
Bis zum 10.09.2026 stand das in der Browserkonsole — also an einer Stelle, die
niemand liest: Daniel schaut dort nicht hin, und der Agent kommt gar nicht daran.

Stand: 2026-11-12 11:52 · 3 Vorfall/Vorfälle

**Ein Vorfall ist nicht zwingend ein Fehler.** „Keine Tonspur gelesen" ist ein
vorgesehener Fall — interessant wird er erst durch seine Häufigkeit.

## ohne_tonspur — 2×

Der Player lieferte binnen zwanzig Sekunden keine Tonspur. Die Folge bleibt offen und kommt beim nächsten Durchlauf wieder dran — **das ist vorgesehen**. Häufen sich diese Fälle, ist die Frist zu knapp.

| Wann | Plattform | Reihe | Folge | Was | Version |
|---|---|---|---|---|---|
| 2026-11-12 11:40 | netflix | 26588007 | 1 | Folge 1 lieferte binnen zwanzig Sekunden keine Tonspur — bleibt offen | 4.32.105 |
| 2026-11-12 11:40 | netflix | 540533 | 1 | Folge 1 lieferte binnen zwanzig Sekunden keine Tonspur — bleibt offen | 4.32.105 |

## durchgang-zaehlung — 1×

Ende eines Netflix-Durchgangs: besucht, gemessen, wartet auf Übernahme, übersprungen. Misst er viele besuchte Titel nie, steht es hier.

| Wann | Plattform | Reihe | Folge | Was | Version |
|---|---|---|---|---|---|
| 2026-11-12 11:40 | netflix | — | — | {"besucht":2,"gemessen":0,"wartend":0,"uebersprungen":1} | 4.32.105 |

