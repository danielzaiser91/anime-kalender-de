---
name: selbst-testen-vor-der-bitte
description: "Bevor Daniel um einen Test, Klick oder eine Rückmeldung gebeten wird: alles selbst prüfen, was ohne ihn geht; auch beim Anbinden einer fremden Schnittstelle."
---

# Was Daniel prüfen soll, wird vorher selbst geprüft

## Die Regel

**Bevor eine Bitte um Prüfung rausgeht, wird alles daran selbst geprüft, was ohne ihn prüfbar
ist.** Nicht die Sache, um die es geht — die kann er oft allein beantworten. Sondern
**die Bitte selbst**: Führt der Link irgendwohin? Läuft der Befehl? Kommt die Meldung an?

Der Grund ist nicht Höflichkeit. Es ist die **teuerste Art, einen Tippfehler zu finden**: Er
lädt eine Erweiterung neu, öffnet eine Seite, klickt — und stößt auf etwas, das eine einzige
eigene Zeile vorher gezeigt hätte. Danach ist nicht nur seine Zeit weg, sondern auch das
Zutrauen in die nächste Bitte.

## Auch die Wirkung einer Änderung wird selbst gemessen (Daniel, 06.10.2026)

Daniel hat einen Panel-Fix selbst geprüft und mich testen lassen, ohne das Ergebnis zu nennen; ich habe Deploy und Live-Seite
mit Playwright gemessen (Kartenhöhe gegen Scrollhöhe, Texte, Klickverhalten) und das Ergebnis richtig bestimmt. Seine Antwort:
„mach dieses selbstständige testen ab jetzt immer, sodass ich nicht mehr unnötige Daniel-Todos bekomme". Das gilt für **jede**
Änderung, die in der Seite, in Daten oder in einem Lauf sichtbar wird: nach dem Push einen **Hintergrundjob auf den Deploy bzw.
Lauf** starten (nie nur einen Wecker), danach auf der Live-Seite messen, Messwerte melden. Ein Daniel-Auftrag entsteht nur, wo
etwas wirklich nur er kann (Konto, Geld, Entscheidung, echtes Gerät).

Das Selbstprüfen darf an einen Prüfer-Subagenten gehen (Skill `delegieren-und-parallelisieren`); gemeldet wird erst, was ich anhand seines Berichts nachgesehen habe.

## Die Prüffrage

> **Was an dieser Bitte kann ich selbst zum Scheitern bringen, bevor er es tut?**

Und für alles, was diese Frage zutage fördert: erst selbst versuchen.

## Je nach Art der Bitte

| Bitte enthält | selbst prüfbar durch |
|---|---|
| einen Link | `curl -s -o /dev/null -w "%{http_code}"` — führt er irgendwohin? |
| einen Bezeichner (ID, ASIN, Pfad) | steht er wörtlich in einer Werkzeugausgabe dieses Gesprächs? |
| einen Befehl | einmal selbst ausführen, wenn er nichts Fremdes verändert |
| eine neu gebaute Oberfläche | die Auswertung dahinter mit echten Daten durchrechnen |
| **eine Meldung an eine Schnittstelle** | **die Gegenseite lesen — siehe unten** |
| eine Zahl | aus den Daten holen, nicht erinnern |
| „schalte X im Dashboard ein“ | Zustand per CLI/API messen (`wrangler r2 bucket list` u. ä.) — R2 lief am 11.10.2026 schon seit 10 Tagen, als ich darum bat |
| einen Lauf, der ein geteiltes Kontingent verbraucht (Erweiterungs-Durchgang → D1-Lesen/-Schreiben) | Tagesverbrauch messen (`wrangler d1 insights … --timePeriod 1d`) und erst freigeben, wenn Grundlast + Lauf unter dem Limit bleibt und ein Deckel den Lauf vorher anhält. Am 12.10.2026 gab ich drei Durchgänge frei, bevor der Lesehebel live war, und um 14:20 stand das ganze Konto bis 02:00 |

## Der Sonderfall: eine fremde Schnittstelle bedienen

