---
name: synchro-belegen
description: "Deutsche Synchro eines Titels belegen: Quellenreihenfolge, Suche über Titelvarianten, Berichtsmuster. Vor jeder Beleg-Recherche und jedem Beleg-Auftrag."
---

# Synchro belegen

**Beleg-Stufen (Daniel, 09.10.2026)**
- Synchronkartei-Eintrag (Synchronfirma + Sprecher; Titel/Staffel/Folgenbereich passen) = deutsche Tonspur belegt → `dubConfidence` high.
- **Titelangabe belegt keine Folge (Daniel, 01.11.2026):** Eine Tonspurliste für den ganzen Titel (z. B. Netflix-Titelseite „Audio“) gilt nur bei Filmen. Bei Serien, auch mit einer Staffel, erst, wenn die Synchro je Folge ermittelt werden kann; einzelne Folgen können ohne deutsche Fassung sein.
- Ohne Synchronkartei: TV-Programmdaten mit „Deutsche TV-Premiere" (fernsehserien.de, wunschliste.de) → normal.
- **Synchron-Forum-Liste „Synchronisierte Anime-Titel"** (forum.seriensynchron.de, Thread von „Chat Noir", Stand 24.12.2023; Domain-Aliase 215072.homepagemodules.de, forum.serien-synchron.de): 2.418 Einträge 1958–2023, Spalten Produktion/Format/Folgen/Jahr (Entstehung)/Genre/Sender-Verleih/Synchronfirma/Standort; nur japanische Anime (chinesische wie Nezha fehlen, Abwesenheit ist kein Befund); Nach 2023 keine Einträge. Als Beleg „synchronisiert" tauglich (ohne Sprecher), mit aniSearch „Synchronisiert" zusammen = zwei Quellen. Lokal: `C:/code/ai/__assets/notes/synchron-forum-liste-2023-12-24.tsv`.
- **Gelisteter Kanal belegt die Fassung (Daniel, 16.11.2026, Lehre 108):** Steht der Kanal eines YouTube-Videos in `data/curated/youtube-kanaele-deutsch.yaml` (16.11.2026: @Pokemonoffiziell), gilt es als deutsch vertont — Kanal und Videotitel per oEmbed (`youtube.com/oembed?url=…`, Felder `author_name`/`author_url`/`title`) lesen, bevor Daniel ein YouTube-Video prüfen soll. Ein anderer offizieller DE-Kanal oder ein deutsches Label ist eine Spur, kein Beleg: In die Liste kommt nur, wessen Videos durchgehend deutsch vertont sind. Lädt der Kanal auch Originalton mit Untertiteln hoch (peppermint anime, gemessen 16.11.2026: „OmU“, „German Sub“, „JapDub GerSub“), entscheidet der Titel des einzelnen Videos („(Dt.)“, „German Dub“ gegen „OmU“, „GerSub“) und wird als Handbeleg eingetragen — auch das lese ich selbst, ohne Bitte an Daniel.
- Händler- und Fan-Wikis: nur Spur. Gemini/KI-Antworten: nur Spur, jede Behauptung mit eigener URL nachprüfen.

**Suche** immer über alle Typen (Serie/Film/Special/OVA) und alle Titelvarianten — unsere Einordnung kann falsch sein. Kein Treffer ist kein „nein".

**Anime2You-Suche (18.11.2026):** `node tools/anime2you-suche.mjs liste --kanal aniverse | suche <Titel> | artikel <URL|ID>` liefert JSON (schreibt nie in `data/`); Aufruf und Regeln in `docs/wissen/maengel.md`, „Werkzeug für die Anime2You-Belegsuche“.

**Berichtsmuster je Titel:** Quellen mit URL, Zitat ≤ 12 Wörter, Abrufdatum, Gegenprobe, **Liste der nicht erreichten Quellen**.

**Wann ein Lauf zählt (Daniel, 09.10.2026)**
- Sauberer Lauf ohne Beleg und ohne Widerlegung = verwertbarer Befund „geprüft, nichts gefunden": Stufe bleibt, Wiedervorlage mit Datum.
- Lauf mit blockierten oder fehlgeschlagenen Aufrufen (Cloudflare, 429, Timeout) = nicht verwertbar: Nichtauskunft ist kein Befund, Wiederholung auf anderem Weg.

**Eichfall:** Nezha (Synchronkartei 25475, fernsehserien.de + wunschliste.de „Deutsche TV-Premiere 26.03.2007 RTL II") muss die Methode selbst finden. Bericht: `daniel-zum-abarbeiten/berichte/g4-g5-belege-v2.md`.

**Beleg umhängen oder löschen hat vier Folgestellen (12.11.2026, PR 3608):** `belege-entfernt.yaml`, `erneut-melden.yaml`, Notizseiten-Wächter und Fremdbelege an derselben Adresse vor dem PR greppen, nicht erst in der Kette finden.

**Handbeleg-Block mit Lücken-Titel (Lehre 128, 17.11.2026, PR 4096):** Vor dem Ergänzen eines Blocks zu einem Titel mit Lücken-Bereichen die Ausgabe von `ladeHandbelege()` (bzw. `dubRanges` in `titles.json`) vorher gegen nachher halten; Blöcke können zu einem Bereich verschmelzen und eine Lücke schließen.

**Beleg gilt nur für die genannte Staffel (PR 4180, 18.11.2026):** Nennt eine zweite Quelle eine bestimmte Staffel, einen Teil oder Film, gehört sie nur an den Eintrag (ASIN), dessen Staffel über Adressen-Notiz („laut Adresse Staffel N“) oder Folgenzahl belegt ist, nie an alle Einträge eines Titels (Yu-Gi-Oh! 481: Zitat zu Staffel 5 stand an vier Adressen). Steht die Staffel der Adresse nicht fest, bleibt sie ohne `zweiteQuelle`; dieselbe ASIN unter zwei Titeln bekommt keine. Vorher `node` über alle Einträge des Titels: Zitat-Staffel gegen Adresse und AniList-Folgenzahl halten.
