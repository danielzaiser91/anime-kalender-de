---
name: fachbegriffe-glossar
description: "Etablierte Fachbegriffe statt Eindeutschungen, mit Daniels Korrekturliste. Bei deutschem Text über Technik: Kommentare, Commits, Doku, Oberflächen, Chat."
---

# Fachbegriffe: das etablierte Wort, nicht das selbst gebaute

## Die Regel

**Hat die Fachwelt für eine Sache ein Wort, wird dieses Wort benutzt — auch wenn es
englisch ist.** Eine eigene Übersetzung zu erfinden macht den Text nicht deutscher,
sondern schwerer lesbar: Wer im Fach zu Hause ist, muss erst zurückübersetzen, um zu
verstehen, was gemeint war.

Das ist **kein Freibrief für Anglizismen.** Wo ein deutscher Begriff etabliert ist, gilt
der. Gemeint ist nur der Fall, in dem ein englisches Fachwort durch eine Eigenkonstruktion
ersetzt wird, die es so nicht gibt.

**Prüffrage vor dem Schreiben:** Würde jemand, der beruflich damit arbeitet, dieses Wort
benutzen? Bei Nein oder Unsicherheit: nachschlagen, nicht erfinden. Im Zweifel entscheidet,
wie es in der Dokumentation des Werkzeugs heißt.

**Gilt überall, nicht nur nach außen** (Daniel, 10.08.2026): Release-Notes und
Discord-Meldungen genauso wie Code-Kommentare, Commit-Nachrichten, `status.md`,
Oberflächentexte und Antworten im Chat.

## Korrigierte Fälle

Hier steht **ausschließlich**, was Daniel tatsächlich beanstandet hat — keine Vermutungen,
keine Beispiele „zur Veranschaulichung" (Daniel, 10.08.2026). Der Grund: Eine geratene
Regel ist schlimmer als keine. Sie sieht aus wie geprüftes Wissen, ist aber nur eine
Meinung, und sie wird beim nächsten Mal befolgt, ohne dass jemand sie noch hinterfragt.

| statt | richtig | Anlass |
|---|---|---|
| Seitenfuß | **Footer**, Seiten-Footer, Fußzeile der Seite | Discord-Release-Notes. „Seitenfuß" existiert im Druck- und Textsatz, im Webkontext sagt es niemand |
| Fernstand | **Remote**, `origin/main` | `tools/commit-data.sh`, Commit-Nachrichten. Selbst gebaut, gibt es nicht |
| Erzeugnisse | **Build-Artefakte**, Artefakte | dasselbe Skript. Gegenstück zu „Quellen" |
| Kennung (bei HTTP) | **User-Agent** | aniSearch-Thema, mehrfach. Der Header heißt so, auch im deutschen Sprachgebrauch |
| Wörterbuch (bei i18n) | **Sprachdatei**, Übersetzungen | `i18n.tsx`. Wörterbuch ist Lexikografie, nicht Softwarelokalisierung. **Nicht** „Locale" — richtig, aber für Kommunikation zu technisch |
| Rollbalken | **Scrollbalken** | Release-Notes zu v1.5.1 und v1.6.1, GeoGuessr. „Rollbalken" ist eine alte Eindeutschung, die niemand mehr benutzt — **nie** verwenden |
| Tagesherausforderung | **Daily Challenge** (bei GeoGuessr), sonst „tägliche Herausforderung“ | Discord-Meldung zu v1.7.0 (27.08.2026). Der Spielmodus heißt bei GeoGuessr so — ein Eigenname wird nicht übersetzt, auch nicht in einem deutschen Text. Außerhalb von GeoGuessr ist „tägliche Herausforderung“ richtig, „Tagesherausforderung“ nie |

Die ersten fünf vom 10.08.2026, der Scrollbalken vom 22.08.2026, die Daily Challenge vom 27.08.2026.

## Beides richtig — nicht „korrigieren"

Damit die Regel nicht ins Gegenteil kippt und Texte über die Zeit immer englischer werden.
Ebenfalls von Daniel bestätigt (10.08.2026), nicht geraten:

| Wort | |
|---|---|
| Auslöser / Trigger | beides in Ordnung, **Auslöser bevorzugen** |
| Kachel / Card | beides in Ordnung |
| Zwischenspeicher / Cache | beides in Ordnung |
| Sendeplan | richtig, im Rundfunk etabliert |

## Der verständlichere Begriff gewinnt

„Locale" wäre für eine Sprachdatei fachlich korrekt und wurde trotzdem gestrichen: zu
technisch für Kommunikation (Daniel, 10.08.2026). Fachlich richtig ist die Untergrenze,
nicht das Ziel. Wo zwei korrekte Begriffe zur Wahl stehen, entscheidet, wen der Text
erreichen soll — eine Release-Meldung an Nutzer verträgt weniger Fachsprache als ein
Code-Kommentar.

## Wenn ein neuer Fall dazukommt

Nur eintragen, wenn Daniel ein Wort beanstandet hat. Dann mit dem richtigen Begriff, dem
Datum und dem Zusammenhang, in dem es aufgefallen ist — der Zusammenhang zeigt später, ob
die Regel überall gilt oder nur in einer bestimmten Textsorte.

Ein Glossar, das nach dem ersten Eintrag stehen bleibt, ist wertlos. Sein Wert entsteht
daraus, dass jeder Fall genau einmal vorkommt.
