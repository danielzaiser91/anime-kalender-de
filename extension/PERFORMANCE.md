# Wo die Zeit je Takt hingeht — Prime-Erweiterung

Review vom 25.08.2026, Stand der Datei: **Erweiterung 2.0**.

Ausgelöst hat es Daniels Befund „it impacts performance drastically", dazu Ruckeln beim
Navigieren und zwei Tab-Abstürze mit „Aw, Snap! Error code: Out of Memory" (24. und 25.08.2026).

`status.md` führt daraus nur die Aufgabenliste. Die Messwerte, die Begründungen und vor allem
die **Verhaltensrisiken je Änderung** stehen hier — wer eine der genannten Stellen anfasst,
liest vorher den zugehörigen Abschnitt. Mehrere davon sind Reparaturen echter Fehlschläge, und
ein „aufgeräumter" Regex würde sie zurückbauen.

---

## 0. Was 2.0 bereits erledigt hat

| erledigt in 2.0 | Wirkung |
|---|---|
| `seitenTitel()`: Anker zuerst, dann 120 Zeichen zurücklesen (`amazon.js:850`) | **179,6 ms → 1,8 ms** je Durchlauf bei 2,2 Mio. Zeichen |
| Der Takt geht auf 4.000 ms, sobald der Zählstand vollständig ist (`amazon.js:2950`) | nimmt den Dauerposten auf fertig gelesenen Seiten weg |
| `asinAusSeite()`: ein `exec` mit Zwischenspeicher (`amazon.js:462`) | 0,001 ms — das Vorbild für die übrigen Ableitungen |
| `regionFolgenAusDom()`: `includes`-Wächter vor dem XPath (`amazon.js:189`) | 0,42 ms statt eines Baumdurchlaufs |

**Die Messung aus Daniels Sitzung, die den Anlass belegt:** `taktSchnitt: 226 ms`,
`taktMax: 417 ms` bei einem Takt von 500 ms — die Erweiterung verbrauchte 45 % der Zeit. Dazu
die Größe, die vorher niemand nachgesehen hatte: Der Quelltext einer Prime-Seite ist **2,2
Millionen Zeichen** groß, nicht die anfangs angenommene knappe Million. Alle Zahlen dieses
Reviews, die auf 994.000 Zeichen beruhen, sind damit **um gut das Doppelte zu niedrig**.

**Was noch offen ist:** die Funde 2 bis 9 unten. Nach 2.0 ist keine Einzelstelle mehr
dreistellig — der Rest ist Vervielfachung: dieselben Ableitungen mehrfach je Takt, in zwei
Welten getrennt, hinter einem Sparschalter, der zu spät kommt.

---

## 1. Wie gemessen wurde

`tools/amazon-regex-kosten.js` baut einen synthetischen Prime-Quelltext und stoppt jeden
Durchlauf einzeln, je 20 Runden nach einem Aufwärmlauf.

```bash
node tools/amazon-regex-kosten.js
```

Drei Durchgänge: die echte Größe (2,2 Mio. Zeichen, realistische Tag-Dichte), dieselbe Seite
bei 994.000 Zeichen, und 994.000 Zeichen als reine JSON-Fracht ohne Tags. Der dritte Durchgang
ist die Gegenprobe darauf, dass die Zahlen nicht an der Füllmasse hängen.

Gelaufen unter Node (V8) — für die Muster ist das derselbe Motor wie in Chrome und damit
dieselbe Größenordnung.

**Was Node nicht messen kann**, und das sind ausgerechnet die beiden teuersten Zugriffe der
Erweiterung überhaupt:

- `document.documentElement.innerHTML` — baut die Zeichenkette aus dem Baum jedes Mal neu auf
- `document.body.innerText` — erzwingt ein Layout über die ganze Seite

Dafür braucht es einen echten Browser auf einer echten Prime-Seite. Das ist die eine offene
Messung dieses Reviews (Abschnitt 6).

### Die Messwerte, 25.08.2026

