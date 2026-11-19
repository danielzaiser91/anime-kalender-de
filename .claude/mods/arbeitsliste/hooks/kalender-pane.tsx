// Bereich „Kalender heute“ (Platz des früheren „Gerade in Arbeit“): Uhrzeit als eigene Spalte, daneben der Titel fett
// und darunter Anbieter · Folgen gedimmt; Vergangenes grau, damit das Nächste ins Auge fällt (Daniel, 20.11.2026).
import { istVorbei } from './kalender'
import type { KalenderStand, KalenderZeile } from './kalender'

// Breite der Zeitspalte: „≈17:00“ plus Rand und Abstand.
const ZEIT_BREITE = 8

function kalenderEintrag(a: any, z: KalenderZeile, vorbei: boolean, key: string) {
  const { Box, Text } = a
  const zeit = z.zeit ? `${z.geschaetzt ? '≈' : ' '}${z.zeit}` : '  –'
  const meta = [z.anbieter, z.folgen].filter(Boolean).join(' · ')
  return (
    <Box key={key} flexDirection="row">
      <Box width={ZEIT_BREITE} flexShrink={0}>
        <Text bold={!vorbei && !!z.zeit} color={vorbei ? undefined : 'suggestion'} dimColor={vorbei || !z.zeit}>{` ${zeit}`}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text wrap="wrap" bold={!vorbei} dimColor={vorbei}>{z.name}</Text>
        <Text wrap="wrap" dimColor>{meta}</Text>
      </Box>
    </Box>
  )
}

// Kein „weitere/weniger“: der Bereich klappt nur als Ganzes (Daniel, 20.11.2026).
export function kalenderBereich(a: any, stand: KalenderStand, jetztMs: number) {
  const { Box, kopf, istAuf } = a
  if (!stand.zeilen.length) return null
  return (
    <Box flexDirection="column">
      {kopf('kalender', 'Kalender heute', stand.zeilen.length)}
      {istAuf('kalender') ? stand.zeilen.map((z: KalenderZeile, i: number) => kalenderEintrag(a, z, istVorbei(z, stand.datum, jetztMs), `kal-${i}`)) : null}
    </Box>
  )
}
