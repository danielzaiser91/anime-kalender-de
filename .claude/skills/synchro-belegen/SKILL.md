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
- Händler- und Fan-Wikis: nur Spur. Gemini/KI-Antworten: nur Spur, jede Behauptung mit eigener URL nachprüfen.

**Suche** immer über alle Typen (Serie/Film/Special/OVA) und alle Titelvarianten — unsere Einordnung kann falsch sein. Kein Treffer ist kein „nein".

**Berichtsmuster je Titel:** Quellen mit URL, Zitat ≤ 12 Wörter, Abrufdatum, Gegenprobe, **Liste der nicht erreichten Quellen**.

**Wann ein Lauf zählt (Daniel, 09.10.2026)**
- Sauberer Lauf ohne Beleg und ohne Widerlegung = verwertbarer Befund „geprüft, nichts gefunden": Stufe bleibt, Wiedervorlage mit Datum.
- Lauf mit blockierten oder fehlgeschlagenen Aufrufen (Cloudflare, 429, Timeout) = nicht verwertbar: Nichtauskunft ist kein Befund, Wiederholung auf anderem Weg.

**Eichfall:** Nezha (Synchronkartei 25475, fernsehserien.de + wunschliste.de „Deutsche TV-Premiere 26.03.2007 RTL II") muss die Methode selbst finden. Bericht: `daniel-zum-abarbeiten/berichte/g4-g5-belege-v2.md`.
