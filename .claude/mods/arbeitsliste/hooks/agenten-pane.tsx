// Bereich „Agenten“ oben im Pane: je laufendem Subagent Typ, Beschreibung und Laufzeit seit Start.
import { laufzeitText } from './agenten'
import type { LaufAgent } from './agenten'
import { istPruefer } from './pruefer'

export function agentenBereich(ui: any, agenten: LaufAgent[], jetzt: number) {
  const { Box, Text } = ui
  if (!agenten.length) return null
  const pruefer = agenten.filter(istPruefer).length
  return (
    <Box flexDirection="column">
      <Text bold>{`Agenten ${agenten.length - pruefer}${pruefer ? `+${pruefer}` : ''}`}</Text>
      {agenten.map(a => (
        <Text key={`agent-${a.id}`} wrap="wrap">
          {`  ● ${a.type}`}
          <Text dimColor>{` · ${a.description || 'ohne Beschreibung'} · ${laufzeitText(a.start, jetzt)}`}</Text>
        </Text>
      ))}
    </Box>
  )
}
