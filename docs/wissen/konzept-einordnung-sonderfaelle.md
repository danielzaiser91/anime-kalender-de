# Einordnung der Werke: Normalfall aniSearch, Sonderfall MAL (Konzept, 04.10.2026)

Anlass: JoJo's Bizarre Adventure **Steel Ball Run**. AniList und aniSearch führen zwei Einträge — Phase 1 (nur Folge 1, aniSearch 20466) und Phase 2–3 (die Folgen 2–12, aniSearch 21986; AniList: 1st STAGE, ein Teil mit einer Folge, und 2nd & 3rd STAGE, ONA, 11 Folgen). MyAnimeList führt **einen** Eintrag. Daniel (04.10.2026): Die Folgen gehören fachlich zusammen („folge 2 zu gucken ohne 1 macht kein sinn"), wir führen **einen** Eintrag ohne „Phase", folgen also in diesem Fall MAL. Der Absprung zu aniSearch bleibt je Phase, mit eigenem Label.

## Die Regel

- **Normalfall:** Wir halten uns an die Einordnung von aniSearch. Ein aniSearch-Eintrag ist ein Werk. Führt aniSearch **einen** Eintrag für mehrere AniList-Titel, ist das ein **Bündel** (Code Geass Akito = fünf Filme, Cat's Eye 73 Folgen, Gantz, Mardock Scramble).
- **Sonderfall:** Trennt aniSearch ein Werk, das fachlich ein Paket ist, und MAL führt es als eines, folgt der Eintrag MAL. Jeder Sonderfall steht mit Begründung in `data/einordnung-sonderfaelle.yaml` — **von Hand und einzeln entschieden**, nie aus einer Regel abgeleitet.

## Ein Mechanismus für beides: das Bündel

Ein Bündel hat einen **Kopf** und **aufgegangene** Titel. Es speist sich aus zwei Quellen: gleiche aniSearch-Kennung (Normalfall) oder der Handliste (Sonderfall).

```yaml
# data/einordnung-sonderfaelle.yaml  (Entwurf)
- name: "JoJo's Bizarre Adventure: Steel Ball Run"
  regel: mal                      # mal | anisearch — woran die Einordnung hängt
  kopf: 210482                    # AniList: 2nd & 3rd STAGE (ONA, 11 Folgen), trägt das Bündel
  aufgegangen: [190327]           # AniList: 1st STAGE (eine Folge) — bleibt intern bestehen
  folgen: 12                      # laut MAL
  anisearch:                      # Absprünge mit eigenem Label
    - { label: "Phase 1", id: 20466 }
    - { label: "Phase 2–3", id: 21986 }
  grund: "Phase 2 ohne Phase 1 ergibt keinen Sinn; MAL führt sie als einen Eintrag; aniSearch trennt nur wegen des Abstands von Monaten."
  geprueft: "2026-10-04"           # Daniel, an aniSearch und MAL
```

## Was ein Bündel bewirkt

| Stelle | Verhalten |
|---|---|
| Datenbank, Kalender, Reihen-Box | Nur der **Kopf** erscheint; Titel ohne „Phase". Die Folgenzahl ist die des Bündels (12). |
| Releases | Beide Netflix-Releases (Folge 1 am 19.03., Folgen 2–12 ab 25.09.) hängen am Kopf. |
| Suche | Der aufgegangene Titel bleibt **auffindbar**: Seine Namen, Synonyme und „Phase 1/2/3" sind Suchbegriffe des Kopfs; ein Treffer führt auf den Kopf. |
| Adressen | Die alte Seite des aufgegangenen Titels (`/t/<slug>/`, `?t=<Kennung>`) leitet auf den Kopf weiter; es entsteht kein 404. |
| aniSearch-Absprung | Je Eintrag ein Link mit Label („aniSearch Phase 1", „aniSearch Phase 2–3"); MAL einmal. |
| Handbelege, Verweise, News | Werden dem Kopf zugeordnet; die Zuordnung über die alte Kennung läuft intern weiter. |

## Umsetzung (Reihenfolge)

1. `data/einordnung-sonderfaelle.yaml` anlegen und laden (`pipeline/lib/einordnung.ts`), Fehler brechen den Bau ab.
2. Im Bau: aufgegangene Titel aus der Liste nehmen, ihre Releases, Verweise, Belege, Namen und Kennungen auf den Kopf umhängen; `aliasVon` am Kopf für Suche und Weiterleitung.
3. Web: Suche über Aliase, Weiterleitung alter Adressen, mehrere aniSearch-Absprünge (`AniSearchVerweis`).
4. **Zusicherungen:** Kein Release ohne Titel; jede aufgegangene Kennung führt auf genau einen Kopf; Suche „Steel Ball Run Phase 1" trifft den Kopf; `check:logic` mit dem JoJo-Fall.
5. **Gleichheitsbeweis:** Vorher/nachher-Vergleich der gebauten Ausgabe (`tools/bau-vergleich.mjs`), Abweichung nur an diesem Eintrag.
6. Der Normalfall (aniSearch-Bündel) nutzt denselben Pfad, sobald die Umstellung auf aniSearch als Hauptquelle läuft.

Stand heute: Die beiden aniSearch-Kennungen sind eingetragen (`data/anisearch-ids-hand.yaml`: AniList 190327 → 20466, AniList 210482 → 21986); das Bündel selbst ist noch nicht gebaut.
