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
