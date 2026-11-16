# Mängel-Register: Gegenentwurf (16.11.2026, Auftrag maengel-gegenentwurf-1611)

Ziel: Der Bestand kennt jeden Mangel je Titel selbst, nach Wirkung geordnet, mit Abbau und Rückfallwache. Nur Entwurf, kein Code.

## Was es schon gibt (gemessen 16.11.2026)

| Baustein | Kann | Fehlt |
|---|---|---|
| `pipeline/bau/luecken-titel.ts` → `data/luecken-titel.json` (212 KB) | je Titel fehlende Felder `t j c m b`, Klassen `hb`/`kat`/`zeilen`, Zähler | nur 5 Felder; kein Alter, keine Wirkung, kein Besitzer; keine Wache |
| `data/cover-luecken.json` (2,9 KB) + `check-cover-luecken-wache.ts` | Grund je Titel (`nsfw`, `ohne-adresse`), Wache warnt | Warnung ohne Frist; nur Cover |
| `check-qualitaet.ts` → `data/qualitaet-verlauf.json` (22 KB, 81 Tage) | 12 Zähler je Tag, 3 harte (`HART`), Rückgangszeile im Workflow | nur Summen, keine Titel, kein „neu/behoben“ |
| `tools/daten-detektiv/` (25 Regeln, `data/detektiv-bekannt.json`) | falsche/widersprüchliche Daten, Hebel = Wirkung × Sicherheit | läuft nur wöchentlich in `wache-woechentlich.mjs`; letzte committete Ausgabe vom 08.10.2026 (39 Tage alt) |
| `pruefung.ts`, `check:logic`, `check:handbelege` … | harte Widersprüche brechen ab | beantworten „kaputt?“, nicht „wie vollständig, wie alt?“ |

Befund: drei getrennte Töpfe (Felder, Widersprüche, Summen), keiner kennt Alter, Wirkung oder wer abbaut.
Stichprobe `titles.json` (2 923 Titel, Scan 54 ms): 1 034 Titel mit mindestens einem der Mängel Cover (2),
deutscher Titel (77), Jahr (6), Folgenzahl (20), Streaming-Weg (990). Die 990 sind überwiegend kein Mangel
(Kauf-/Disc-/TV-Titel), also braucht jede Art eine Regel für „zu Recht leer“.

## 1. Untergrenze (keine neue Pipeline-Datei)

Vorhandenes ausbauen, nichts daneben setzen:
- `luecken-titel.ts` um `w` (Weg, nur wenn Titel einen Termin in 90 Tagen hat) und `f` (Folgenzahl) erweitern.
- Neues Skript `check:maengel`: vergleicht `data/luecken-titel.json` mit der Fassung aus `git show HEAD:`.
  Titel schon im Altbestand, Feld früher gefüllt, jetzt leer = **RÜCKFALL**; Titel neu im Bestand mit Lücke = **NEU**.
  Druckt Zeilen `MAENGEL_RUECKFALL …`; `bestand-bauen.yml` meldet sie wie `STREAMING_RUECKGANG` (Exit 0, gelbe Meldung).
- Cover wird als weiteres `HART`-Feld in `check-qualitaet.ts` geführt (Soll 0 außer Einträge mit Grund in `cover-luecken.json`).
Ordnung nach Wirkung: Titel mit Termin in 30 Tagen vor laufend vor Rang `tr` (`titel-rang.ts`) vor Rest, nur beim Lesen sortiert.
Kosten: ~60 Zeilen, 0 neue Datenbestände, Bau +<0,1 s. Grenze: kein Alter, kein Besitzer, kein Abbau; „zu Recht leer“ fehlt.

## 2. Variante A: Mängel-Register im Bau (eine Datei, ein Zustand)

**Wo erzeugt:** neue Phase `pipeline/bau/13-12-maengel.ts` hinter `13-11-cover-luecken.ts`, liest `public/data/*`,
die Regeln des Detektivs (`regel.ts` wiederverwenden, keine zweite Fassung) und `luecken-titel`. Schreibt `data/maengel.json`.
Vorstand = die eigene committete Datei: `seit` wird fortgeschrieben, nicht neu gesetzt.

```json
{"stand":"2026-11-16","zaehler":{"cover":{"offen":2,"neu":0,"behoben":0,"rueckfall":0}},
 "zeilen":[{"t":10019697,"art":"cover","wirkung":3,"seit":"2026-11-16","wer":"auto:cover-quelle","status":"offen"},
           {"t":495,"art":"ohne-beleg","wirkung":3,"seit":"2026-10-08","wer":"hand:synchro-belegen","status":"offen","frist":"2026-11-30"},
           {"t":10003528,"art":"cover","status":"ausnahme","grund":"ohne-adresse"}]}
```
`wer` kommt aus einer Tabelle Art → Abbauweg (`auto:<Quelle>` | `hand:<Skill>` | `daniel`), nicht vom Titel.
`wirkung` 1–3 wie der Detektiv; `ausnahme` ersetzt `detektiv-bekannt.json` und `cover-luecken.json` schrittweise (Grund bleibt).
**Leser:** `check:maengel` (Wache wie in Untergrenze, jetzt mit Alter), Wochenwache (Top 10 je `wer`), `stand.md` nur für `daniel`/`hand`.
**Abbau messen:** `qualitaet-verlauf.json` bekommt je Art `offen/neu/behoben/rueckfall` pro Tag; Rückfall = Zeile
`behoben` im Vorstand, jetzt wieder offen. Soll: Rückfall bleibt 0, `offen` je Art fällt wöchentlich.
**Kosten:** ~1 100 Zeilen × ~110 B ≈ 120 KB (heute 5 Arten roh 24 KB, plus Felder); gleiche Größenklasse wie
`luecken-titel.json`. Verlauf +~40 % (22 → ~30 KB). Bau +0,1 s (Scan) plus Detektiv-Regeln (Laufzeit nicht gemessen: erst messen).
**Risiken:** (1) Fehlalarm-Flut, solange „zu Recht leer“ nicht je Art geklärt ist; (2) zwei Wahrheiten, wenn
`luecken-titel.json` bleibt, also ersetzen, nicht ergänzen; (3) Phase liegt im Bau-Pfad, `check:umfang` darf nicht steigen.