| Stelle | 2,2 Mio. | 994 Tsd. | 994 Tsd. ohne Tags |
|---|---|---|---|
| `seitenTitel()` **ALT** (bis 1.9), faules Zählquantiv | 179,62 ms | 81,75 ms | 116,44 ms |
| `seitenTitel()` **NEU** (ab 2.0), Anker + 120 Zeichen (`amazon.js:850`) | **1,84 ms** | 0,81 ms | 0,79 ms |
| `spuren()` — 2 `matchAll` gespreizt + 2 `exec` (`amazon.js:653`) | 1,62 ms | 0,71 ms | 0,68 ms |
| `zugangsart()` — 5 Muster ohne Anker (`amazon.js:910`) | 1,42 ms | 0,61 ms | 0,61 ms |
| Leser `ausSeite()` — `[...matchAll(/titleID/g)]` (`amazon-leser.js:332`) | 1,23 ms | 0,53 ms | 0,53 ms |
| `seitenLage()` — 4 Muster über sichtbar+Quelltext (`amazon.js:217`) | 1,02 ms | 0,46 ms | 0,43 ms |
| `offeneZahl()` — 85 Listenzeilen × 300 Meldungen (`amazon.js:1166`) | 0,94 ms | — | — |
| Leser `ausSeite()` — `episodePages` 20k + `replace` (`amazon-leser.js:350`) | 0,69 ms | 0,29 ms | 0,30 ms |
| Leser `abschnittsFinger()` — Ausschnitt + `exec` (`amazon-leser.js:465`) | 0,68 ms | 0,30 ms | 0,29 ms |
| `regionFolgenAusDom()` `includes`-Wächter (`amazon.js:189`) | 0,42 ms | 0,18 ms | 0,17 ms |
| `seitenTitel()` `pageTitle`-Rückfall (`amazon.js:863`) | 0,25 ms | 0,11 ms | 0,11 ms |
| `abos()` (`amazon.js:965`) | 0,22 ms | 0,10 ms | 0,10 ms |
| `staffelAusSeite()` — `matchAll` faul, bricht früh ab (`amazon.js:514`) | 0,006 ms | 0,003 ms | 0,003 ms |
| `asinAusSeite()` — ein `exec`, gecacht (`amazon.js:462`) | 0,001 ms | 0,001 ms | 0,000 ms |

**Der 2.0-Fix ist unabhängig bestätigt: Faktor 97 bei der echten Seitengröße** (179,62 → 1,84
ms), und das Ergebnis der beiden Fassungen ist identisch. Die alte Zeile bleibt im Messwerkzeug
stehen, damit der Gewinn nachprüfbar bleibt statt behauptet.

### Was ausdrücklich nicht schuld ist

Diese Punkte standen unter Verdacht und sind gemessen entlastet. Sie stehen hier, damit die
nächste Runde nicht wieder bei ihnen anfängt:

- **`melder.js` ist unbeteiligt.** Laut `manifest.json` läuft es ausschließlich auf
  `netflix.com`. Auf einer Prime-Seite existiert es nicht.
- **`staffelAusSeite()` ist billig** (0,006 ms), obwohl es über `titleID` iteriert: Die Schleife
  benutzt `for … of html.matchAll(…)` — **faul**, kein Spread. Sie bricht bei der ersten
  brauchbaren Fundstelle ab, die 220 Fundstellen der Digimon-Seite werden nie alle angefasst.
  *Nicht „optimieren".*
- **`asinAusSeite()` ist bereits gelöst** (0,001 ms): ein einzelnes `exec` plus Zwischenspeicher
  an `htmlGelesenAm`. Genau dieses Muster fehlt den übrigen Ableitungen (Fund 4).
- **Die `regionFolgenAusDom()`-Vorprüfung trägt.** 0,42 ms `includes` statt eines XPath über
  den ganzen Baum.
- **Die Tag-Dichte ist nicht die Ursache.** Ohne Tags werden die Zahlen eher schlechter, nicht
  besser — bei der alten `seitenTitel()`-Fassung 116 statt 82 ms.

---

## 2. Die offenen Funde, nach erwartetem Gewinn

### Fund 2 — Der Mitleser baut `innerHTML` zweimal je 500 ms · `amazon-leser.js:465` und `:318`

`schritt()` (`amazon-leser.js:681`) ruft je Takt

- `beiSeitenwechsel()` → `abschnittsFinger()` → `document.body.textContent` **plus**
  `documentElement.innerHTML`
- `ausSeite()` → `documentElement.innerHTML` noch einmal

