#!/usr/bin/env bash
#
# Was ein Sammel-Lauf geholt hat, als Pull Request einreichen — und mergen,
# wenn es konfliktfrei geht.
#
# Daniel am 30.08.2026: „lass die läufe pr's erstellen mit ziel in bestand zu
# mergen, aber nur wenn keine conflicte existieren soll gemerged werden,
# ansonsten soll der zusammenführ lauf es fixen und mergen. So ist es sicherer.
# Weil wenn die läufe committen könnte es trotzdem zu conflicts führen."
#
# Der Unterschied zu `commit-data.sh` ist nicht die Vorsicht, sondern **wer
# entscheidet**. Dort löst der Lauf jeden Konflikt selbst auf, indem er hart auf
# den Fernstand zurückgeht und seine Quellen darüberlegt — das ist schnell und
# in aller Regel richtig, aber es ist eine Entscheidung ohne Gegenblick. Am
# 29.08.2026 hat genau dieser Reset 19 berichtigte Handbelege wieder auf ihren
# alten Stand gesetzt, weil ein laufender Datenlauf sie überholt hat.
#
# Hier passiert das nicht mehr: Der Lauf legt seinen Fund auf einen eigenen
# Zweig und lässt GitHub sagen, ob er sich sauber einfügt. Tut er es, wird
# gemergt. Tut er es nicht, bleibt der Pull Request offen — und ein Claude-Lauf
# löst den Konflikt mit Blick auf beide Seiten, statt eine davon zu überfahren.
#
# Aufruf: bash tools/quellen-pr.sh "chore(data): Sendezeiten gesammelt"
#
# Schreibt nach $GITHUB_OUTPUT (falls gesetzt):
#   gemerged=true|false   ob der PR eingeflossen ist
#   pr=<nummer>           leer, wenn es nichts einzureichen gab
#   zweig=<name>

set -euo pipefail

NACHRICHT="${1:?Commit-Nachricht fehlt}"

source "$(dirname "${BASH_SOURCE[0]}")/quellen-liste.sh"

BOT_NAME="github-actions[bot]"
BOT_MAIL="41898282+github-actions[bot]@users.noreply.github.com"

# Unter `set -e` wäre `[ -n … ] && echo …` als eigenständige Zeile ein
# Abbruchgrund, sobald GITHUB_OUTPUT leer ist — also bei jedem lokalen Aufruf.
melde() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1" >> "$GITHUB_OUTPUT"; fi
  echo "→ $1"
}

# Ein Zweigname je Lauf. Der Lauf-Bezeichner steckt drin, damit ein offen
# gebliebener Pull Request später zuzuordnen ist.
ZWEIG="daten/${GITHUB_RUN_ID:-lokal}-$(date -u +%Y%m%d-%H%M)"
melde "zweig=$ZWEIG"

# **Ein fehlender Pfad darf nicht die ganze Einreichung kosten.**
#
# `git add -- "${QUELLEN[@]}"` bricht beim **ersten** Pfad ab, den es nicht
# gibt — und stagt dann gar nichts, auch nicht die achtzehn anderen Dateien, die
# der Lauf gerade geschrieben hat. Die Meldung ging an stderr und wurde von
# `2>/dev/null || true` verschluckt; nach außen sah es aus wie "keine Änderung".
#
# Gemessen am 06.09.2026 im Lauf 34048827567, nachdem eine Ausgabe eingebaut war:
#
#     --- Zahl geänderter Dateien: 9
#     fatal: pathspec 'daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md'
#            did not match any files
#     Keine Änderung an den Quellen — kein Pull Request.
#
# Neun geänderte Dateien in der Hand, darunter `data/source-health.json`,
# `data/adn.json` und `data/crunchyroll.json` — eingereicht wurde nichts. Die
# Arbeitsliste im Namen entsteht nur, wenn es Meldungen ohne Zuordnung gibt; seit
# die Wache am 03.09. "0 Adressen" meldet, fehlt sie, und seitdem lief **jeder**
# Sammel-Lauf ins Leere.
#
# **Was das gekostet hat:** `source-health` stand für drei Quellen vier Tage
# still, die Frist in `check-sources.ts` riss, `data:check` machte den Bau
# dreimal rot, und der Deploy wurde ab dem 06.09. um 14:16 übersprungen. Der
# Alarm hat also getan, wofür er gebaut ist — die Ursache lag eine Ebene tiefer.
#
# Deshalb: **je Pfad einzeln**, und ein fehlender kostet nur sich selbst. Die
# Zahl der Fehlgriffe steht im Protokoll, damit eine wachsende Lücke auffällt,
# bevor sie jemanden etwas kostet.
echo "--- Arbeitsverzeichnis vor dem Stagen: $(pwd), Zweig $(git rev-parse --abbrev-ref HEAD)"
echo "--- Zahl geänderter Dateien: $(git status --porcelain | wc -l)"

