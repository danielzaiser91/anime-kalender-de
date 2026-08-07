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


- [ ] Projekt ins Portfolio eintragen, sobald sinnvoll (öffentlich, stabil genug für eine
      kuratierte Beschreibung) — siehe Projects-Daten in
      `C:\code\ai\my website\src\app\data\projects.ts` (Repo `danielzaiser91/Portfolio-daniel-zaiser.de`).
- [ ] Impressum und Datenschutzerklärung mit echten Angaben füllen — beide sind aktuell
      Platzhalter und blockieren den öffentlichen Newsletter-Betrieb.
- [ ] Uhrzeiten für die laufenden Crunchyroll-Simuldubs belegen und in
      `data/curated/streaming-sommer-2026.yaml` eintragen.
- [ ] Newsletter-Worker deployen (Cloudflare-Account, D1-Datenbank, Mail-Anbieter).