**Kosten: rund 9 MB Zeichenketten je Sekunde je Prime-Tab** (2 × 2,2 MB je 500 ms, dazu
`body.textContent`), 30 Sekunden lang. `amazon-leser.js` läuft in der **Seitenwelt** und hat vom
2-Sekunden-Zwischenspeicher in `amazon.js` nichts — zwei Welten, zwei Kopien. Der adaptive Takt
aus 2.0 hilft hier nicht: Er sitzt in `amazon.js`.

**Und die schnelle Phase endet oft gar nicht früher.** `schritt()` schaltet auf den gemächlichen
Takt um, wenn `diagnose.tokensImQuelltext` gesetzt ist **oder** 60 Anläufe um sind
(`amazon-leser.js:683`). Bei Filmen und bei Staffeln mit nur einem Abschnitt — der Mehrheit —
wird nie ein Token gefunden. Die 30 Sekunden laufen dann immer voll durch.

Danach bleibt `abschnittsFinger()` alle 4 Sekunden: rund 2,2 MB je Aufruf, dauerhaft, auf einer
Seite, die stundenlang offen ist.

**Das erklärt die Abstürze besser als der bereits behobene Achtfach-Zugriff in `amazon.js`.**
Chrome hält alle Tabs derselben Site in **einem** Renderer-Prozess; der Müll mehrerer
Prime-Tabs summiert sich dort. Daniel am 25.08.: „nach ca 20 meldungen in a row, crashed es …
memory leak??"

**Vorgeschlagene Änderung:** `schritt()` liest den Quelltext **einmal** und reicht ihn an beide
durch.

```js
function schritt() {
  const html = document.documentElement?.innerHTML ?? ''
  beiSeitenwechsel(html)
  if (++diagnose.anlaeufe > 60 || diagnose.tokensImQuelltext) { takten(true); return }
  try { ausSeite(html) } catch (err) { … }
}
```

`beiSeitenwechsel()` wird auch vom gemächlichen Takt ohne Argument gerufen
(`amazon-leser.js:678`) — dort liest `abschnittsFinger()` weiter selbst. Der Parameter ist also
optional.

**Risiko: keines.** Beide lesen ohnehin denselben Stand im selben Durchlauf; sie lesen ihn
derzeit nur getrennt.

---

### Fund 3 — Der `textContent`-Wächter spart nichts · `amazon-leser.js:479`

```js
if (!document.body?.textContent?.includes('Folgen')) return ''
```

Der Kommentar darüber begründet ihn damit, `textContent` sei „um ein Vielfaches kleiner" als
`innerHTML`. Das stimmt — nur greift der Wächter nie: Auf einer Prime-**Titelseite** steht
„Folgen" praktisch immer (Reiter, Zwischenüberschrift, Kachelbeschriftung). Er verhindert das
teure `innerHTML` also genau dort nicht, wo die Erweiterung arbeitet, und baut selbst eine
Zeichenkette über den ganzen Baum auf.

**Vorgeschlagene Änderung:** Mit Fund 2 zusammen erledigt — der Finger benutzt dann den ohnehin
gelesenen Quelltext, und der Wächter kann weg.

