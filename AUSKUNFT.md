# Auskunft: wo anime-kalender seinen Stand führt

Für den Agenten `auskunft` des Leitstands (nur lesen). Gilt als Wegweiser, nicht als Stand.

| Frage | Quelle |
|---|---|
| Was läuft, was ist offen, was wartet auf Daniel? | `daniel-zum-abarbeiten/stand.md` (Kopf „Aktualisiert“, `### Jetzt`, `## In Arbeit`, `## Als Nächstes`) |
| Autonomer Modus aktiv, bis wann? | `C:/Users/ih/.claude/autonomer-modus/*.txt` (Endzeit als ISO; Datei fehlt = aus) |
| PR gemergt / offen / in der Merge-Reihe? | `gh pr view <n> --json state,mergedAt`; Merge-Reihe: `C:/code/ai/__assets/prozesse/merge-reihe-nachschub.txt` |
| Läufe rot, Probleme? | `gh run list --limit 20`; `node tools/laeufe-aufraeumen.mjs --trocken` (nur lesen) |
| Was ging zuletzt live? | `git log origin/main --oneline -20`; „Neu und live testbar“ in `stand.md`; Patch Notes `data/patchnotes/` |
| Wie funktioniert X, warum so? | `docs/wissen/karte.md` (Einstieg), `ARCHITEKTUR.md`, `ZIELE.md` |
| Daten zu einem Titel | `public/data/titles.json`, live https://anime-kalender.de/ |
| Pläne Master-Repo/Tokens | `C:/code/ai/__assets/notes/master-repo-plan.md` |
