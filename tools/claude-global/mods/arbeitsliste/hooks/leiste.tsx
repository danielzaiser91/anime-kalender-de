// Leiste über dem Prompt (Daniel, 10.10.2026 23:11): zwei Knöpfe und zwei Statusbälle, dazu seit 11.10.2026 „Lecks n/5“.
// Nur Textzeichen: SVG-Bilder wurden bei jedem Neuzeichnen neu dekodiert und blinkten ein Bild lang leer (11.10.2026).
import { lecksText } from './lecks'
import type { Lecks } from './lecks'
import { agentenText } from './pruefer'

export type LeisteStand = {
  // Laufende Agenten ohne Prüfer; Prüfer zählen getrennt (Daniel, 11.10.2026).
  agenten: number
  pruefer: number
  jetzt: number
  // Endzeit „23:30“ des autonomen Modus, null = aus.
  autonomBis: string | null
  // „hart“: höchstens 1 Agent sofort; „sanft“: Laufende enden, die Sanduhr steht, bis höchstens 1 übrig ist.
  ruhe: 'hart' | 'sanft' | null
  // Prozess-Lecks (Zähler der Inventur), null = keine Zählerdatei, nichts zeichnen.
  lecks?: Lecks | null
  oeffneAgenten: () => void
  oeffneListe: () => void
}

// Gefüllt = an, leer = aus.
function ball(ui: any, key: string, an: boolean, themenfarbe: string) {
  const { Text } = ui
  return (
    <Text key={key} color={themenfarbe}>
      {an ? '●' : '○'}
    </Text>
  )
}

// Sanduhr neben dem Ruhe-Ball (Daniel, 11.10.2026): Ruhemodus sanft wartet, bis höchstens 1 Agent läuft; Prüfer zählen nicht (14.10.2026).
function sanduhr(ui: any) {
  const { Text } = ui
  return (
    <Text key="sanduhr" color="warning">
      ⧗
    </Text>
  )
}

function lecksAnzeige(ui: any, l: Lecks) {
  const { Text } = ui
  return (
    <Text key="lecks" color={l.urteil === 'leck' ? 'warning' : l.urteil === 'sauber' ? 'success' : 'suggestion'}>
      {lecksText(l)}
    </Text>
  )
}

export function baueLeiste(ui: any, s: LeisteStand) {
  const { Box, Button } = ui
  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      <Button key="agents-oeffnen" plain label={agentenText(s.agenten, s.pruefer)} onPress={s.oeffneAgenten} />
      <Button key="oeffnen" plain label={`Arbeitsliste ${s.jetzt}`} onPress={s.oeffneListe} />
      {ball(ui, 'ball-autonom', !!s.autonomBis, 'success')}
      {ball(ui, 'ball-ruhe', !!s.ruhe, 'warning')}
      {s.ruhe === 'sanft' && s.agenten > 1 ? sanduhr(ui) : null}
      {s.lecks ? lecksAnzeige(ui, s.lecks) : null}
    </Box>
  )
}
