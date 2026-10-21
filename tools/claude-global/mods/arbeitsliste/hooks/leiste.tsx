// Leiste über dem Prompt (Daniel, 10.10.2026 23:11): zwei Knöpfe und Statusbälle (seit 19.10.2026 drei: autonom, Ruhe, Spar).
// Nur Textzeichen: SVG-Bilder wurden bei jedem Neuzeichnen neu dekodiert und blinkten ein Bild lang leer (11.10.2026).
import { agentenText } from './pruefer'

export type LeisteStand = {
  // Laufende Agenten ohne Prüfer; Prüfer zählen getrennt (Daniel, 11.10.2026).
  agenten: number
  pruefer: number
  jetzt: number
  // Endzeit „23:30“ des autonomen Modus, null = aus.
  autonomBis: string | null
  // „hart“: höchstens 2 Agenten sofort; „sanft“ (Standard): Laufende enden, die Sanduhr steht, bis höchstens 2 übrig sind.
  ruhe: 'hart' | 'sanft' | null
  // Sparmodus (Daniel, 19.10.2026): nur günstige Subagenten, solange die Markerdatei existiert.
  spar: boolean
  oeffneAgenten: () => void
  oeffneListe: () => void
}

// Gefüllt = an, leer = aus.
// Gefüllter Ring statt Punkt (Daniel, 19.10.2026): an und aus gleich groß, nur die Füllung unterscheidet.
function ball(ui: any, key: string, an: boolean, themenfarbe: string) {
  const { Text } = ui
  return (
    <Text key={key} color={themenfarbe}>
      {an ? '◉' : '○'}
    </Text>
  )
}

// Sanduhr neben dem Ruhe-Ball (Daniel, 11.10.2026): Ruhemodus sanft wartet, bis höchstens 2 Agenten laufen; Prüfer zählen nicht (14.10.2026).
function sanduhr(ui: any) {
  const { Text } = ui
  return (
    <Text key="sanduhr" color="warning">
      ⧗
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
      {s.ruhe === 'sanft' && s.agenten > 2 ? sanduhr(ui) : null}
      {ball(ui, 'ball-spar', s.spar, 'suggestion')}
    </Box>
  )
}
