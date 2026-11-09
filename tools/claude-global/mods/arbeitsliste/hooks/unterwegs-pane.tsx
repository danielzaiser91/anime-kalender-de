// Bereich „Titel unterwegs“ direkt unter „Jetzt“: farbiges Label mit Zeitstempel, Alter des Status, Dauer Info → live.
import { U_FARBE, dauerText, haengt, labelText, langsam, seitText } from './unterwegs'
import type { UStatus, UnterwegsEintrag } from './unterwegs'

function unterwegsZeile(ui: any, e: UnterwegsEintrag, i: number, jetzt: number) {
  const { Text } = ui
  const farbe = U_FARBE[e.status as UStatus]
  const seit = seitText(e, jetzt)
  const dauer = dauerText(e)
  return (
    <Text key={`unterwegs-${i}`} wrap="wrap">
      <Text backgroundColor={farbe ?? 'error'} color="inverseText" bold>
        {` ${farbe ? labelText(e) : `?${labelText(e)}`} `}
      </Text>
      <Text bold>{` ${e.titel}`}</Text>
      {e.meta ? <Text dimColor>{` · ${e.meta}`}</Text> : null}
      {seit ? <Text bold={haengt(e, jetzt)} color={haengt(e, jetzt) ? 'error' : undefined} dimColor={!haengt(e, jetzt)}>{` · ${seit}`}</Text> : null}
      {dauer ? <Text bold={langsam(e)} color={langsam(e) ? 'error' : undefined} dimColor={!langsam(e)}>{` · ${dauer}`}</Text> : null}
    </Text>
  )
}

export function unterwegsBereich(ui: any, eintraege: UnterwegsEintrag[], jetzt: number) {
  const { Box, Text } = ui
  if (!eintraege.length) return null
  return (
    <Box flexDirection="column">
      <Text bold>Titel unterwegs</Text>
      {eintraege.map((e, i) => unterwegsZeile(ui, e, i, jetzt))}
    </Box>
  )
}
