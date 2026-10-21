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

# Die Anmeldung der Claude-Läufe legt das App-Token in die Remote-Adresse (`.git/config`); bei jedem Ende wieder heraus, sonst sähen es die späteren Schritte des Jobs.
token_abmelden() {
  local url
  url="$(git config --get remote.origin.url)"
  case "$url" in *x-access-token:*) git remote set-url origin "${url/x-access-token:*@/}" ;; esac
}
trap token_abmelden EXIT

NACHRICHT="${1:?Commit-Nachricht fehlt}"

source "$(dirname "${BASH_SOURCE[0]}")/quellen-liste.sh"
source "$(dirname "${BASH_SOURCE[0]}")/quellen-aufsetzen.sh"
source "$(dirname "${BASH_SOURCE[0]}")/quellen-pruefen.sh"

# `tools/daten-pr-mergen.sh` und `claude-daten-merge.yml` überspringen Titel mit dieser Marke.
MARKE_ROT="[Prüfung rot]"
LABEL_ROT="pruefung-rot"
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
# Nur Läufe der App heißen `daten/…` (Kette und CI-Prüfer überspringen den Präfix, der Daten-Merge nimmt nur ihren Autor); ein lokaler Aufruf nimmt `fix/`.
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  ZWEIG="daten/${GITHUB_RUN_ID}-$(date -u +%Y%m%d-%H%M)"
else
  ZWEIG="fix/lokal-$(date -u +%Y%m%d-%H%M)"
fi
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
#     fatal: pathspec 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md'
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
# **Was der Lauf geschrieben hat, aber nicht einreicht, wird gemeldet — vor dem Aufsetzen, danach ist es weg.** Zweimal ging so Arbeit still verloren:
# `public/data/voices` (seit 30.08.) und `data/adn-vde-historie.json` (seit 10.09.) standen in keiner Liste, und jeder Lauf warf sie weg.
VERLOREN="$(quellen_verloren | head -20)"
if [ -n "$VERLOREN" ]; then
  echo "::warning title=Nicht eingereichte Dateien::Der Lauf hat Dateien geschrieben, die in tools/quellen-liste.sh fehlen und verloren gehen: $(printf '%s' "$VERLOREN" | tr '\n' ' ' | cut -c1-400)"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    { echo "### Nicht eingereichte Dateien"; echo '```'; echo "$VERLOREN"; echo '```'; } >> "$GITHUB_STEP_SUMMARY"
  fi
fi

# **Der Zweig wird auf dem jüngsten Stand von `main` geschnitten, nicht auf dem vom Start des Laufs** (05.10.2026). Zwei Gründe:
#
# 1. Ein langer Lauf (Woche: bis 90 Minuten) hätte sonst jede Datei geändert, die ein anderer Lauf inzwischen auch anfasste — der Pull Request wäre bei jedem
#    Zusammentreffen im Konflikt gelandet. Zurückgelegt werden nur die eigenen Änderungen; `source-health.json` und `dub-confirmed.yaml` werden zusammengeführt.
# 2. GitHub lehnt den Push eines Zweigs ab, dessen Workflow-Dateien von `main` abweichen („refusing to allow a GitHub App to create or update workflow …").
#    Wer während eines laufenden Sammlers einen Workflow änderte, ließ dessen Pull Request scheitern — der Wochenlauf vom 05.10.2026 verlor so 107 Minuten
#    Abrufe. Auf dem jüngsten `main` geschnitten stimmen die Dateien überein; ändert sich `main` genau zwischen Schnitt und Push, setzt die Schleife neu auf.
PUSH_OK=0
for versuch in 1 2 3; do
  git fetch origin main --quiet
  quellen_aufsetzen origin/main
  echo "--- Arbeitsverzeichnis vor dem Stagen: $(pwd), Zweig $(git rev-parse --abbrev-ref HEAD) (Versuch $versuch)"
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

  git checkout -B "$ZWEIG" --quiet
  git -c user.name="$BOT_NAME" -c user.email="$BOT_MAIL" commit -m "$NACHRICHT" --quiet
  if git push -u origin "$ZWEIG" --force --quiet; then
    PUSH_OK=1
    break
  fi
  echo "::warning::Push abgelehnt (Versuch $versuch von 3) — setze auf dem neuen Stand von main neu auf."
  # Zurück auf einen losen Kopf; die Änderungen bleiben im Arbeitsverzeichnis, die nächste Runde legt sie auf den neuen Stand.
  git checkout --detach --quiet
  git reset --mixed HEAD~1 --quiet
  sleep $((5 + RANDOM % 10))
