#!/usr/bin/env bash
#
# Kündigt ein großes neues Feature in Discord #news an — von Hand, nach dem Deploy.
#
# Nur für echte neue Funktionen, die Besucher sehen; keine Kleinigkeiten, keine Bugfixes,
# keine Laufmeldungen (Daniel, 13.10.2026). Der Text beschreibt den Nutzen für Besucher
# (Skill `kurze-texte-fuer-nutzer`).
#
# Aufruf: DISCORD_WEBHOOK=… bash tools/discord-news.sh "Überschrift" "Text" [Adresse]

set -euo pipefail

KOPF="${1:?Überschrift fehlt}"
TEXT="${2:?Text fehlt}"
ADRESSE="${3:-https://anime-kalender.de}"
: "${DISCORD_WEBHOOK:?DISCORD_WEBHOOK fehlt}"

# JSON über eine Datei, nicht über die Kommandozeile: als Argument kamen Umlaute und
# Sonderzeichen bei Discord verstümmelt an (Code 50109).
DATEI="$(mktemp)"
trap 'rm -f "$DATEI"' EXIT
KOPF="$KOPF" TEXT="$TEXT" ADRESSE="$ADRESSE" DATEI="$DATEI" node -e "
  require('node:fs').writeFileSync(process.env.DATEI, JSON.stringify({
    embeds: [{ title: process.env.KOPF, description: process.env.TEXT, url: process.env.ADRESSE, color: 15105570 }],
  }), 'utf8')
"

CODE="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json; charset=utf-8' -X POST --data-binary "@$DATEI" "$DISCORD_WEBHOOK")"
[ "$CODE" = "204" ] || [ "$CODE" = "200" ] || { echo "Discord antwortete mit HTTP $CODE" >&2; exit 1; }
echo "Angekündigt: $KOPF"
