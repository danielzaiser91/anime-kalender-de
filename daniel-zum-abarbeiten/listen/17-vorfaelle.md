# Vorfälle aus der Erweiterung

Was der Browser-Erweiterung aufgefallen ist, seit dieser Lauf zuletzt gelesen hat.
Bis zum 10.09.2026 stand das in der Browserkonsole — also an einer Stelle, die
niemand liest: Daniel schaut dort nicht hin, und der Agent kommt gar nicht daran.

Stand: 2026-10-21 01:21 · 2 Vorfall/Vorfälle

**Ein Vorfall ist nicht zwingend ein Fehler.** „Keine Tonspur gelesen" ist ein
vorgesehener Fall — interessant wird er erst durch seine Häufigkeit.

## stoerung — 1×

Netflix hat den Durchlauf abgebrochen. `M7…` meint die Wiedergabe (zu viele Streams, Netz), `E1…`/`UI…`/`NSES-…` den Titel selbst.

| Wann | Plattform | Reihe | Folge | Was | Version |
|---|---|---|---|---|---|
| 2026-10-21 00:59 | netflix | 81717895 | 1 | Netflix meldet E103 — Durchlauf abgebrochen | 4.31.8 |

## ohne_tonspur — 1×

Der Player lieferte binnen zwanzig Sekunden keine Tonspur. Die Folge bleibt offen und kommt beim nächsten Durchlauf wieder dran — **das ist vorgesehen**. Häufen sich diese Fälle, ist die Frist zu knapp.

| Wann | Plattform | Reihe | Folge | Was | Version |
|---|---|---|---|---|---|
| 2026-10-21 00:59 | netflix | 81717895 | 1 | Folge 1 lieferte binnen zwanzig Sekunden keine Tonspur — bleibt offen | 4.31.8 |

