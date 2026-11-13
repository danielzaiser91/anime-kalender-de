# Ragna Crimson: Prime-Weg B0F1XK58VQ gemessen (12.11.2026)

## Seite (ein Abruf über Edge, amazon.de/dp/B0F1XK58VQ)

- Titel: „Seite wurde nicht gefunden“
- Text: „Tut uns leid. Die eingegebene Webadresse ist keine funktionsfähige Seite auf unserer Website.“
- Also weder Prime Video noch Datenträger erkennbar; kein „In Prime enthalten“, keine Sprachen, keine Staffel. Die Adresse ist bei Amazon tot (404).
- Einschränkung: ein einzelner Abruf aus Edge; kein zweiter Versuch (Auftrag: genau eine Seite).

## Klasse (nur gezählt, Stand Checkout f29ca0dbc)

- `data/anisearch.json`: 574 Wege mit Anbieter amazon-de / amazon-(de) / prime-video (471 / 99 / 4) bei 549 Einträgen.
- Davon im Linkcheck (`data/link-check.json`, Stand bis 10.11.): 441 mit `prime: true`, 19 geprüft ohne Prime-Merkmal, 114 ohne Befund.
- B0F1XK58VQ (aniSearch-ID 146493) hat **keinen** Linkcheck-Befund. `09-6-anisearch-wege.ts` legt Amazon-Wege nur an, wenn `linkBefunde[url].prime === true`. In `public/data/titles.json` dieses Checkouts hat 146493 `streams: []`, der Weg ist hier also nicht zu sehen (kommt nach Auftrag erst mit dem Stand nach PR 3608; dort ist zu prüfen, woher das `prime` kam, z. B. Linkcheck-Lauf nach 10.11. oder anderer Zweig).
- Prime-Wege in `titles.json` gesamt: 980; Zugang abo 646, kauf 328, unbekannt 6. Davon abo mit ASIN, die auch aniSearch führt: 172, davon 126 ohne `dubQuelle` (Beispiele: Titel 33, 134, 161, 239, 594). Das ist eine Obergrenze für „abo ohne Synchro-Beleg aus aniSearch-Herkunft“, nicht auf Handbeleg-Lücken gegengeprüft.
- Unterscheidung Datenträger vs. Prime Video im Datensatz: einziges Merkmal ist `prime: true` im Linkcheck (Seitentitel enthält „| Prime Video“, `pipeline/check-links.ts` Z. 232); `prime` wird nie auf false gesetzt, fehlt = unbekannt. Es gibt keine ASIN-Mustererkennung (Prime-Video-Seiten erscheinen als `/gp/video/detail/…`, aniSearch führt `/dp/…`; in titles.json hat nur 1 von 980 Prime-Wegen die `/dp/`-Form).
- Bekannte Vorklasse (`docs/wissen/quellen.md` Z. 2794): am 19.09.2026 waren 37 von 37 nur-aniSearch-Amazon-Adressen bei Amazon tot. Der heutige 404 passt dazu.

## Ragna Crimson im Bestand

Handbelege schon vorhanden (`data/dub-confirmed.yaml`): B07LHFLDBS (dub: false, „kauf_oder_leihe“, Staffelangabe laut Adresse zweifelhaft) und B0D75XMMB1 (dub: true, Kanal-Titel Aniverse, Hinweis „Amazons Sprachangabe ist hier kein Beleg“). Ein Prime-Weg mit „abo“ ohne Synchro-Beleg ist also nicht belegt.

## Vorgeschlagener Eintrag (nicht committet)

Befund = Adresse tot, kein Datenträger-/Sprachbeleg. Passend ist der Weg-Sperr-Handbeleg `available: false` (Format wie Black Butler II / Z. 463), kein `dub:false`, weil die Seite nichts über Sprachen sagt:

```yaml
- anilistId: 146493
  title: "Ragna Crimson"
  platform: primevideo
  url: https://www.amazon.de/dp/B0F1XK58VQ
  available: false
  checkedAt: '2026-11-12'
  note: "Amazon-Seite B0F1XK58VQ: „Seite wurde nicht gefunden“ („Tut uns leid. Die eingegebene Webadresse ist keine funktionsfähige Seite auf unserer Website.“), Edge-Abruf 12.11.2026; Adresse stammt nur aus aniSearch (Partnerlink)"
```

Dazu prüfen: `available: false` mit Adresse-Bezug muss in der Reihenfolge von `build.ts` den Verweis wirklich vor `ergaenzeAnisearchWege` sperren (`belegFuer(...)` dort: `beleg.available === false` → `continue`, laut Quelltext ja). `check:handbelege` nach Eintrag fahren.

## Offen

- Ein 404 aus einem Edge-Abruf ist ein Einzelbefund; Amazon kann Bot-/Region-abhängig antworten. Gegenprobe: derselbe Abruf nicht nötig, wenn der Linkcheck der CI die Adresse auch als 404 meldet.
- Klasse: 114 aniSearch-Amazon-Wege ohne Linkcheck-Befund und 19 ohne Prime-Merkmal bleiben ungeprüft; dort entscheidet die Bedingung `prime === true` schon heute, dass sie keinen Weg anlegen.
- Woher das `prime` für B0F1XK58VQ im Stand nach PR 3608 kommt, ist hier nicht zu klären (kein Befund im Checkout).