done
if [ "$PUSH_OK" != 1 ]; then
  echo "::error::Der Pull Request konnte nach drei Versuchen nicht angelegt werden. Die geholten Daten sind im Lauf-Verzeichnis, nicht im Repo."
  exit 1
fi

# **Vor dem Einreichen prüfen (17.10.2026):** Ein Fund, der die Datenprüfungen (`check:logic`) bricht, darf nicht still auf `main` landen — und nicht still verloren gehen.
# Rot: Der Pull Request entsteht trotzdem, mit Titelpräfix, Label und dem Grund im Text; gemergt wird er nicht (ein Mensch löst, `tools/daten-pr-mergen.sh`).
PRUEF_ROT=0
PRUEF_GRUND="$(quellen_pruefen)" || PRUEF_ROT=1
# Ist `main` selbst rot, zählen nur die Fehler, die erst der Fund bringt: sonst bliebe jeder Sammler-PR markiert liegen, und nach der Reparatur löste ihn nichts.
if [ "$PRUEF_ROT" = 1 ]; then
  NEUE_FEHLER="$(quellen_neue_fehler "$PRUEF_GRUND")"
  if [ -n "$NEUE_FEHLER" ]; then
    PRUEF_GRUND="$NEUE_FEHLER"
  else
    PRUEF_ROT=0
    echo "::warning title=main ist schon rot::Die Datenprüfung ist auf main bereits aus denselben Gründen rot; der Fund bringt keine neuen Fehler und wird wie bisher eingereicht."
  fi
fi
TITEL="$NACHRICHT"
# Fund-Schlüssel: Ein Workflow hat mehrere Einreicher (refresh-weekly: sieben Jobs), ein neuer roter PR löst nur denselben Fund ab (`tools/rote-sammler-prs.mjs`).
SCHLUESSEL="${GITHUB_WORKFLOW:-lokal}/${GITHUB_JOB:-lokal}/$NACHRICHT"
BODY="Automatisch eingereicht von **${GITHUB_WORKFLOW:-lokal}** (Lauf ${GITHUB_RUN_ID:-—}).
<!-- fund-schluessel: $SCHLUESSEL -->"
if [ "$PRUEF_ROT" = 1 ]; then
  TITEL="$MARKE_ROT $NACHRICHT"
  BODY="$BODY

