> **Archiviert am 31.08.2026 — hier ist nichts mehr zu tun.**
>
> Die Anleitung beginnt mit „Die Erweiterung deckt Disney+ **noch nicht** ab". Sie tut es seit dem 26.08.2026, samt Playback-Abruf für die Tonspuren. Was offen ist, steht in `07-disneyplus.md` und in der Erweiterung.
>
> Die Datei bleibt als Beleg stehen: Was einmal Arbeit war, gehört nachlesbar, nicht
> gelöscht.

# 5 — Disney+ durchgehen

**40 Verweise.** Je Titel etwa 30 Sekunden.

## Was zu tun ist

Die Erweiterung deckt Disney+ **noch nicht** ab — dort läuft bisher kein Melder. Bis dahin von
Hand, in der Kurzform:

| # | Titel | Verweis |
|---|---|---|
| 1 | BLEACH | https://www.disneyplus.com/de-de/series/bleach/6g48QKlgQdWK |
| 2 | Dragon Ball Super | https://www.disneyplus.com/browse/entity-ceb1fd76-acbe-4269-a1f3-532614807772 |
| 3 | Boku no Hero Academia | https://www.disneyplus.com/browse/entity-6c1cfdcd-a3b1-428a-8fe9-aa917d5b6371 |

Die vollständige Liste steht in [07-alle-anbieter.md](07-alle-anbieter.md), gefiltert auf
Disney+.

**Ablauf je Titel:** Seite öffnen, eine Folge starten, im Player auf die **Tonspur-Auswahl**
sehen. Steht dort Deutsch?

**Antwort:** `1-1 2-1 3-0` (`1` = Deutsch · `0` = nur Untertitel · `x` = nicht abrufbar)

## Warum es keine Automatik gibt

`disneyplus.com/robots.txt` sperrt alles. Ein Abruf wäre ein Regelverstoß, und die eine
Schnittstelle, die es gäbe — die Streaming Availability API —, führt für Disney+ **44 Serien
mit deutscher Tonspur**, die wir nicht übernehmen: Es gibt bisher nur **vier** Handprüfungen
für diesen Anbieter, und auf vier Fällen lässt sich keine Trefferquote messen.

Es ist dasselbe Muster wie bei Prime Video: Deine Prüfungen sind nicht nur die Antwort für
diese 40 Verweise, sie sind der Maßstab, an dem sich eine zweite Quelle messen lässt.

## Wenn die Erweiterung Disney+ lernen soll

Das wäre möglich — dieselbe Bauweise wie bei Netflix: Der Player nennt seine Tonspuren, ein
Skript in der Seitenwelt liest sie mit. Aufwand etwa eine Stunde. **Lohnt sich ab dem Punkt, an
dem regelmäßig neue Disney-Titel dazukommen**; bei 40 einmaligen Prüfungen ist Handarbeit
schneller. Sag Bescheid, wenn du es anders siehst.