**Wer ein Feld befüllt, das jemand anders prüft, liest dessen Prüfung.** Nicht die
Dokumentation, nicht die eigene Vorstellung davon, was sinnvoll wäre — den Code, der die
Annahme entscheidet.

Das gilt für Feldnamen, Wertebereiche, Pflichtfelder, Formate und Statuscodes. Diese Werte
fühlen sich wie inhaltliche Entscheidungen an und nicht wie Kennungen; genau deshalb rutschen
sie durch.

**Und die Kopplung gehört in eine Zusicherung**, nicht in einen Kommentar: Ein Test, der die
erlaubten Werte **aus der Gegenseite liest** und die eigene Seite dagegen hält. Eine im Test
fest eingetragene Liste wiederholt den Fehler nur — sie ist dieselbe Vermutung, zweimal
aufgeschrieben.

```js
// So, nicht mit einer eigenen Liste:
const worker = readFileSync('worker/src/index.ts', 'utf8')
const erlaubt = /\[([^\]]*)\]\.includes\(befund\)/.exec(worker)[1].split(',').map(…)
pruefe('gemeldete Befunde stehen in der Worker-Liste', benutzt.every((b) => erlaubt.includes(b)))
```

## Wo die Grenze liegt

Diese Regel verlangt **nicht**, das Unmögliche zu testen. Was Daniels Konto, sein Bildschirm
oder sein Urteil braucht, kann nur er beantworten — genau dafür ist die Bitte da. Sie verlangt,
dass **der Weg dorthin** trägt.

Auch kein Grund zum Zögern: Lieber eine geprüfte Bitte zu viel als eine Aufgabe, die still
liegen bleibt. Die Regel senkt die Zahl der Bitten nicht, sie erhöht ihre Trefferquote.

## Die zwei realen Fälle (23.08.2026, beide am selben Tag)

**Drei erfundene Amazon-Adressen.** Zur Prüfung von 101 Zugangsarten sollte Daniel drei Titel
ansehen. Die Adressen waren nach dem Muster gebaut, nicht aus den Daten geholt. Ergebnis: zwei
404, eine führte zu Bremsscheiben. **Ein `curl` mit Statuscode hätte alle drei gezeigt** —
zehn Sekunden.

**`befund: 'ja'` statt `'dub'`.** Eine frisch gebaute Erweiterung meldete an einen Worker, der
`['dub', 'kein_dub', 'weg']` erwartet. Daniel lud die Erweiterung neu, öffnete Amazon, klickte —
HTTP 400. **Ein einziger eigener Testaufruf hätte es gezeigt**, und die gültige Liste stand zwei
Dateien weiter im selben Repo.

Beide Fehler haben dieselbe Form: Nicht die Sache war falsch, sondern der Weg zu ihr — und
beide wären an der Prüffrage oben gescheitert.

## Verwandt

- `pruefen-und-belegen` — dort geht es um **Aussagen**, hier um **Bitten**. Der Unterschied ist
  der Auslöser: Dieser Skill greift, sobald eine Antwort einen Link, einen Befehl, einen
  Testfall oder eine Frage an Daniel enthält.
- `befehle-fuer-daniel` — wie ein Befehl aussehen muss, damit er bei ihm läuft. Ob er läuft,
  klärt dieser Skill.

## Eine schnelle Rückmeldung ersetzt keinen Test — sie verdeckt, dass er fehlt

Daniel am 26.08.2026, nachdem ich in derselben Sitzung erst schlecht und dann gut gearbeitet
hatte: „woher der sinneswandel das du plötzlich sicher gehen willst? vorhin bei extension
erweiterung stumpf immer weiter gearbeitet statt durchzutesten."

Der Unterschied lag nicht an der Aufgabe, sondern **am Rückkanal**.

**Bei der Erweiterung** lief es so: Er meldet einen Fehler, ich baue einen Fix, ich rolle aus,
er meldet den nächsten. Neun Fassungen an einem Vormittag. Seine Rückmeldung war mein Test —
und weil sie zuverlässig kam, entstand nie Druck, selbst zu prüfen. Die Arbeit lag bei ihm,
und **genau das fällt nicht auf**, solange die Rückmeldungen weiterlaufen.