**$MARKE_ROT** Die Datenprüfungen (\`npm run check:logic\`) sind auf diesem Stand rot. Der Sammler hat den Fund eingereicht, aber nicht gemergt:

\`\`\`
$(printf '%s\n' "$PRUEF_GRUND" | head -20)
\`\`\`

Beheben, dann den Titelpräfix mit \`gh pr edit <Nr> --title\` entfernen und \`tools/daten-pr-mergen.sh <Nr>\` laufen lassen."
fi
BODY="$BODY

Enthält ausschließlich Quellen aus \`data/\` und die daraus erzeugten
Arbeitslisten — keine Erzeugnisse unter \`public/data\`. Die baut der Lauf
*Bestand — zusammenführen und bauen*, sobald das hier auf \`main\` steht.

Fügt sich der Zweig sauber ein, mergt der Sammel-Lauf ihn selbst. Steht dieser
Pull Request noch offen, gab es einen Konflikt — dann übernimmt
*Claude — Daten-PR zusammenführen*."

# `gh pr create` und `gh pr merge` brauchen GH_TOKEN in der Umgebung; die Workflows reichen das Token der App
# anime-kalender-daten durch (Bypass im Ruleset `main-pruefweg`, 11.10.2026).
PR="$(gh pr create --base main --head "$ZWEIG" --title "$TITEL" --body "$BODY" 2>&1 | tail -1)"
NUMMER="$(printf '%s' "$PR" | grep -oE '[0-9]+$' || true)"
melde "pr=$NUMMER"
echo "Pull Request: $PR"

if [ "$PRUEF_ROT" = 1 ]; then
  # Das Label ist eine Zugabe: Fehlt es oder schlägt das Anlegen fehl, bleibt der Titelpräfix als Markierung.
  gh label create "$LABEL_ROT" --color B60205 --description "Datenprüfung rot, nicht gemergt" --force >/dev/null 2>&1 || true
  gh pr edit "$ZWEIG" --add-label "$LABEL_ROT" >/dev/null 2>&1 || true
  # Grenze: Je Fund liegt höchstens ein roter PR offen; die älteren löst der neue ab (ihr Zweig bleibt erhalten, derselbe Job holt auf frischem main alles neu).
  if ! ALTE="$(gh pr list --state open --limit 100 --json number,title,body | node "$(dirname "${BASH_SOURCE[0]}")/rote-sammler-prs.mjs" nummern "$SCHLUESSEL" "$NUMMER")"; then
    ALTE=""
    echo "::warning title=Ältere rote PRs nicht abgelöst::Die Liste offener Pull Requests war nicht lesbar; ältere rote PRs desselben Funds bleiben offen."
  fi
  for alt in $ALTE; do
    gh pr close "$alt" --comment "Abgelöst durch #$NUMMER (neuerer roter Fund desselben Jobs). Der Zweig bleibt erhalten." >/dev/null 2>&1 || true
  done
  echo "::warning title=Datenprüfung rot::Pull Request $NUMMER ist eingereicht, aber nicht gemergt: $(printf '%s' "$PRUEF_GRUND" | tr '\n' ' ' | cut -c1-300)"
  melde "gemerged=false"
  exit 0
fi

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
  # Merge-Commits mit Anhang. `--admin` ist hier der Bypass der App im Ruleset
  # `main-pruefweg`: Ohne das Flag weigert sich `gh` schon vor dem Aufruf, sobald
  # der Pull Request auf eine Freigabe wartet (Lauf 38135294637, 11.10.2026).
  # Ein Konflikt scheitert trotzdem.
  #
  # **Mehrere Versuche**: Mit parallelen Sammlern (seit 05.10.2026) bewegt sich `main` oft genau zwischen Mergebarkeits-Prüfung und Merge — GitHub antwortet dann
  # „Base branch was modified. Review and try the merge again." Ein Pull Request, der deshalb offen bliebe, wartete auf den Claude-Lauf (und dessen Kontingent).
  for merge_versuch in 1 2 3 4 5 6; do
    if gh pr merge "$ZWEIG" --squash --admin --delete-branch --subject "$NACHRICHT" 2>&1; then
      melde "gemerged=true"
      exit 0
    fi
    echo "::notice::Merge-Versuch $merge_versuch von 6 abgelehnt — main hat sich bewegt, neuer Versuch."
    sleep $((3 + RANDOM % 8))
    # Die Mergebarkeit gegen den neuen Stand abwarten, bevor es weitergeht (ein echter Konflikt beendet die Schleife).
    for _ in $(seq 1 10); do
      ZUSTAND="$(gh pr view "$ZWEIG" --json mergeable -q .mergeable 2>/dev/null || echo UNKNOWN)"
      [ "$ZUSTAND" != "UNKNOWN" ] && break
      sleep 2
    done
    [ "$ZUSTAND" = "MERGEABLE" ] || break
  done
  if [ "$ZUSTAND" = "MERGEABLE" ]; then
    # Rot statt Warnung: Ein mergebarer Daten-Pull-Request, der offen bleibt, würde sonst still liegen (claude-daten-merge holt ihn nach).
    echo "::error::Pull Request $NUMMER ist mergebar, der Merge scheiterte sechsmal (Ruleset/Bypass der App prüfen)."
    melde "gemerged=false"
    exit 1
  fi
fi

# Kein Abbruch: Der Fund ist gesichert, er steht auf dem Zweig. Genau dafür ist
# dieser Weg da — der Sammel-Lauf bleibt grün, das Zusammenführen ist eine
# eigene Arbeit.
echo "::notice::Pull Request $NUMMER bleibt offen ($ZUSTAND). Claude führt zusammen."
melde "gemerged=false"
exit 0
