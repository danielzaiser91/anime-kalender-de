# TODO

## Alle legalen Anbieter, mehr Quellen, häufigeres Polling

Großer Brocken, bewusst nach hinten geschoben. Ziel: nicht mehr nur Crunchyroll
maschinell, sondern jede legale deutsche Bezugsquelle — und der Datenbestand
mindestens wöchentlich, besser täglich bis stündlich aktuell.

**Plattformen aufnehmen** (im Code als `PlatformId` bereits angelegt, es fehlen die Daten):
Netflix, Prime Video, Disney+, ADN, Aniverse, WOW, Joyn, RTL+, YouTube, Kino, Disc.

**Quellen prüfen und anbinden:**

| Quelle | Liefert | Zugang |
|---|---|---|
| ADN (animationdigitalnetwork.com/de) | Simulcast-Kalender mit Uhrzeit, eigene Synchros | HTML, vermutlich scrapebar |
| Aniverse | Katalog + Neustarts | HTML |
| Netflix DE „Neu & beliebt" | Batch-Drops, Datum ohne Uhrzeit | HTML oder JustWatch |
| Prime Video DE | Simulcasts, teils mit Uhrzeit | HTML oder JustWatch |
| Disney+ DE | Katalogtitel | JustWatch |
| JustWatch (inoffizielle GraphQL-API) | Anbieter + Deeplinks + Preise, Region DE | inoffiziell, ToS-Graubereich — vorher abwägen |
| Anime2You Monatsübersichten | Disc-Releases mit Datum, Label, Edition | RSS + HTML, monatlich |
| aniSearch Saisonübersichten | Startdaten je Plattform | HTML, einmal je Saison |
| Kino-Verleiher (Crunchyroll, LEONINE, Plaion) | Kinostarts | Pressebereiche, RSS |

**Polling-Kaskade statt eines Nachtlaufs:**

- stündlich: Crunchyroll-Kalender (billig, ändert sich am häufigsten)
- täglich: MyDubList, AniList-Deltas, ADN, Prime Video
- wöchentlich: Netflix, Disney+, Aniverse, Disc-Übersichten
- je Saison: aniSearch-Saisonübersicht

Dafür braucht es einen Scheduler mit mehreren Cron-Einträgen und eine
Änderungs-Erkennung, die nur committet, wenn sich wirklich etwas bewegt hat —
sonst rauscht das Repo mit leeren Commits voll. Kandidat: mehrere GitHub-Action-
Workflows mit unterschiedlichem Takt statt eines einzigen.

**Zu klären:** Rechtliche Bewertung des Scrapings je Quelle, Rate-Limits,
Erkennungsrobustheit (Selektoren brechen), und ob ein Discord-Webhook melden
soll, wenn eine Quelle stumm bleibt.

---

## Offene Kästchen

- [ ] Projekt ins Portfolio eintragen, sobald sinnvoll (öffentlich, stabil genug für eine
      kuratierte Beschreibung) — siehe Projects-Daten in
      `C:\code\ai\my website\src\app\data\projects.ts` (Repo `danielzaiser91/Portfolio-daniel-zaiser.de`).
- [ ] Tracking-Absatz aus der Datenschutzerklärung entfernen, sobald der erste Versand über
      `kalender@send.anime-kalender.de` bestätigt ist — auf der eigenen Domain ist Öffnungs-
      und Klick-Erfassung abgeschaltet, der Absatz beschreibt dann etwas, das nicht mehr
      passiert.

## Erledigt

- [x] Impressum und Datenschutzerklärung ausformulieren
- [x] Uhrzeiten der laufenden Crunchyroll-Simuldubs belegen
- [x] Newsletter-Worker deployen
- [x] Eigene Domain und Absenderdomain einrichten
