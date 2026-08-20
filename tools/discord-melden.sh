#!/usr/bin/env bash
#
# Meldet das Ergebnis eines Datenlaufs nach Discord.
#
# Warum ein eigener Schritt und nicht die offizielle GitHub-Anbindung: Discords
# GitHub-verträglicher Endpunkt (`…/github`) deckt eine feste Liste von
# Ereignissen ab — push, issues, pull_request, release, check_run, check_suite
# und einige mehr. **`workflow_run` ist nicht dabei.** Genau das wäre aber die
# Meldung, um die es geht: „Der Wochenlauf ist durch, grün, so viele Titel".
#
# Gemeldet wird, was man sonst nachschlagen müsste: Ergebnis, Dauer, und die
# Zahlen aus dem erzeugten Datensatz. Bei einem Fehlschlag steht die Adresse des
# Laufs dabei, damit man nicht erst suchen muss.
#
# Aufruf (in der Action):
#   bash tools/discord-melden.sh "Wöchentlich" "$ERGEBNIS"
#
# Ohne gesetztes DISCORD_WEBHOOK passiert nichts — das Skript ist dann ein
# stiller Durchläufer, damit ein Fork ohne Secret nicht rot wird.

set -uo pipefail

LAUF="${1:?Name des Laufs fehlt}"
ERGEBNIS="${2:-unbekannt}"

if [ -z "${DISCORD_WEBHOOK:-}" ]; then
  echo "Kein DISCORD_WEBHOOK gesetzt — keine Meldung."
  exit 0
fi

# Die Zahlen aus dem gerade gebauten Datensatz. Fehlt die Datei, war der Aufbau
# nicht erfolgreich — dann bleibt die Zeile eben weg.
ZAHLEN=""
if [ -f public/data/meta.json ]; then
  ZAHLEN="$(node -e "
    const m = require('./public/data/meta.json')
    process.stdout.write(\`\${m.titleCount} Titel · \${m.releaseCount} Releases · \${m.eventCount} Termine\`)
  " 2>/dev/null || true)"
fi

case "$ERGEBNIS" in
  success) KOPF="✅ $LAUF durch"; FARBE=3066993 ;;
  cancelled) KOPF="⚪ $LAUF abgebrochen"; FARBE=9807270 ;;
  *) KOPF="🔴 $LAUF fehlgeschlagen"; FARBE=15158332 ;;
esac

ADRESSE="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

# Node schreibt das JSON in eine **Datei**, und curl schickt genau diese Bytes.
#
# Der Umweg ist nicht Zierde: Über die Kommandozeile gereicht, kamen „✅" und
# „·" bei Discord verstümmelt an, und die Antwort lautete „The request body
# contains invalid JSON" (Code 50109) — obwohl die Zeichenkette gültiges JSON
# war. Die Shell schreibt das Argument in ihrer eigenen Kodierung; eine Datei
# hat die, die node hineinschreibt.
DATEI="$(mktemp)"
trap 'rm -f "$DATEI"' EXIT
ZAHLEN="$ZAHLEN" ADRESSE="$ADRESSE" KOPF="$KOPF" FARBE="$FARBE" DATEI="$DATEI" node -e "
  const felder = []
  if (process.env.ZAHLEN) felder.push({ name: 'Datensatz', value: process.env.ZAHLEN })
  felder.push({ name: 'Lauf', value: process.env.ADRESSE })
  require('node:fs').writeFileSync(process.env.DATEI, JSON.stringify({
    embeds: [{ title: process.env.KOPF, color: Number(process.env.FARBE), fields: felder }],
  }), 'utf8')
"

CODE="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json; charset=utf-8' -X POST --data-binary "@$DATEI" "$DISCORD_WEBHOOK")"
if [ "$CODE" = "204" ] || [ "$CODE" = "200" ]; then
  echo "Discord benachrichtigt ($KOPF)."
else
  # Kein Abbruch: Eine ausgefallene Meldung darf keinen Datenlauf rot färben.
  echo "::warning::Discord antwortete mit HTTP $CODE — Meldung nicht zugestellt."
fi
