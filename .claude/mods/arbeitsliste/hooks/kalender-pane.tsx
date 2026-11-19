// Bereich „Kalender heute“ (Platz des früheren „Gerade in Arbeit“): eine Zeile je Titel und Anbieter, Uhrzeit vorn.
import { kalenderZeilenText } from './kalender'
import type { KalenderStand } from './kalender'

export function kalenderBereich(a: any, stand: KalenderStand) {
  const { Box, Text, kopf, istAuf, mehr, schnitt } = a
  if (!stand.zeilen.length) return null
  const s = schnitt(stand.zeilen, 'kalender')
  return (
    <Box flexDirection="column">
      {kopf('kalender', 'Kalender heute', stand.zeilen.length)}
      {istAuf('kalender') ? s.sichtbar.map((z: any, i: number) => <Text key={`kal-${i}`} wrap="wrap">{`  ${kalenderZeilenText(z)}`}</Text>) : null}
      {istAuf('kalender') ? mehr('kalender', s) : null}
    </Box>
  )
}
