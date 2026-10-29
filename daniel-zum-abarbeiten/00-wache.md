# Wache — Bestand und Briefkasten

**⚠ Auffälligkeit** · letzter Befund vom 29.10.2026 um 15:21 Uhr

Diese Zeile nennt den letzten **Befund**, nicht den letzten Lauf: Seit dem 26.09.2026 wird nur noch
ein Befund committet (Daniel: „Behalten, still bei Ruhe"). Ob die Wache täglich läuft, steht in
Actions; hier steht, was sie zuletzt gefunden hat.

Diese Datei schreibt der Workflow [`delta-wache.yml`](../.github/workflows/delta-wache.yml),
täglich um 09:20 Uhr. Sie lief bis zum 03.09.2026 als Routine auf Daniels
Rechner; seitdem läuft sie auf GitHub und legt ihr Ergebnis hier ab statt es zu
melden.

**Wozu sie da ist:** Am 26.08.2026 gingen an einem Abend zweimal Meldungen aus
der Browser-Erweiterung verloren, ohne dass ein Lauf rot wurde — 508
Disney-Meldungen wurden zu einem einzigen Eintrag abgehakt, 216
One-Piece-Meldungen verschwanden ganz. Gefunden hat es Daniel, weil ihm eine Zahl
komisch vorkam. Das soll ihm keiner mehr abverlangen.

## Was aufgefallen ist

- 1 Urteile verloren; disneyplus: 1 Synchro-Belege weniger
- 1 Titel ohne Synchro-Beleg; crunchyroll: 1 Synchro-Belege weniger

## Bestand — die letzten 24 Stunden

```
44 Läufe in den letzten 1 Tagen (1645 insgesamt)

28.10., 14:38  Bestand — zusammenführ   verweise +1, ohneUrteil +1, termine +12
28.10., 16:25  Bestand — zusammenführ   verweise +4, mitUrteil +2, ohneUrteil +2
28.10., 17:29  Bestand — zusammenführ   releases +1, termine +1
28.10., 17:43  Bestand — zusammenführ   verweise +13, mitUrteil +13, titelMitSynchro +5
28.10., 19:42  Bestand — zusammenführ   verweise -1, mitUrteil -1
            ⚠  1 Urteile verloren; disneyplus: 1 Synchro-Belege weniger
28.10., 21:10  Bestand — zusammenführ   mitUrteil -1, ohneUrteil +1, titelMitSynchro -1, releases -1, termine -1
            ℹ  erklärt, nicht rot: 1 Titel ohne Synchro-Beleg, weil ihr Ja nur Amazons Sprachangabe auf einem Kanal-Titel war; primevideo: 1 Synchro-Belege herabgestuft (Kanal-Titel, Amazons Sprachangabe)
28.10., 21:38  Bestand — zusammenführ   verweise +1, mitUrteil +1, titelMitSynchro +1
28.10., 22:12  Bestand — zusammenführ   releases +1
28.10., 22:53  Bestand — zusammenführ   mitUrteil +1, ohneUrteil -1, titelMitSynchro +1, releases +1, termine +1
28.10., 23:23  Bestand — zusammenführ   termine +6
29.10., 04:34  Bestand — zusammenführ   verweise +2, mitUrteil +1, ohneUrteil +1, titelMitSynchro -1, releases +3, termine +4
            ⚠  1 Titel ohne Synchro-Beleg; crunchyroll: 1 Synchro-Belege weniger
29.10., 05:10  Bestand — zusammenführ   mitUrteil +1, ohneUrteil -1, titelMitSynchro +1, releases +1
29.10., 06:10  Bestand — zusammenführ   termine +7
29.10., 08:47  Bestand — zusammenführ   termine +12
29.10., 10:50  Bestand — zusammenführ   mitUrteil -1, ohneUrteil +1
            ℹ  erklärt, nicht rot: primevideo: 1 Synchro-Belege herabgestuft (Kanal-Titel, Amazons Sprachangabe)

Stand jetzt: 2924 Titel, 2016 Urteile, 291 offen
Über den Zeitraum: Titel 0, Urteile +16, offen +3

⚠  2 Lauf/Läufe mit Auffälligkeiten — siehe oben.
```

## Briefkasten

```
Briefkasten: 3985 Meldungen auf 184 Adressen (primevideo 489, disneyplus 2261, netflix 1235)
Liste daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md: 366 Adressen
Zurückgestellt (data/meldungen-zurueckgestellt.json): 0 Adressen im Briefkasten
Alle Adressen sind gelistet.
Übernahme: zuletzt 2026-10-28T16:20:46.343Z (data/meldungen-uebernahme.json)
✓ refresh-hourly.yml: letzter Erfolg vor 0 h (Frist 5 h)
✓ refresh-data.yml: letzter Erfolg vor 10 h (Frist 36 h)
✓ refresh-weekly.yml: letzter Erfolg vor 81 h (Frist 216 h)
✓ daten-auf-abruf.yml: letzter Erfolg vor 6 h (Frist 36 h)
✓ anisearch-katalog.yml: letzter Erfolg vor 8 h (Frist 36 h)
✓ tonspuren-monatlich.yml: letzter Erfolg vor 154 h (Frist 840 h)
✓ bestand-bauen.yml: letzter Erfolg vor 0 h (Frist 24 h)
✓ d1-verbrauch.yml: letzter Erfolg vor 24 h (Frist 48 h)
✓ claude-anime2you-extraktion.yml: letzter Erfolg vor 2 h (Frist 48 h)
✓ claude-wache-urteil.yml: letzter Erfolg vor 5 h (Frist 48 h)
✓ claude-verpasst-recherche.yml: letzter Erfolg vor 3 h (Frist 48 h)
✓ claude-daten-merge.yml: letzter Erfolg vor 0 h (Frist 48 h)
✓ GITHUB_WECKER_TOKEN: letzter Start durch den Wecker vor 0 h
ℹ Ablaufdatum unbekannt (gueltigBis leer): CLAUDE_CODE_OAUTH_TOKEN, LAUF_TOKEN, CR_ZUGANG, ANISEARCH_TOKEN, ANILIST_TOKEN, TMDB_API_KEY, YOUTUBE_API_KEY, STREAMING_API_KEY, SERPER_API_KEY, DATEN_APP_KEY, DISCORD_WEBHOOK, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ANALYTICS_TOKEN, GITHUB_WECKER_TOKEN, MAIL_API_KEY, WEICHE_TOKEN — Daniel liest es einmal im Konto ab und trägt es ins Register ein.

Zugänge unauffällig.
```

## Von den Ableitungen verworfen

Serien, für die keine Termine entstanden — je Grund, mit der Veränderung seit gestern
(`data/termine-ausgelassen.json`, Skill `stille-ausfaelle-verhindern`).

```
 225  Blöcke und Titel verschieden viele
  41  Folgenzahl geht nicht auf
   3  deutscher Termin vor der japanischen Ausstrahlung
(kein Vortagsstand (erster Lauf oder Cache verloren) — keine Veränderung berechnet)
```

## Tagebuch

Die letzten 60 Läufe. Älteres hat seinen Zweck erfüllt.

| Zeitpunkt | Titel / Urteile / offen | Veränderung | Befund |
|---|---|---|---|
| 29.10.2026 15:21 | 2924 / 2016 / 291 | Titel 0, Urteile +16, offen +3 | 1 Urteile verloren; disneyplus: 1 Synchro-Belege weniger; 1 Titel ohne Synchro-Beleg; crunchyroll: 1 Synchro-Belege weniger |
| 27.10.2026 14:13 | 2924 / 1999 / 286 | Titel +2, Urteile +2, offen -1 | 3 Titel weniger |
| 26.10.2026 15:16 | 2922 / 1997 / 287 | Titel 0, Urteile -18, offen +42 | 1 Titel weniger; 2 Urteile verloren (3 weitere sind begründet entfernt) (14 weitere durch Kanal-Titel herabgestuft); 3 Titel ohne Synchro-Beleg (2 weitere durch Kanal-Titel herabgestuft); netflix: 1 Synchro-Belege weniger; joyn: 1 Synchro-Belege weniger; 1 Titel ohne Synchro-Beleg |
| 22.10.2026 14:59 | 2922 / 2010 / 244 | Titel 0, Urteile 0, offen 0 | Auffälligkeit |
| 19.10.2026 16:41 | 2922 / 2000 / 253 | Titel 0, Urteile -36, offen +46 | 40 Urteile verloren; 7 Titel ohne Synchro-Beleg; primevideo: 44 Synchro-Belege weniger; netflix: 4 Synchro-Belege weniger |
| 25.09.2026 14:46 | 2776 / 2154 / 5 | Titel 0, Urteile 0, offen 0 | unauffällig |
| 24.09.2026 14:43 | 2776 / 2154 / 5 | Titel +1, Urteile +24, offen +2 | unauffällig |
| 23.09.2026 14:45 | 2775 / 2130 / 3 | Titel 0, Urteile +38, offen 0 | unauffällig |
| 22.09.2026 14:37 | 2775 / 2092 / 3 | Titel 0, Urteile +8, offen -4 | unauffällig |
| 21.09.2026 16:10 | 2775 / 2086 / 7 | Titel 0, Urteile -4, offen +3 | unauffällig |
| 20.09.2026 14:23 | 2775 / 2090 / 4 | Titel +3, Urteile +25, offen 0 | unauffällig |
| 19.09.2026 13:55 | 2772 / 2065 / 4 | Titel 0, Urteile +1, offen -38 | unauffällig |
| 18.09.2026 14:14 | 2772 / 2064 / 42 | Titel 0, Urteile +23, offen +37 | unauffällig |
| 17.09.2026 14:36 | 2772 / 2041 / 5 | Titel 0, Urteile +13, offen -17 | unauffällig |
| 16.09.2026 14:36 | 2771 / 2011 / 15 | Titel 0, Urteile +25, offen +11 | unauffällig |
| 15.09.2026 14:41 | 2771 / 1986 / 3 | Titel 0, Urteile +6, offen -4 | unauffällig |
| 14.09.2026 16:04 | 2771 / 1980 / 7 | Titel 0, Urteile +8, offen -12 | unauffällig |
| 13.09.2026 14:43 | 2771 / 1972 / 19 | Titel 0, Urteile +3, offen -1 | unauffällig |
| 12.09.2026 13:36 | 2771 / 1969 / 20 | Titel +3, Urteile +1, offen 0 | unauffällig |
| 11.09.2026 14:12 | 2768 / 1968 / 20 | Titel 0, Urteile +26, offen -5 | unauffällig |
| 10.09.2026 14:14 | 2768 / 1941 / 26 | Titel 0, Urteile +25, offen -45 | unauffällig |
| 09.09.2026 14:20 | 2768 / 1913 / 74 | Titel 0, Urteile 0, offen 0 | unauffällig |
| 08.09.2026 14:08 | 2768 / 1913 / 74 | Titel 0, Urteile -13, offen -12 | unauffällig |
| 07.09.2026 15:31 | 2768 / 1922 / 91 | Titel 0, Urteile +5, offen -36 | unauffällig |
| 07.09.2026 09:24 | 2768 / 1921 / 115 | Titel 0, Urteile +16, offen -102 | unauffällig |
| 06.09.2026 13:39 | 2768 / 1917 / 127 | Titel +1, Urteile +17, offen +24 | unauffällig |
| 05.09.2026 13:16 | 2767 / 1900 / 103 | Titel 0, Urteile +1, offen 0 | unauffällig |
| 04.09.2026 14:08 | 2766 / 1898 / 103 | Titel 0, Urteile 0, offen +1 | unauffällig |
| 04.09.2026 10:04 | 2766 / 1898 / 103 | Titel +1, Urteile +13, offen -12 | unauffällig |
| 03.09.2026 11:44 | 2765 / 1885 / 115 | Titel 0, Urteile -5, offen +5 | unauffällig |
| 03.09.2026 09:29 | 2765 / 1885 / 115 | Titel 0, Urteile -5, offen +4 | 5 Urteile verloren; 5 Titel ohne Synchro-Beleg; crunchyroll: 7 Synchro-Belege weniger |