**Risiko bei der naheliegenden Alternative — den Finger nur bei geändertem Pfad zu bilden:
mittel bis hoch.** Der Finger ist ausdrücklich das Merkmal, das einen Dropdown-Wechsel **ohne**
Adressänderung fängt (`amazon-leser.js:580` ff., dokumentiert am 24.08.: „beim ersten Laden
klappte es, nach dem Dropdown-Wechsel nicht mehr"). An den Pfad gekoppelt fällt genau dieser
Fall wieder weg. Also: Quelltext teilen, **nicht** den Finger seltener bilden.

---

### Fund 4 — Dieselbe Ableitung mehrfach je Takt · `amazon.js:1912` ff.

| Aufruf | wie oft je Takt | Fundstellen |
|---|---|---|
| `seitenTitel()` | 3–5× | `staffelKennung()` 2771, `quelltextVeraltet()` 2790 (über 1913 **und** 1989), `zustandAlsText()` 1803 |
| `spuren()` | 2–4× | `quelltextPasst()` 1881, Zeile 1913, Zeile 1949, Diagnosefeld 1989 |
| `quelltextPasst()` | 2–3× | Zeilen 1913, 1949, 1989 |
| `abos()` | 4× | `ueberKanal()` 956, darin `zugangsart()` 918, erneut über 2365 |
| `zugangsart()` | 2× | `ueberKanal()` 959, `art` 2365 |
| `staffelAusSeite()` | 3× | Zeile 2544, `staffelSchluessel()` 592, `zustandAlsText()` 1801 |

Bei 2,2 Mio. Zeichen summiert sich das auf rund **15–20 ms je Takt**, allein an Mustern — ohne
den `innerHTML`-Aufbau und ohne den Reflow.

**Vorgeschlagene Änderung:** `spuren()`, `zugangsart()`, `abos()` und `ueberKanal()` sind reine
Funktionen von `seitenHtml()`. Sie bekommen denselben Zwischenspeicher, den `asinAusSeite()`
(`amazon.js:462`) und `seitenLage()` (`amazon.js:217`) schon haben — Schlüssel `htmlGelesenAm`.

```js
let spurenCache = null, spurenZu = -1
function spuren() {
  const text = seitenHtml()          // muss zuerst laufen, setzt htmlGelesenAm
  if (spurenZu === htmlGelesenAm) return spurenCache
  …
  spurenZu = htmlGelesenAm
  return spurenCache
}
```

**Risiko: keines für diese vier.** Aber drei Fallen, die dokumentiert gehören:

- **Die Reihenfolge ist Teil des Musters.** `seitenHtml()` muss **vor** dem Vergleich mit
  `htmlGelesenAm` laufen, sonst prüft der Zwischenspeicher gegen den Stand von vorhin.
  `asinAusSeite()` und `seitenLage()` machen es richtig vor.
- **`quelltextVeraltet()` ist nicht rein — es verändert `titelZuQuelltext`.** Merken **je Takt**
  ist unschädlich, weil der Aufruf nach dem ersten Mal idempotent wird: Der erste Ruf setzt oder
  erneuert das Paar, jeder weitere sieht das aktuelle und liefert dasselbe Ergebnis. Ein
  Zwischenspeicher **über Takte hinweg** wäre falsch — dann bliebe die Paar-Fortschreibung aus
  und der Wächter käme nie wieder heraus. Genau dieser Fehler ist am 25.08. schon einmal
  passiert (siehe `quelltextGehoertZurSeite()`, `amazon.js:2830`).
- **`spuren()` gibt ein Objekt mit `Set`-Feldern zurück.** Sobald es geteilt wird, darf kein
  Aufrufer es verändern. Derzeit liest `zeichnen()` nur — wer den Zwischenspeicher einbaut,
  prüft das mit.

---

### Fund 5 — Der Sparschalter steht hinter der Arbeit · `amazon.js:2061`

```js
const stand = `${deutsch}|${geladen}|${gesehen.gesamt}|${wartet}|${zahlenStehen}`
if (stand === letzterStand) return
```

Diese Zeile sitzt **nach** `quelltextPasst()`, zwei bis vier `spuren()`, dem `JSON.stringify`
des Diagnosefelds und `seitenLage()`. Auf einer Seite, an der sich nichts ändert — dem
Normalfall, wenn Daniel liest statt klickt — wird also fast die volle Rechnung bezahlt und das
Ergebnis anschließend weggeworfen.

**Vorgeschlagene Änderung:** Mit den Funden 4 und 6 zusammen erledigt sich das, weil die
Rechnung dann im Mikrosekundenbereich liegt. Der Schalter selbst muss nicht wandern.

**Risiko, falls man ihn doch vorzieht: klein bis mittel.** Die Signatur enthält `wartet` und
`zahlenStehen`, beide zeitabhängig, und `geladen`/`gesehen.gesamt` entstehen erst aus
`spuren()`. Ein früherer Ausstieg müsste die zeitabhängigen Teile weiterhin je Takt auswerten —
sonst kehrt der Fehler vom 24.08. zurück, bei dem der Knopf für immer auf „Staffel wechselt —
einen Moment" stehen blieb, weil eine ablaufende Frist die Signatur nicht ändert.

---

### Fund 6 — Das Diagnosefeld rechnet neu statt zu lesen · `amazon.js:1984`

```js
knopf.dataset.diag = JSON.stringify({
  …
  quelltextPasst: quelltextPasst(),       // schon in Zeile 1913 berechnet
  quelltextVeraltet: quelltextVeraltet(), // zieht seitenTitel() mit
  ausSeite: asinAusSeite(),
  ausAdresse: asinAusAdresse(),
  asinGemischt: asin(),
  quelltextZeichen: seitenHtml().length,
})
```

Der Kommentar darüber sagt, das koste „einen `JSON.stringify` über ein Objekt mit sieben Zahlen
— nichts gegen den Quelltext, der ohnehin gelesen wird". Das stimmt für den `stringify`, aber
nicht für die Aufrufe darin: Sie sind der Grund, warum `quelltextPasst()` und damit `spuren()`
und `seitenTitel()` ein weiteres Mal laufen.

**Vorgeschlagene Änderung:** Die Werte oben in lokale Variablen legen und hier nur lesen.
**Risiko: keines**, der Inhalt bleibt Zeichen für Zeichen derselbe.

**Was man dabei nicht tun darf:** das Diagnosefeld hinter den Sparschalter aus Fund 5 schieben.
Dann friert `dataset.diag` auf unveränderten Seiten ein — und über genau dieses Feld misst der
Knopf sich selbst (`taktMs`, `taktSchnitt`, `taktMax`). Der 25.08. ist zu einem guten Teil damit
hingegangen, den inneren Zustand von außen zu erraten; das Feld ist die Antwort darauf und
bleibt je Takt frisch.

---

### Fund 7 — `offeneZahl()` rechnet je Takt über alles · `amazon.js:1166`

```js
const offeneZahl = () => Object.keys(liste).filter((a) => !fertig(a)).length
```

`fertig()` (`amazon.js:1120`) → `staffelnDerSerie()` (`:1096`) → `serienGefaehrten()` (`:1089`)
→ `Object.keys(erledigt).filter(…)`. Bei 85 Listenzeilen (`offene-amazon.js`, Stand 25.08.2026)
und rund 300 Einträgen in `erledigt` sind das etwa **25.000 Durchläufe plus 85 Zwischenobjekte
je Aufruf — 0,94 ms gemessen**, und `uebersichtZeichnen()` (`:1185`) ruft es je Takt.

Bei **offener Übersicht** kommt `listenSignatur()` (`:1225`) mit derselben Rechnung dazu, dort
sogar zweimal je Zeile (`fortschritt()` **und** `fertig()`), plus ein `sort()` in
`dialogFuellen()`, dessen Vergleicher `fertig()` erneut aufruft — also O(n log n) weitere
Durchläufe.

**Vorgeschlagene Änderung:** Eine `Map` Serienname → Kennungen einmal aufbauen, statt je Aufruf
zu filtern.

**Risiko: keines**, mit einer Bedingung: Die Map muss an **jeder** Stelle neu gebaut werden, die
`erledigt` ersetzt. Es sind sechs:

| Zeile | Anlass |
|---|---|
| `amazon.js:1007` | synchroner Speicherstand (Testsandkasten) |
| `amazon.js:1012` | `standFertig.then(…)` beim Seitenaufbau |
| `amazon.js:1044` | `chrome.storage.onChanged` — Meldung aus einem anderen Tab |
| `amazon.js:1325` | „Abhaken zurücksetzen" |
| `amazon.js:1669` | Worker-Abgleich über `vereinige()` |
| `amazon.js:3357` | nach einer eigenen Meldung |

Wird eine vergessen, zeigt die Übersicht einen veralteten Stand — genau der Fehler, den der
`onChanged`-Hörer am 25.08. beheben sollte („der melde button aktualisiert erst nach weiteren
~5sek").

---

### Fund 8 — `uebersichtZeichnen()` schreibt bedingungslos · `amazon.js:1185`

`textContent`, `title` und `classList.toggle` werden je Takt neu gesetzt, auch wenn der Wert
gleich bleibt. Jede `textContent`-Zuweisung wirft den vorhandenen Textknoten weg und legt einen
neuen an.

**Vorgeschlagene Änderung:** vorher vergleichen. **Risiko: keines.**

---

### Fund 9 — Doppelter Schlüssel im Meldekörper · `amazon.js:3176` und `:3210`

```js
zugang: zugangsart(),   // Zeile 3176
…
zugang: zugangsart(),   // Zeile 3210
abos: abos(),
```

Derselbe Schlüssel steht zweimal im selben Objektliteral. Der zweite gewinnt, der erste ist ein
zusätzlicher Volltext-Durchlauf. Zusammen mit den beiden Aufrufen in der Notiz (`:3242`) läuft
`zugangsart()` beim Melden **viermal** und `abos()` rund sechsmal über 2,2 MB.

Kein Takt-Problem — es passiert nur beim Klick —, aber ein echter Doppeleintrag, und der
nächste, der die Kommentare dazwischen liest, hält ihn für zwei verschiedene Felder.

**Risiko: keines.** Der gesendete Körper bleibt unverändert.

---

### Fund 10 — Zwei Beobachtungen zum neuen adaptiven Takt (2.0) · `amazon.js:2950`

Keine Fehler, zwei Kanten, die beim nächsten Anfassen zählen:

- **Die Bremse greift nur bei vollständigem Zählstand.**
  `Boolean(gesehen.gesamt) && geladeneFolgen() >= gesehen.gesamt` ist auf einer Fehlerseite,
  einem Film ohne `gesamt`, einer Seite mit Regionshinweis oder während eines hängenden
  Nachladens **nie** wahr. Dort läuft der Takt weiter mit 500 ms — also genau auf den Seiten,
  auf denen ohnehin nichts mehr passiert. Ein zweiter Grund zum Bremsen („seit N Takten hat
  sich die Signatur nicht geändert") würde das abdecken; er müsste bei jedem Ereignis sofort
  zurückschalten, wie die vorhandene Bremse es tut.
- **`const fertig` verdeckt die Funktion `fertig(asinEintrag)`** (`amazon.js:1120`) innerhalb
  von `taktSchritt()`. Derzeit harmlos: `taktSchritt()` selbst ruft die Funktion nicht, und
  `beiStaffelwechsel()`, `zeichnen()` und `uebersichtZeichnen()` haben ihren eigenen Gültigkeits-
  bereich. Wer aber später in `taktSchritt()` `fertig(listenId)` schreiben will, bekommt einen
  Booleschen Wert statt einer Funktion — und keinen Fehler, sondern ein falsches Ergebnis. Ein
  eigener Name (`zaehlstandVollstaendig`) kostet nichts.

---

## 3. Braucht der Takt 500 ms?

**Für die Zustandswechsel: ja.** Vier Anzeigen hängen an Fristen, die nur durch Neuzeichnen
ablaufen:

| Frist | Wert | was daran hängt |
|---|---|---|
| `RUHE_MS` | 2.000 ms | „Staffel wechselt — einen Moment" |
| `WIDERSPRUCH_MS` | 5.000 ms | „Staffel wird geladen …" → „↻ hier klicken zum Neuladen" |
| `GEDULD_MS` | 8.000 ms | „Tonspuren noch nicht geladen" → „✕ nicht abrufbar — melden" |
| fest | 8.000 ms | „Folgen werden geladen …" → „Tonspuren nicht gefunden" |

Keine davon braucht 500-ms-Auflösung, um **richtig** zu sein. Aber jede Verlangsamung verzögert
jeden sichtbaren Zustandswechsel, und darüber hat Daniel am 25.08. schon geklagt: „der melde
button aktualisiert erst nach weiteren ~5sek."

**2.0 löst das über den Zustand statt über die Uhr:** Solange etwas zu tun ist, 500 ms; ist der
Zählstand vollständig, 4.000 ms, mit sofortiger Rückkehr. Das ist der richtige Weg — die
verbleibende Arbeit ist, den 500-ms-Takt selbst billig zu machen (Funde 4 bis 7), nicht ihn
weiter zu strecken.

**Warum kein `MutationObserver` statt des Takts:** Amazon tauscht beim Wechsel über das
Auswahlfeld den Quelltext **nicht** aus, und die Adresse nicht immer (beides gemessen, siehe
`CLAUDE.md`, „Der Quelltext veraltet beim Staffelwechsel"). Ein Observer sähe die Änderung im
DOM, aber sämtliche Wächter fragen bewusst Adresse **und** Quelltext ab und vergleichen sie.
Das wäre ein Umbau der Wechselerkennung, keine Optimierung — und die Wechselerkennung ist die
Stelle, an der dieses Projekt die meisten Fehler hatte.

---

## 4. Wo eine Optimierung das Verhalten ändern würde — Finger weg

Diese Stellen sehen nach Sparpotenzial aus und sind keins.

**`seitenTitel()` als Ganzes zwischenspeichern.** Verlockend, weil es die verbleibenden 1,8 ms
× 4 auf einen Durchlauf je 2 Sekunden drücken würde — und falsch: `staffelKennung()`
(`amazon.js:2731`) benutzt den Titel als das Merkmal, das einen **Titelwechsel innerhalb der
Anwendung** überhaupt sichtbar macht. Gemessen am 25.08. über zwei Wechsel (Armed Girl's →
Babylon → Bayonetta) blieb die Quelltext-Kennung acht Sekunden lang dieselbe; nur der Titel
wanderte. Ein 2-Sekunden-Zwischenspeicher verzögert genau diese Erkennung.
**Zwischenspeichern darf man nur die beiden Quelltext-Rückfälle** (`:850` und `:863`), nicht die
DOM-Abfragen davor (`:809` og:title, `:816` h1).

**Den `saeubern()`-Filter oder die Reihenfolge in `seitenTitel()` antasten.** `og:title` steht
seit dem 24.08. **vor** dem Auswahlfeld-Muster, weil dieses auf einer Chaika-Seite eine
Empfehlungskachel las und den Befund einer Serie einer anderen zuschrieb („Serie im Bestand:
Ragna Crimson · Seitentitel: Ragna Crimson"). Die Reihenfolge ist die Regel, nicht der Zufall.

**`innerText` durch `textContent` ersetzen.** `seitenLage()` (`amazon.js:220`) und
`regionFolgenAusDom()` (`amazon.js:202`) brauchen ausdrücklich den **gerenderten** Text: Amazon
rendert die Folgenkacheln erst beim Scrollen, `textContent` sähe auch das Ungerenderte und
beantwortete damit eine andere Frage. Der erzwungene Reflow ist der Preis dafür, und er ist
bewusst auf **eine** Stelle je Quelltext-Lesung begrenzt (eine Zusicherung in `amazon.test.cjs`
wacht darüber).

**Die Verkettung `${sichtbar} ${html}` in `seitenLage()` auftrennen.** Sieht nach einer
überflüssigen 2-MB-Kopie aus. Sie ist gewollt: `innerText` gibt es nur, wo etwas gerendert ist;
derselbe Hinweis steht aber auch in der ausgelieferten Seite, bevor sie gerendert ist. Getrennt
zu prüfen **wäre** verhaltensgleich und billiger — aber nur, solange kein Muster über die
Nahtstelle laufen darf. Vor dem Umbau prüfen, nicht annehmen.

**`HTML_FRIST_MS` (2.000 ms, `amazon.js:129`) heraufsetzen.** Zwei Tab-Abstürze haben diese Zahl
bezahlt. Höher verzögert `quelltextVeraltet()` und damit die Erkennung, dass der Quelltext zum
vorigen Titel gehört. Niedriger bringt den Speicherdruck zurück.

**`spuren()` beim ersten Treffer abbrechen.** Die Paarung läuft über die **Reihenfolge** aller
Fundstellen — der Ersatz für den gescheiterten 400-Zeichen-Abstand. Bei „Babylon" lagen
`audioTracks` und die zugehörige `episodeNumber` **33.651 Zeichen** auseinander. Wer hier
abbricht, holt den Fehler zurück, der 15 Tonspurangaben unsichtbar gemacht hat.

**Die Filter in `folgenAusText()`** (`amazon.js:414`). „Staffel 1" bzw. „Season 3" vor dem
Reiter „Folgen" ergibt „1 Folgen"; „6. Okt. 2019" vor „Folge 2" ergibt 2019. Beide sind
gemessen, nicht ausgedacht — der zweite Filter kam erst mit 2.0 dazu, nachdem „JUJUTSU KAISEN
Season 3" den Umfang auf drei Folgen deckelte. Eine feste Obergrenze („keine Staffel hat 2019
Folgen") wäre wieder ein Zufall mit Frist: „One Piece" führt über tausend.

**Das 900-Zeichen-Fenster in `staffelAusSeite()`, die Längen `{10,32}`, die Schleife über alle
`titleID`-Fundstellen, der Klammer-Schnitt in `nurDieAbschnitte()`.** Alles Reparaturen
konkreter Fehlschläge:

- `{10}` statt `{10,32}` schnitt GTIs ab (`0J16B1NAB82TO0O5A5Q8TLG1VP` → `0J16B1NAB8`) und ließ
  den Knopf bei „Babylon" und „Akame ga Kill" auf „noch nicht geladen" stehen.
- Die erste `titleID`-Fundstelle trägt oft keinen Wert; auf der Digimon-Seite steht das Feld
  220-mal.
- Ein Ausschnitt fester Länge fängt hinter `episodePages` zusätzlich die `pagination`-Tokens und
  holt einen Abschnitt doppelt: 267 KB umsonst je Seitenaufruf.

**Den 500-ms-Takt des Lesers ganz abschalten, sobald etwas gefunden wurde.** War die erste
Fassung; dann bleibt ein Staffelwechsel unbemerkt, und der ist der häufigste Fall. Die
Zweiteilung (500 ms / 4.000 ms in `takten()`, `amazon-leser.js:674`) ist die Antwort darauf.

**`fuerAdresse` an den Mitleser-Meldungen** (`amazon-leser.js:213` und `:556`, geprüft in `amazon.js:1695`).
Sieht nach einem überflüssigen Feld aus und ist der Schutz gegen den Wettlauf, der am 25.08.
vier Fassungen gekostet hat: Antworten des vorigen Titels treffen nach dem Wechsel ein und
landen im frisch geleerten Zählstand des neuen („13 von 24" bei Clannad, die Dreizehn gehörten
zu „Darwin Jihen").

---

## 5. Reihenfolge für den Umbau

1. ~~Fund 1 — `seitenTitel()`~~ **erledigt in 2.0**, Faktor 97 gemessen.
2. **Fund 2 + 3** zusammen — halbiert die Speicherlast der Seitenwelt und erklärt die Abstürze.
   Der größte verbleibende Posten.
3. **Fund 4 + 6** zusammen — sie greifen ineinander; das Diagnosefeld ist einer der Aufrufer.
4. **Fund 7 + 8** — Übersicht.
5. **Fund 10** nebenbei: Namen entzerren, zweiten Bremsgrund erwägen.
6. **Fund 5** nur, falls nach 2–4 noch etwas messbar ist. Wahrscheinlich nicht.
7. **Fund 9** beim nächsten Anfassen des Meldekörpers.

Nach jedem Schritt am Diagnosefeld gegenmessen:

```js
JSON.parse(document.querySelector('.ak-amazon-knopf').dataset.diag)
```

`taktSchnitt` und `taktMax` sagen, ob der Schritt getragen hat — **das ist der Prüfstein, nicht
der Eindruck.** Die Frame-Analyse von Daniels Bildschirmmitschnitt gab den Unterschied
nachweislich nicht her (23,4 gegen 25,8 Bildänderungen je Sekunde, die schlechtesten Werte in
der Phase *ohne* Erweiterung). Ausgangswert vor 2.0: `taktSchnitt: 226 ms`, `taktMax: 417 ms`.

---

## 6. Was offen bleibt

**Die beiden teuersten Zugriffe sind ungemessen.** `documentElement.innerHTML` und
`body.innerText` brauchen einen echten Browser auf einer echten Prime-Seite. Dafür ist ein
Messskript nötig, das Daniel in seiner angemeldeten Sitzung ausführt — die Konsole der
betroffenen Seite genügt:

```js
// In der Konsole einer Prime-Video-Titelseite ausführen.
const n = 20
let t = performance.now()
for (let i = 0; i < n; i++) void document.documentElement.innerHTML.length
console.log('innerHTML', ((performance.now() - t) / n).toFixed(2), 'ms')
t = performance.now()
for (let i = 0; i < n; i++) void document.body.innerText.length
console.log('innerText', ((performance.now() - t) / n).toFixed(2), 'ms')
console.log('Quelltext', document.documentElement.innerHTML.length, 'Zeichen')
console.log('Elemente', document.querySelectorAll('*').length)
```

Erst mit diesen Zahlen steht fest, ob nach den Funden 2 bis 4 überhaupt noch etwas zu holen ist
— oder ob der Rest der Zeit im Serialisieren und im Layout liegt und `HTML_FRIST_MS` die
eigentliche Stellschraube bleibt.

**Zweite offene Frage:** Wie viel des gemessenen `taktSchnitt: 226 ms` nach 2.0 übrig ist. Die
Rechnung sagt 15–20 ms Muster plus zweimal `innerHTML` je 2 Sekunden; gemessen ist sie nicht.
Ein Blick ins Diagnosefeld auf einer Seite, die eine Weile offen war, beantwortet das in
Sekunden.