FEHLEND=0
for QUELLE in "${QUELLEN[@]}"; do
  if ! git add -- "$QUELLE" 2>/dev/null; then
    FEHLEND=$((FEHLEND + 1))
    echo "    übersprungen (nicht vorhanden): $QUELLE"
  fi
done
if [ "$FEHLEND" -gt 0 ]; then
  echo "--- $FEHLEND von ${#QUELLEN[@]} Pfaden gibt es gerade nicht — das ist erlaubt, sie entstehen bei Bedarf."
fi
if git diff --staged --quiet; then
  echo "Keine Änderung an den Quellen — kein Pull Request."
  melde "gemerged=true"
  melde "pr="
  exit 0
fi

git checkout -b "$ZWEIG" --quiet
git -c user.name="$BOT_NAME" -c user.email="$BOT_MAIL" commit -m "$NACHRICHT" --quiet
git push -u origin "$ZWEIG" --quiet

# `gh pr create` braucht GH_TOKEN in der Umgebung; der Workflow reicht das
# GITHUB_TOKEN durch.
PR="$(gh pr create --base main --head "$ZWEIG" \
  --title "$NACHRICHT" \
  --body "Automatisch eingereicht von **${GITHUB_WORKFLOW:-lokal}** (Lauf ${GITHUB_RUN_ID:-—}).

Enthält ausschließlich Quellen aus \`data/\` und die daraus erzeugten
Arbeitslisten — keine Erzeugnisse unter \`public/data\`. Die baut der Lauf
*Bestand — zusammenführen und bauen*, sobald das hier auf \`main\` steht.

Fügt sich der Zweig sauber ein, mergt der Sammel-Lauf ihn selbst. Steht dieser
Pull Request noch offen, gab es einen Konflikt — dann übernimmt
*Claude — Daten-PR zusammenführen*." \
  2>&1 | tail -1)"
NUMMER="$(printf '%s' "$PR" | grep -oE '[0-9]+$' || true)"
melde "pr=$NUMMER"
echo "Pull Request: $PR"

# GitHub berechnet die Mergebarkeit asynchron. Direkt nach dem Anlegen steht
# dort „UNKNOWN"; wer das als Konflikt liest, stößt bei jedem Lauf einen
# Reparatur-Auftrag an, der nichts zu reparieren hat.
ZUSTAND="UNKNOWN"
for _ in $(seq 1 20); do
  ZUSTAND="$(gh pr view "$ZWEIG" --json mergeable -q .mergeable 2>/dev/null || echo UNKNOWN)"
  [ "$ZUSTAND" != "UNKNOWN" ] && break
  sleep 3
done
echo "Mergebarkeit: $ZUSTAND"

if [ "$ZUSTAND" = "MERGEABLE" ]; then
  # `--squash`, damit auf `main` ein Commit je Lauf steht statt eines
  # Merge-Commits mit Anhang. Kein `--admin`: `main` ist nicht geschützt
  # (geprüft am 30.08.2026), und das GITHUB_TOKEN hätte die Rechte dafür ohnehin
  # nicht — der Aufruf würde daran scheitern statt am Konflikt.
  if gh pr merge "$ZWEIG" --squash --delete-branch --subject "$NACHRICHT" 2>&1; then
    melde "gemerged=true"
    exit 0
  fi
  echo "::warning::Der Merge ist trotz MERGEABLE fehlgeschlagen."
fi

# Kein Abbruch: Der Fund ist gesichert, er steht auf dem Zweig. Genau dafür ist
# dieser Weg da — der Sammel-Lauf bleibt grün, das Zusammenführen ist eine
# eigene Arbeit.
echo "::notice::Pull Request $NUMMER bleibt offen ($ZUSTAND). Claude führt zusammen."
melde "gemerged=false"
exit 0
