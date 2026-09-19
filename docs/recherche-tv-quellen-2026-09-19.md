# Recherche 19.09.2026: TV-Sendetermine aller Sender und deutsche Folgendaten

Anlass: Dragon Ball Super läuft auf ProSieben MAXX (7MAXX) und fehlt im Kalender, weil die
RTL+-Programmseite nur die RTL-Gruppe führt. Dazu fehlen deutsche Erstausstrahlungsdaten je
Folge (aniSearch führt Beyblade X nur bis Folge 65).

Bereits am 16.09.2026 geprüft und hier **nicht** wiederholt (siehe `status.md`, Abschnitt
„Recherchiert 16.09.2026"): fernsehserien.de, TVmaze, RTL+-Programmseite und -EPG, rtl2.de,
ARD Mediathek, programm-api.ard.de, Joyn/api.joyn.de, prosiebenmaxx.de, toggo.de, nick.de,
iptv-org/epg, presseportal.de-RSS.

Gemessen am 19.09.2026 mit `curl` (Browser-User-Agent), je Quelle wenige Einzelabrufe.
Prüfbeispiele:

- **A:** Dragon Ball Super auf 7MAXX, Nacht zum So 20.09.2026 (00:30–04:15, zehn Folgen) und
  Mo 21.09. 17:05/17:30.
- **B:** Beyblade X, deutsche Folgen nach Folge 65; am 19.09.2026 liefen auf TOGGO plus
  „Wechseln oder auflösen" (20:25) und „Zukunfts-Profis" (20:45).

## A — Deutsche TV-Sendetermine (alle Sender, v. a. 7MAXX)

| Quelle | Weg | Reichweite | robots / AGB (Zitat) | Beispiel gemessen | Urteil |
|---|---|---|---|---|---|
| **tv.de** (Couchfunk GmbH, Radebeul) | HTML: `/sender/prosieben-maxx/<TT.MM.JJJJ>/` listet `/sendung/<serie>/<slug>,<id>/`; Detailseite nennt Datum, Uhrzeit, Folgentitel, Inhalt und „weitere Sendetermine". Kein schema.org, keine offene JSON-Schnittstelle gefunden | alle großen Sender inkl. 7MAXX, Super RTL, KiKA; Tageslinks bis **02.10.2026** (≈ 14 Tage) | robots: `User-agent: * Allow: /` (gesperrt nur Bytespider, GPTBot). AGB: keine Klausel zu automatisiertem Abruf oder TDM; „automatisierte Skripte" nur beim Tippspiel (14.4). Kein § 44b-Vorbehalt gefunden | DBS 21.09. 17:05 „Gegen die Kraft eines Gottes! Vegetas todesmutiger Schlag!" (ID 2437984000), Nachtblock 20.09. ab 00:30 auf der Detailseite; 02.10. „Dragonball"-Folgen sichtbar. **Keine Folgennummer**, nur Folgentitel | **nutzbar** (mit Auflage, siehe Empfehlung) |
| tvinfo.de | HTML je Sender und Tag, Detailseite mit `_sdate`/`_stime` | alle Sender, bis 10.10.2026 | robots frei für `/tv-programm/`. AGB § (3): „Zugriffe/Manipulationen, die auf tvinfo.de befindliche Inhalte/Daten extern speichern, weiterverbreiten oder veröffentlichen (insbesondere durch automatisierte Scripte/Programme) sind untersagt." | DBS 20.09. 00:30–03:55, zehn Folgen mit Titel, keine Nummer. Sendungs-IDs identisch mit tv.de (gleicher Datenlieferant) | verworfen (AGB) |
| tvspielfilm.de (BurdaForward) | HTML `/tv-programm/sendungen/prosieben-maxx,PRO7M.html`, Detail `/tv-programm/sendung/<slug>,<id>.html` | alle Sender | robots: `*` erlaubt Programmseiten, aber **`User-agent: ClaudeBot Disallow: /`** (Block „AI crawlers used for model training"). AGB Ziff. 3: „Die Nutzer dürfen die Inhalte daher zum privaten Gebrauch abrufen, abspeichern und ausdrucken, soweit dies weder unmittelbar noch mittelbar Erwerbszwecken dient." | DBS-Folgen vorhanden; Detailseite ohne Folgennummer | Grauzone (nur privater Gebrauch, Betreiber sperrt KI-Crawler namentlich) |
| tvtoday.de (BurdaForward) | HTML `/programm/standard/sender/pro7m.html` mit eingebettetem JSON (`startDate`, `title`, `subtitle`) | alle Sender | wie TV Spielfilm; zusätzlich `Disallow: /programm/standard/sendung/` (Detailseiten) | DBS 20.09. 00:30 „Das Zeichen der Wende! …" als JSON, keine Folgennummer | Grauzone (wie oben) |
| prisma.de | HTML, „4-Wochen-Planer" | 4 Wochen | robots: `Disallow: /tv-programm/?date=*`. Impressum: „Jede darüber hinausgehende Nutzung … bedarf der vorherigen Zustimmung von prisma.de. Dies gilt auch für die Aufnahme in elektronische Datenbanken" | nicht weiter gemessen | verworfen (Impressum) |
| wunschliste.de (imfernsehen GmbH, Betreiber von fernsehserien.de) | HTML | Wochen | Impressum: „… Vervielfältigung jeglicher Art ist nur mit schriftlicher Genehmigung gestattet!" | nicht weiter gemessen | verworfen (gleiche Klausel wie fernsehserien.de) |
| hoerzu.de, tvdigital.de, klack.de, gong.de (FUNKE / Gong Verlag) | HTML | — | robots-Kopf: „The collection of content … through automated means … is prohibited except (1) for the purpose of search engine indexing or with express written permission"; ClaudeBot, Claude-User, Claude-Code u. v. a. `Disallow: /`. gong.de ist nur eine Landeseite mit Links zu hoerzu.de | — | verworfen (robots-Verbot) |
| tvmovie.de (Bauer) | HTML | — | robots: „The use of robots or other automated means to access our site or collect or mine data without the express permission of us is strictly prohibited." | — | verworfen |
| tv-media.at (VGN/APA) | HTML, `/sender/pro7-maxx` vorhanden | — | Impressum: „… jede Form der Vervielfältigung, Veröffentlichung … oder Aufnahme in elektronische Datenbanken der Inhalte oder Teilen davon untersagt." | — | verworfen |
| waipu.tv | `/sender/prosieben-maxx/` ist eine Werbeseite; Programm nur in der App | — | robots frei | kein Programm auf der öffentlichen Seite | verworfen (EPG nur mit Konto) |
| Zattoo | `/guide` ist die Web-App; `/de/tv-programm`, `/de/sender/…` → 404 | — | robots erlaubt sogar ClaudeBot | keine öffentlichen Programmseiten | verworfen (EPG nur mit Konto) |
| MagentaTV | `magentatv.de/robots.txt` liefert eine HTML-Seite (Weiterleitung) | — | — | EPG-Weg ist der von iptv-org (am 16.09. verworfen) | verworfen |
| ProSiebenSat.1 Presse (`presse.prosiebensat1.com`, Ziel von `presse.prosiebenmaxx.de`) | Next.js-Seite, Programmwochen nicht öffentlich | — | robots: `User-agent: * Disallow: /` (nur `/` und `/service/` erlaubt); `presse.prosiebensat1.de` löst nicht auf | — | verworfen |
| RTL Media Hub (`media.rtl.com/tv-programme/`) | Programmwochen von RTL, VOX, SUPER RTL, TOGGO plus u. a. | — | robots frei, aber: „stehen Ihnen nach dem Login weiterhin im Media Hub unter TV-Kalender zur Verfügung" | — | verworfen (Konto nötig) |
| onlinetvrecorder.com | EPG-Ajax | — | robots: `Disallow: /v2/ajax/get_epg_screen.php` u. a. | — | verworfen |

**Folgennummern führt keine der A-Quellen.** Die Nummer lässt sich aber über den deutschen
Folgentitel zuordnen (Abschnitt B): Alle 14 DBS-Titel, die das EPG am 19.09. für die folgenden Tage zeigte, passten
**wörtlich** auf die de.wikipedia-Episodenliste. Das ergibt die Folgen 116–125 in der
Nacht zum 20.09., danach 126–129.

## B — Deutsche Erstausstrahlung / Veröffentlichung je Folge

| Quelle | Weg | Reichweite | Lizenz / robots / AGB | Beispiel gemessen | Urteil |
|---|---|---|---|---|---|
| **de.wikipedia „…/Episodenliste"** | MediaWiki-API `action=parse&prop=wikitext`, Vorlage `Episodenlisteneintrag2` mit `NR_GES`, `NR_ST`, `DT` (deutscher Titel), `EA` (Japan), `EAD` (deutschsprachige EA) | nur Serien mit gepflegter Liste; rund 80 Seiten mit der Vorlage und „Anime" im Text (Suche `hastemplate:`) | CC BY-SA 4.0 (Namensnennung, Weitergabe unter gleichen Bedingungen). API ausdrücklich für Programme gedacht; robots ohne Claude-Sperre | `Dragon Ball Super/Episodenliste`: 131 Folgen, **131/131 mit `EAD`** und deutschem Titel; Folge 116 „Das Zeichen der Wende! …", EAD 6. Sep. 2019. **Beyblade X: keine Episodenliste** (Artikel nennt nur Start 9. Sept. 2024 auf Super RTL) | **nutzbar** (Titel→Nummer und EA DE, wo vorhanden) |
| **RTL+ Staffel- und Folgenseiten** (`plus.rtl.de/<serie>-p_<id>/season-<n>-s_<id>`, Folgenseite `/video/<slug>-c_<id>`) | Staffelseite: „Staffel N • Folge M • Titel" im HTML; Folgenseite: schema.org `TVEpisode` mit `seasonNumber`, `episodeNumber`, `uploadDate`. Staffel-URLs stehen in `seasons.N.sitemap.xml` | RTL-Gruppe (Super RTL, TOGGO plus, RTL II …) | robots `Allow: /`; AGB verbieten nur **kommerzielles** TDM (Stand 16.09.) | Beyblade X: S3 F15 „Wechseln oder auflösen" `uploadDate` **2026-09-04**, im TV (TOGGO plus) am 19.09.; S3 F16 „Zukunfts-Profis". Staffelseite zeigt im HTML nur die ersten 24 Folgen (S1 und S2 abgeschnitten), der Rest lädt nach. Achtung: S1 F11 trägt `uploadDate` 2025-01-10, lief im TV aber schon 2024 — das Datum ist das RTL+-Einstelldatum, nicht die TV-Premiere | **nutzbar** für Staffel/Folge/Titel und RTL+-Start; fehlende Folgen nur über die Folgenseiten (Sitemap `videos.*`) oder die bedrock-Schnittstelle (Grauzone, 16.09.) |
| Eigener EPG-Verlauf | `data/tv-programm.json` hält jede gesehene Ausstrahlung mit `gesehenAm`; erste Sichtung einer Folge = deutsche TV-Premiere | ab heute vorwärts, nicht rückwirkend | keine fremden Rechte | Beyblade X F15/F16 stehen dort schon mit Titel | **nutzbar** (vorwärts), ergänzt A |
| TMDB (API, vorhandener Schlüssel) | `/tv/226688/season/1?language=de-DE` | international | API-Nutzungsbedingungen, im Projekt bereits im Einsatz | Beyblade X: 136 Folgen in einer Staffel, **deutscher Titel nur bei 51**, ab Folge 52 „Folge N"; `air_date` = japanisches Datum | verworfen für B (kein Landesdatum, deutsche Titel lückenhaft) |
| Wikidata (SPARQL) | `P577` mit Qualifikator `P291` = Deutschland | — | CC0 | DBS (Q19839121): **0** Folgen-Items; Beyblade X (Q123048898): 2 Folgen-Items, 0 mit deutschem Datum. Insgesamt gibt es 13.102 Folgen-Items mit deutschem Datum, aber nicht für diese Serien | verworfen (keine Abdeckung) |
| TheTVDB | API v4 nur mit Projektschlüssel (nicht angelegt); Web-robots `Disallow: /api/` | — | — | nicht gemessen; nach eigener Beschreibung eine Ausstrahlungsreihenfolge je Serie, keine Landesdaten (ungeprüft) | nicht verfolgt |
| fernsehserien.de / wunschliste.de | — | — | Impressum-Klausel (siehe A) | — | verworfen |

## Empfehlung

**A — Sendetermine: tv.de als zweite Programmquelle neben der RTL+-Programmseite.** tv.de ist
die einzige geprüfte Seite, die 7MAXX und alle übrigen großen Sender rund 14 Tage im Voraus
zeigt, ohne robots-Sperre und ohne AGB-Verbot für automatisierten Abruf. Auflagen, damit das so
bleibt:

- einmal täglich je Sender-Tag **nur die Anime-Titel** aus dem Bestand übernehmen, nicht das
  ganze Programm; das schont zugleich das Datenbankherstellerrecht (§ 87b UrhG, das schützt
  „wesentliche Teile")
- Folgentitel und Zeit übernehmen, keine Inhaltstexte und keine Bilder
- tv.de als Quelle nennen

Die Folgennummer ergibt sich aus dem Titelabgleich (B). tvinfo.de hätte dieselben Daten, verbietet
aber genau diese Nutzung. TV Spielfilm und TV Today bleiben Grauzone (nur privater Gebrauch,
ClaudeBot namentlich gesperrt), taugen also nicht als Rückfallquelle.

**B — Folgendaten: drei Bausteine statt einer Quelle.**

1. **de.wikipedia-Episodenlisten** über die MediaWiki-API für alle Serien, die eine Liste haben.
   Sie liefern deutsche Titel **und** das deutsche Erstausstrahlungsdatum je Folge (DBS 131/131),
   Lizenz CC BY-SA mit Namensnennung.
2. **RTL+-Staffel- und Folgenseiten** für RTL-Serien ohne Wikipedia-Liste (Beyblade X):
   Staffel, Folge und deutscher Titel sicher; `uploadDate` ist der RTL+-Start und nur bei neuen
   Folgen verlässlich die deutsche Erstveröffentlichung (S3 F15: RTL+ 04.09., TV 19.09.).
3. **Eigener EPG-Verlauf** (tv.de + RTL+-Programm): Die erste gesehene Ausstrahlung einer Folge ist
   ab jetzt ihre TV-Premiere. Das schließt die aniSearch-Lücken vorwärts. Rückwirkend (Beyblade X
   Folge 66 bis heute) bleibt nur RTL+.

TMDB und Wikidata tragen für B nichts bei (kein Landesdatum; deutsche Titel bei Beyblade X nur bis 51).
