// Bereichskopf mit Klapp-Schalter und Kasten „Top-Prios“ (Daniel, 16.10.2026).
// Klappzustand: Kennungen `bereich:<id>` in der Liste `aufgeklappt`, gelesen als Abweichung vom Standard.
import { extrahiereLinks, klartext, kurzMitMarke } from './zaehlen'
import type { Eintrag } from './zaehlen'

// Standard: alles zu, nur „Jetzt“ offen; ein Eintrag in der Liste kehrt den Standard um.
const STANDARD_OFFEN = ['jetzt']

export const bereichsKennung = (id: string): string => `bereich:${id}`

export function bereichOffen(id: string, geschaltet: string[]): boolean {
  return STANDARD_OFFEN.includes(id) !== geschaltet.includes(bereichsKennung(id))
}

// Kurztitel ist der fette Anfang („**D1** — …“), auch unter 20 Zeichen (kurz() trennt dort nicht).
function topPrio(roh: string): Eintrag {
  const m = /^\*\*(.+?)\*\*\s*(?:—\s*)?(.*)$/.exec(roh)
  if (!m) return kurzMitMarke(roh)
  return { titel: klartext(m[1]!), rest: klartext(m[2]!), groesse: 'normal', links: extrahiereLinks(roh) }
}

// „## Top-Prios“: Zeilen „- “ bis zur nächsten „## “-Überschrift; fehlt der Abschnitt, bleibt die Liste leer.
export function zaehleTopPrios(text: string): Eintrag[] {
  const aus: Eintrag[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## Top-Prios')
    else if (drin && zeile.startsWith('- ')) aus.push(topPrio(zeile.slice(2)))
  }
  return aus
}

// Kopfzeile eines Bereichs: ein Knopf, dessen Label Titel und Anzahl trägt (auch eingeklappt).
// Button nimmt nur ein Label, keine Textstile im Inneren: Hervorhebung nur über dimColor.
export function bereichsKopf(ui: any, id: string, offen: boolean, onPress: () => void, titel: string, zahl?: number, gedimmt = false) {
  const { Button } = ui
  const label = `${offen ? '▾' : '▸'} ${titel}${zahl === undefined ? '' : ` ${zahl}`}`
  return <Button key={bereichsKennung(id)} plain dimColor={gedimmt} onPress={onPress} label={label} />
}

// Kasten mit Rahmen ganz oben, immer offen, ohne Schalter.
export function topPriosKasten(ui: any, eintraege: Eintrag[], kt: (text: string) => string, verweise: (z: Eintrag, key: string) => unknown) {
  const { Box, Text } = ui
  if (!eintraege.length) return null
  return (
    <Box key="top-prios" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text bold color="warning">
        Top-Prios
      </Text>
      {eintraege.map((z, i) => (
        <Box flexDirection="column" key={`top-${i}`}>
          <Text wrap="wrap">
            <Text bold>{z.titel}</Text>
            {z.rest ? <Text dimColor>{` — ${kt(z.rest)}`}</Text> : null}
          </Text>
          {verweise(z, `v-top-${i}`)}
        </Box>
      ))}
    </Box>
  )
}