**Bei der Messung** gab es diesen Kanal nicht. Ich konnte nichts ausliefern und abwarten; jedes
Ergebnis musste ich selbst lesen, um den nächsten Schritt zu planen. Die Gegenprobe war dann
kein zusätzlicher Aufwand, sondern der einzige Weg voran — und sie hat sofort getragen
(`getVideoMetadataByVideoId` sah nach einer Lösung aus und war ein Zwischenspeicher).

**Prüffrage, sobald jemand nach jedem Schritt zurückmeldet:** *Teste ich hier noch selbst, oder
lasse ich testen?* Ein Mensch, der nach jeder Fassung Bescheid gibt, ist kein Testlauf — er ist
jemand, dessen Zeit gerade verbraucht wird.

**Zwei Verstärker, beide am selben Tag belegt:**

- **Wer das Ergebnis kennt, sieht es auch dann, wenn es nicht da ist.** Bei der Erweiterung
  wusste ich, welche Zahl am Knopf stehen soll. Bei der Messung wusste ich gar nichts — also
  musste gemessen werden.
- **Je kleiner die Änderung, desto stärker die Einladung, den Gegentest zu lassen.** Ein
  Einzeiler, der offensichtlich stimmt, ist genau der Fall, in dem er am nötigsten ist.

## Format eines Prüfauftrags (Daniel, 05.10.2026)

Anlass: Prüfaufträge kamen als Fließtext, mal ohne Link, mal mit Link auf die Startseite, mal ohne zu sagen, woran „stimmt" zu erkennen ist.
Daniel soll **testen, nicht suchen** — angenehm, schnell, einfach. Jeder Auftrag hat dieses Muster:

```
**Prüfen: <Gegenstand in drei bis sechs Wörtern>**
1. [Ziel-Beschriftung](https://… geprüfte Adresse)
   Vorher: <was zu sehen war>
   Erwartet: <was jetzt dort steht — wörtlich, mit Ort auf der Seite>
   Falsch, wenn: <woran er einen Fehler erkennt>
2. …
Antwort reicht: „ok" oder die Nummer, die nicht stimmt.
```

- **Ein Link je Punkt, der den Zustand mitbringt:** Titel (`#/datenbank?t=<ak>`), Ansicht (`#/news`), Suche (`?q=…`), Filter, Datum (`d=`). Nie die Startseite mit der Bitte „such dann …".
  Die Adresse stammt aus einer Werkzeugausgabe (`curl` → 200) und die Kennung aus den ausgelieferten Daten, nicht aus dem Kopf.
  **`ak` ist nicht das `id`-Feld in `titles.json`** (das ist die AniList-ID und öffnet „keine Metadaten“): ak = erstes Feld je Eintrag in `data/kennungen.json` → `titel`. Am sichersten `https://anime-kalender.de/t/<ak>/` — `curl -s … | grep -o '<title>[^<]*'` muss den Titelnamen zeigen, ein Hash-Link lässt sich per curl nicht prüfen (16.10.2026, zwei tote Links in einer Prüfliste).
- **Reihenfolge spart Klicks:** erst alles auf einer Seite, dann die nächste; Punkte, die Zustand brauchen (angemeldet, Favorit gesetzt, Handy-Breite), sagen es in der ersten Zeile des Punkts.
- **Nur Live-Zustand:** Läuft Bau oder Deploy noch, steht der Auftrag als 📅-Zeile im Footer („ab ca. 14:25 Uhr"), nicht im Text (Merkzettel `feedback-pruefauftrag-vorher-nachher`).
- **Was ich selbst prüfen kann, prüfe ich vorher** und nenne es kurz („Ich habe … live gemessen"), damit seine Prüfung nur das enthält, was nur er sehen kann (Gefühl, Lesbarkeit, Inhalt).
- **Mehrere Aufträge in einer Antwort:** eine nummerierte Liste, nicht Absätze; Entscheidungen (🙋) und Prüfungen (📅) bleiben im Footer getrennt.