## 3. Variante B: Register plus Ereignisprotokoll plus Abbau-Lauf

Wie A, zusätzlich:
- `data/maengel-ereignisse.jsonl`: eine Zeile je Zustandswechsel `{"t":..,"art":"cover","ereignis":"auf|zu|rueckfall","am":..}`.
  Daraus folgen Alter, Abbaugeschwindigkeit je Art und „wie oft wiedergekehrt“ ohne Vorstand-Vergleich.
- Workflow `maengel-abbau.yml` (Cloudflare-Wecker, täglich): je `auto:`-Art ein Fixer, der **per Pull Request** liefert
  (Regel: auf `main` schreibt nur der Bestandsbau; Beleg `data/dub-confirmed.yaml`-Vorrang bleibt).
- Rückfall bei Art mit Stufe „hart“ lässt die PR-Prüfkette rot werden (`pruefung.ts`), nicht nur melden.
**Kosten:** Ereignisse wachsen append-only; Vergleich `data/bestand-historie.jsonl` = 6,7 MB, also Monatsdateien
oder Kürzung nach 90 Tagen einplanen. Dazu ein Workflow, ein Fixer je Art, PR-Rauschen.
**Risiken:** Bot-PRs und Bestandsbau schreiben dieselben Dateien (Merge-Konflikte); Fixer „heilt“ aus schwacher
Quelle (verstößt gegen „nichts behaupten, was nicht belegt ist“, darum nur Quellen mit Beleg-Stufe, z. B. `tmdb-poster.json`,
`anisearch-cover.json`, die `coverFehltTrotzQuelle` ohnehin kennt); ein roter Riegel kann Deploys blockieren.

## 4. Empfehlung

Variante A, gebaut über die Untergrenze (jeder Schritt hilft allein). B erst, wenn A zeigt, dass `offen` je Art
nach vier Wochen nicht fällt; dann ist der Abbau-Lauf das gemessene nächste Stück, kein Vorrat.

Bauschritte, je ein PR:
1. **Wache auf dem Vorhandenen:** `luecken-titel.ts` um `w` und `f`; `check:maengel` (NEU/RÜCKFALL gegen `git show HEAD:`),
   Verdrahtung in `bestand-bauen.yml` wie `STREAMING_RUECKGANG`, Cover in `HART`. Test mit Kulisse wie `check-cover-luecken-wache.ts`.
2. **Register:** Phase `13-12-maengel.ts` mit Datenform oben, `luecken-titel.json` und `cover-luecken.json` gehen darin auf
   (Bau-Vergleich `tools/bau-vergleich.mjs`: Umbau ohne Verhaltensänderung, Inhalt gleich). Tabelle Art → `wer`, Ausnahmen mit Grund.
3. **Alter und Wirkung sichtbar:** Verlaufszeile je Art in `qualitaet-verlauf.json`, Detektiv-Regeln als Quelle des Registers
   (Ausgabe in `daniel-zum-abarbeiten/` entfällt, die Wochenwache liest das Register), Top 10 je `wer` in der Wochenwache.
Beobachtung (Regel „mehrstufig“): erster Bau, nach fünf Bauen, nach einem Tag, nach einer Woche; Soll Rückfall 0.

## 5. Bewusst weggelassen

- **Mangelfeld in `titles.json`:** Mehrheitsregel und Ladelast (3,9 MB roh); Mängel sind intern, Besucher brauchen sie nicht.
- **Oberfläche/Dashboard für Besucher, Qualitätsscore je Titel:** Kein Projektziel („Bewertungen“), Zahl wäre erfunden.
- **Katalogtitel (`kat`: 14 018, davon 13 961 ohne deutschen Titel):** zu Recht leer, würde jede Liste ertränken; nur Hauptbestand und Zeilen mit Termin.
- **D1/Datenbank für Mängel:** `data/*.json` reicht bei ~1 100 Zeilen; Auswertungen laufen nie an der echten D1.
- **Automatisches Füllen aus schwachen Quellen** (Fremdangabe ohne Beleg): gestrichen wird nur, was eine Quelle widerlegt, gefüllt wird nur mit Beleg.
- **Neue harte Schwellen, die den Bau rot machen:** nur Soll-null-Arten (Cover, Doppeladressen); der Rest darf schlechter werden, solange er sichtbar bleibt (Grundsatz aus `check-qualitaet.ts`).
- **Ersatz der Detektiv-Regeln:** sie werden eingebunden, nicht neu geschrieben.
- **Nicht untersucht:** warum der Titel ohne Cover live ging (Wache warnt nur); gehört vor Schritt 1 in die Fünf-Stufen-Analyse.
