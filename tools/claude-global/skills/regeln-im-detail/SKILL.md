---
name: regeln-im-detail
description: Volltext der Regeln aus ~/.claude/rules mit Anlässen, Zitaten und Beispielen. Laden, wenn eine Regel unklar ist, ein Grenzfall entschieden werden muss oder eine Regel geschärft wird.
---

# Regeln im Detail

Die Dateien unter `~/.claude/rules/` sind seit dem 26.09.2026 **Kurzfassungen**: je Regel der
Kern in ein bis drei Sätzen. Der vollständige Text vom Stand 26.09.2026 — mit Anlass, Daniels
Zitaten, Beispielen und Begründung — liegt hier, je Regeldatei eine Datei gleichen Namens:

- `00-so-funktioniert-das-hier.md`
- `10-sprache-und-ausgabe.md`
- `20-arbeitsweise.md`
- `30-system-und-sicherheit.md`
- `40-wissen-und-werkzeuge.md`
- `50-git-und-projekte.md`
- `90-slash-commands.md`

`60-codegestalt.md` (seit 26.09.2026) hat keinen Volltext hier: Er steht im Skill
`sauberer-code`, beide verwaltet aus `anime-kalender-de/tools/claude-global/`
(`node tools/claude-global/einrichten.mjs`) — dort ändern, nicht in `~/.claude`.

**Warum geteilt** (Daniel, 26.09.2026: „you reach token limit too quickly"): Die Regeln waren
auf 57,6 KB gewachsen, rund 15.000 Token in jeder Sitzung, und Anthropic empfiehlt für
immer geladene Anweisungen unter 200 Zeilen. Die Anlässe sind wertvoll, aber sie müssen nicht
bei jeder Nachricht mitlaufen.

**Die Kurzfassung gilt.** Widersprechen sich Kurzfassung und Volltext, gilt die Kurzfassung;
der Volltext erklärt, er ergänzt keine Pflichten.

**Beim Schärfen einer Regel** (nach einer Korrektur von Daniel): Der neue Anlass kommt in die
Datei hier, in die Kurzfassung höchstens ein Halbsatz. So bleibt die immer geladene Menge klein.
