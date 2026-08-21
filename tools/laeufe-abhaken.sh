#!/usr/bin/env bash
# Durchgesehene Läufe aus der Statusanzeige nehmen.
#
# Ein grüner Lauf bleibt eine halbe Stunde stehen, damit ein Abschluss nicht
# unbemerkt vorbeigeht. Habe ich ihn vorher durchgesehen und weiterverarbeitet,
# ist er erledigt — und soll dann auch sofort verschwinden. Daniel am
# 21.08.2026: „sie sollten verschwinden, wenn du sie durchgeguckt hast und sie
# nicht mehr wichtig sind."
#
# Aufruf:
#   bash tools/laeufe-abhaken.sh            # alle grünen
#   bash tools/laeufe-abhaken.sh 32519352698 32517576468
#
# Rote Läufe hakt dieses Skript nie von selbst ab — ein Fehler, der von allein
# aus der Anzeige verschwindet, ist schlimmer als keine Anzeige. Für die muss
# die Lauf-Nummer ausdrücklich danebenstehen.
set -uo pipefail

WORKER="${LAUF_WORKER:-https://newsletter.animekalender.workers.dev}"
if [ -z "${LAUF_TOKEN:-}" ]; then
  echo "LAUF_TOKEN fehlt — steht in my_secrets.md" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  IDS="$*"
else
  IDS=$(curl -sS "$WORKER/lauf" | node -e "
    let s = ''
    process.stdin.on('data', (d) => (s += d)).on('end', () => {
      const laeufe = JSON.parse(s).laeufe.filter((l) => l.zustand === 'ok' || l.zustand === 'abgebrochen')
      console.log(laeufe.map((l) => l.lauf_id).join(' '))
    })")
fi

if [ -z "$IDS" ]; then
  echo "Nichts abzuhaken."
  exit 0
fi

for id in $IDS; do
  printf '{"lauf_id":"%s","zustand":"erledigt"}' "$id" > /tmp/abhaken.json
  curl -sS --max-time 10 -X POST "$WORKER/lauf" \
    -H "Content-Type: application/json" -H "X-Lauf-Token: $LAUF_TOKEN" \
    --data-binary @/tmp/abhaken.json > /dev/null && echo "abgehakt: $id"
done
rm -f /tmp/abhaken.json
