# Durchgang 19.09.2026, 19:05 — alle Schritte vorbereitet

Kurzschrift: `1` ja/deutsch · `0` nein · `x` gibt es dort nicht.

## A · Netflix-Prüfliste (1)

1. **Bakugan (2023), 26 Folgen** — [Bei Netflix öffnen](https://www.netflix.com/title/81659233)
   Handgriff: Knopf der Erweiterung „▶ E1 + E26 prüfen → gilt für E1–26".
   Frage: Meldet die Erweiterung danach „✓ gemeldet"?
   → ja: Briefkasten prüfen, Beleg steht. → nein/anderer Text: Bild erbitten.

## B · Suchadresse (1)

2. **Jormungand: Perfect Order** (unser Titel 13331) bei Prime Video — die Titelseite suchen:
   [Prime-Suche öffnen](https://www.amazon.de/s?k=Jormungand%3A%20Perfect%20Order&i=instant-video)
   Frage: Adresse der Video-Seite (`/gp/video/detail/…`) hier einfügen — oder `x`, wenn es sie nicht gibt.
   → Adresse: in `18-suchadressen.md` eintragen, Bau zieht sie. → x: als „nicht vorhanden" buchen.

## C · Prime-Wege ohne Sprachurteil (4)

Handgriff je Link: in der Erweiterung „melden“ drücken (nicht im Chat antworten).
3. **Fushigi Yûgi New OVA** — [öffnen](https://www.amazon.de/dp/B0CJZH535R)
4. **Haikyu!!** — [öffnen](https://www.amazon.de/dp/B0D4K9PV2F)
5. **Grisaia Phantom Trigger: The Animation** — [öffnen](https://www.amazon.de/dp/B0DMMT9B67)
6. **Edens Zero: Season 2** — [öffnen](https://www.amazon.de/gp/video/detail/0KXOMCNFCKPTA6Z6HNIJ0ESQ9P)
   → `1`/`0`: Handbeleg in `data/dub-confirmed.yaml`. → `x`: Weg als tot melden.

## D · JustWatch-Kandidaten (14)

Liste mit Links: `docs/prime-kandidaten-justwatch.md`. Je Zeile: stimmt der Titel, steht Deutsch?
Antwort `ok` / `falscher Titel` / `kein Deutsch`, gern mehrere auf einmal („1 ok, 2 ok, 3 kein Deutsch").
7–20: Zeilen 1–14 der Tabelle.
→ ok: Adresse als Prime-Weg mit `dub: true` übernehmen. → sonst: verwerfen, Grund notieren.

## E · Amazon-Messskript

21. `node tools/prime-geteilte-adressen.mjs` im Ordner anime-kalender-de ausführen (69 Abrufe),
    Ausgabe hier einfügen. → je Fall nach Seitentitel korrigieren.

## F · Entscheidung

22. „kostenlos" auch auf Kalenderkarten/Datenbank (+ Filter)? „Premiere" auch auf Kalenderkarten?
