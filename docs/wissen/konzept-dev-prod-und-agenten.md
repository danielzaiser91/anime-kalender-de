# Dev-Umgebung, Freigabe und Agenten-Team (Konzept, 04.10.2026)

Daniels Vorschlag: `dev.anime-kalender.de` ist nur für ihn und die Agenten erreichbar; dort landet jedes Inkrement **ohne Freigabe**; auf `anime-kalender.de` (Prod) kommt es erst nach seiner Abnahme. Claude übernimmt Projektleitung (Aufträge schneiden, Review, Abnahme für Dev, Vorlage an Daniel); günstigere Agenten machen die Fleißarbeit (Auftrag → Code → Pull Request → Review-Kommentare abarbeiten).

## 1. Umgebungen

| | Prod | Dev |
|---|---|---|
| Adresse | `anime-kalender.de` (GitHub Pages) | `dev.anime-kalender.de` |
| Wer | alle | Daniel, Agenten |
| Inhalt | `main` | `dev`-Zweig = `main` + das nächste Inkrement |
| Deploy | Push auf `main` (wie heute) | jeder Push auf `dev`, **ohne Gate** |
| Datenläufe | schreiben auf `main` | lesen `main`; `dev` holt `main` nachts nach |

**Hosting für Dev:** GitHub Pages kann in dieser Form nichts privat halten. Vorschlag: **Cloudflare Pages** (Projekt `anime-kalender-dev`) hinter **Cloudflare Access** — wir nutzen Cloudflare schon (Worker, D1, R2). Daniel meldet sich per E-Mail-Code an; Agenten und lokaler Rechner nutzen ein **Service-Token** (zwei Header `CF-Access-Client-Id/Secret`, „privater Token lokal"). Kosten: Pages und Access (bis 50 Nutzer) sind kostenlos.

**Offen, das nur Daniel weiß:** Wo liegt der DNS von `anime-kalender.de`? Für `dev.` braucht es einen CNAME auf `*.pages.dev`; liegt der DNS nicht bei Cloudflare, ist das eine Zeile beim jeweiligen Anbieter.

## 2. Der Ablauf eines Inkrements

1. **Auftrag** (Claude als Projektleiter): ein Inkrement mit Vorher, Nachher, Prüfauftrag und Messlatte.
2. **Bau** (Agent): Zweig `inkrement/<name>`, Pull Request gegen `dev`; `check:vor-commit` ist die Schranke.
3. **Review** (Claude): Diff, Zusicherungen, Gleichheitsbeweis; Kommentare gehen an den Agenten zurück (Schleife bis grün).
4. **Dev-Deploy**: Merge nach `dev`, automatischer Deploy, **Vorher/Nachher-Liste mit Dev-Links** im PR.
5. **Abnahme durch Daniel**: Prüfauftrag je Punkt (Link, Vorher, Nachher, Auftrag). Freigabe = Kommentar `/freigabe` oder PR-Approval.
6. **Prod**: Erst jetzt `dev` → `main`; GitHub Pages deployt. Changelog entsteht aus den PR-Beschreibungen.

Daten- und Code-Inkremente bleiben getrennt: Datenläufe schreiben weiter direkt auf `main` (Wache `quellen-commit-wache`).

## 3. Rollen und Modelle

Die Modellwahl (Preis je Aufgabe, nicht je Token) steht in `docs/wissen/agenten-modelle-2026-10-04.md` (Recherche, jede Zahl mit Quelle). Grundsatz: das stärkste Reasoning-Modell für Review, Abnahme und Aufgabenschnitt; günstigere für Fleißarbeit — aber gemessen an den **Kosten je abgeschlossener Aufgabe**, weil ein billiges Modell mit mehr Versuchen teurer werden kann.

## 4. Grenzen, die gelten

- Daten-Semantik bleibt deine Abnahme (Handprüfung); Agenten dürfen sie vorschlagen, nicht freigeben.
- Kontingent: Claude-Läufe in der Cloud scheitern in einer Sekunde, wenn dein Kontingent leer ist (gesehen am 02.10.2026). Das braucht einen Rückfall (anderer Agent oder Warten).
- Secrets: Cloudflare-API-Token (Pages bearbeiten), Access-Service-Token, ggf. API-Schlüssel der günstigeren Agenten — von dir erzeugt, in `my_secrets.md` und als GitHub-Secret.
- Ein Agent mit Schreibrecht auf `main` ist ausgeschlossen; `main` bekommt nur, was du freigibst.

## 5. Erster Schritt

Pilot mit **einem** kleinen Inkrement (Phase 0: Bauprüfung schärfen) als Pull Request über diesen Ablauf, um Reibung zu messen, bevor mehr daran hängt.

## 6. Agent-Probe mit DeepSeek V4.1 Flash (04.10.2026)

- **Modell:** `deepseek-flash` (V4.1 Flash), erreichbar über die OpenAI-kompatible Schnittstelle (`https://api.deepseek.com/chat/completions`) und über eine Anthropic-kompatible (`https://api.deepseek.com/anthropic`); Claude Code läuft damit über `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` und `ANTHROPIC_MODEL`. Schlüssel liegt in `my_secrets.md`.
- **Vorfall, damit er nicht wieder passiert:** Der erste Start der CLI mit fremdem `ANTHROPIC_BASE_URL` schickte das **gespeicherte Anthropic-Anmeldetoken** an `api.deepseek.com` (DeepSeek antwortete 401 und nannte die letzten vier Zeichen). Ursache: Die CLI bevorzugt ihre Anmeldung vor `ANTHROPIC_AUTH_TOKEN`. **Regel:** Fremde Modelle laufen nur mit eigenem, leerem `CLAUDE_CONFIG_DIR` (`agent-lauf.cjs` setzt es und entfernt `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN`); erst ein Probeaufruf, dann der Auftrag.
- **Aufträge** haben immer: Ziel, zu liefernde Dateien, Grenzen („nur diese Dateien"), Abnahmebefehle, Abschlussbericht; Ergebnis ist ein Commit auf einem Zweig `inkrement/<name>` im eigenen Worktree, den Claude prüft.

## 7. OpenAI Dots und OpenDots (Recherche 04.10.2026)

- **OpenAI Dots** (29.09.2026): Always-on-Agenten (GPT-6 Astra) mit eigenem Cloud-Rechner, bedienbar über ChatGPT, Slack, Teams; über 4.000 Apps per Plugin; je Pro-/Business-/Enterprise-Plan ein Dot. Quelle: 9to5Google.
- **OpenDots** (CopilotKit): Open-Source-Nachbau, selbst gehostet, beliebiges OpenAI-kompatibles Modell, Browser/Dateien/Terminal je Dot (standardmäßig aus), Zeitpläne; selbst beschrieben als „early, single-owner". Quelle: CopilotKit-Blog.
- **Einordnung für uns:** Beide ersetzen keine Datenquelle. Was uns heute fehlt, ist kein „Agent mit eigenem Rechner", sondern **angemeldetes Lesen von Anbieterseiten von einer deutschen Heim-Leitung** (Prime-Kanal, Netflix, Disney+ je Folge) — das übernimmt heute Daniels Browser-Erweiterung von Hand. Automatisiert würde das gegen die AGB der Anbieter und, bei Netflix, gegen die robots.txt laufen (Projektregel `netzwerkverkehr-statt-scraping`); Cloud-Rechner haben zudem keine deutsche Wohnadresse. Die übrigen Aufgaben (nächtliche Läufe, Untersuchung roter Läufe, Wache) decken GitHub Actions, der Cloudflare-Worker-Cron und Claude Code in der Cloud ab. Neu prüfen, wenn Dots eine Schnittstelle (API/Webhook) bekommt und wenn die Rechtsfrage zum angemeldeten Auslesen geklärt ist.

### Zweite Probe (05.10.2026): DeepSeek untersucht die Magilumière-Lücke

Auftrag `daniel-zum-abarbeiten/agent-auftrag-magilumiere.md` (nur lesen, Bericht schreiben), Start mit `tools/agent-lauf.cjs <Worktree> <Auftrag> <Ausgabe>`. **Ergebnis: „Reached max turns (60)", kein Bericht.** Der Agent kam in 60 Zügen nicht
zu einem Befund; ich habe die Frage danach selbst in unter zehn Abfragen beantwortet. Merke: Offene Untersuchungen mit vielen Dateien taugen für das Modell nicht; abgegrenzte Aufgaben mit festen Befehlen
und Abnahme (wie die Konsistenzprüfung am 04.10.) schon. Nächster Versuch nur mit enger Aufgabe (eine Funktion, ein Test) und `--max-turns`.
