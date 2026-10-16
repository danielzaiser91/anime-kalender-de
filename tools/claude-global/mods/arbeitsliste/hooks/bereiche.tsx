// Bereichskopf mit Klapp-Schalter und Kasten „Top-Prios“ (Daniel, 16.10.2026).
// Klappzustand: Kennungen `bereich:<id>` in der Liste `aufgeklappt`, gelesen als Abweichung vom Standard.
import { hatAusklapp, statusVon, textKlappt } from './prios'
import type { PrioEintrag } from './prios'
import type { Verweis } from './zaehlen'

// Standard: alles zu, nur „Jetzt“ offen; ein Eintrag in der Liste kehrt den Standard um.
const STANDARD_OFFEN = ['jetzt']

export const bereichsKennung = (id: string): string => `bereich:${id}`

export function bereichOffen(id: string, geschaltet: string[]): boolean {
  return STANDARD_OFFEN.includes(id) !== geschaltet.includes(bereichsKennung(id))
}

// Kopfzeile eines Bereichs: ein Knopf, dessen Label Titel und Anzahl trägt (auch eingeklappt).
// Button nimmt nur ein Label, keine Textstile im Inneren: Hervorhebung nur über dimColor.
export function bereichsKopf(ui: any, id: string, offen: boolean, onPress: () => void, titel: string, zahl?: number, gedimmt = false) {
  const { Button } = ui
  const label = `${offen ? '▾' : '▸'} ${titel}${zahl === undefined ? '' : ` ${zahl}`}`
  return <Button key={bereichsKennung(id)} plain dimColor={gedimmt} onPress={onPress} label={label} />
}

// Was der Kasten vom Pane braucht: Breite, Klappzustand, Öffnen eines Ziels.
export type PrioUmfeld = {
  zeichenJeZeile: number
  offen: (kennung: string) => boolean
  schalte: (kennung: string) => void
  oeffne: (href: string) => void
}

export const prioKennung = (e: PrioEintrag): string => `prio:${e.titel}`

// Link als Schaltfläche: graue Fläche (in beiden Themen lesbar), Pfeil in der Link-Farbe des Themas.
function linkKnoepfe(ui: any, e: PrioEintrag, oeffne: (href: string) => void) {
  const { Box, Button, Text } = ui
  if (!e.links.length) return null
  return (
    <Box key={`links-${e.titel}`} flexDirection="row" flexWrap="wrap" gap={1} paddingLeft={2}>
      {e.links.map((v: Verweis, k: number) => (
        <Box key={`${e.titel}-l${k}`} backgroundColor="subtle" paddingX={1}>
          <Text color="suggestion" bold>
            ↗
          </Text>
          <Button plain label={` ${v.label}`} onPress={() => oeffne(v.href)} />
        </Box>
      ))}
    </Box>
  )
}

// Chip mit Status-Farbe, fetter Titel, Kurztext in höchstens vier Zeilen (zu lang: nur im Ausklapp-Teil).
function prioKopf(ui: any, e: PrioEintrag, u: PrioUmfeld) {
  const { Box, Button, Text } = ui
  const st = statusVon(e.status)
  const klappt = hatAusklapp(e, u.zeichenJeZeile)
  const auf = u.offen(prioKennung(e))
  return (
    <Box flexDirection="row">
      {klappt ? <Button key={`klapp-${e.titel}`} plain label={auf ? '▾ ' : '▸ '} onPress={() => u.schalte(prioKennung(e))} /> : <Text>{'  '}</Text>}
      <Box flexGrow={1} flexShrink={1}>
        <Text wrap="wrap">
          {st ? (
            <Text backgroundColor={st.farbe} color="inverseText" bold>
              {` ${st.label} `}
            </Text>
          ) : null}
          <Text bold>{`${st ? ' ' : ''}${e.titel}`}</Text>
          {e.rest && !textKlappt(e, u.zeichenJeZeile) ? <Text>{` ${e.rest}`}</Text> : null}
        </Text>
      </Box>
    </Box>
  )
}

function prioDetails(ui: any, e: PrioEintrag, u: PrioUmfeld) {
  const { Text } = ui
  if (!hatAusklapp(e, u.zeichenJeZeile) || !u.offen(prioKennung(e))) return null
  const zeilen = [textKlappt(e, u.zeichenJeZeile) ? e.rest : '', ...e.details].filter(Boolean)
  return zeilen.map((t, k) => (
    <Text key={`det-${e.titel}-${k}`} dimColor wrap="wrap">
      {`    ${t}`}
    </Text>
  ))
}

// Kasten mit Rahmen ganz oben, immer offen, ohne Schalter; je Eintrag Status-Chip, Text, Link-Knöpfe.
export function topPriosKasten(ui: any, eintraege: PrioEintrag[], u: PrioUmfeld) {
  const { Box, Text } = ui
  if (!eintraege.length) return null
  return (
    <Box key="top-prios" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text bold color="warning">
        Top-Prios
      </Text>
      {eintraege.map((e, i) => (
        <Box flexDirection="column" key={`top-${i}`}>
          {prioKopf(ui, e, u)}
          {prioDetails(ui, e, u)}
          {linkKnoepfe(ui, e, u.oeffne)}
        </Box>
      ))}
    </Box>
  )
}
