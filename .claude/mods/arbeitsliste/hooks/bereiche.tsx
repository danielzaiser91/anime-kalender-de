// Bereichskopf mit Klapp-Schalter und Kasten „Top-Prios“ (Daniel, 16.10.2026).
// Klappzustand: Kennungen `bereich:<id>` in der Liste `aufgeklappt`, gelesen als Abweichung vom Standard.
import { statusVon } from './prios'
import type { PrioEintrag } from './prios'
import type { Verweis } from './zaehlen'
import { zielZeile, zielZu } from './ziele'
import type { ZielStand } from './ziele'

// Standard: alles zu, nur „Jetzt“ und „Kalender heute“ offen; ein Eintrag in der Liste kehrt den Standard um.
const STANDARD_OFFEN = ['jetzt', 'kalender']

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

// Was der Kasten vom Pane braucht: Klappzustand, Öffnen eines Ziels.
export type PrioUmfeld = {
  offen: (kennung: string) => boolean
  schalte: (kennung: string) => void
  oeffne: (href: string) => void
  ziele: ZielStand[]
}

export const prioKennung = (e: PrioEintrag): string => `prio:${e.titel}`

// Link als Schaltfläche: graue Fläche mit fettem Pfeil in Textfarbe (bester Kontrast in beiden Themen).
function linkKnoepfe(ui: any, e: PrioEintrag, oeffne: (href: string) => void) {
  const { Box, Button, Text } = ui
  if (!e.links.length) return null
  return (
    <Box key={`links-${e.titel}`} flexDirection="row" flexWrap="wrap" gap={1} paddingLeft={2}>
      {e.links.map((v: Verweis, k: number) => (
        <Box key={`${e.titel}-l${k}`} backgroundColor="subtle" paddingX={1}>
          <Text bold>
            ↗
          </Text>
          <Button key={`link:${e.titel}:${k}`} plain label={` ${v.label}`} onPress={() => oeffne(v.href)} />
        </Box>
      ))}
    </Box>
  )
}

// Eine Zeile je Ziel: Chip, Kurzname, Fortschritt in % (Daniel, 15.11.2026); alles Weitere im Ausklapp-Teil.
const prozent = (z: ZielStand | undefined): string => (z?.gesamt ? ` ${Math.round((z.erreicht / z.gesamt) * 100)} %` : '')

function prioKopf(ui: any, e: PrioEintrag, u: PrioUmfeld) {
  const { Text } = ui
  const st = statusVon(e.status)
  return (
    <Text wrap="wrap">
      {st ? (
        <Text backgroundColor={st.farbe} color="inverseText" bold>
          {` ${st.label} `}
        </Text>
      ) : null}
      <Text bold>{`${st ? ' ' : ''}${e.titel}`}</Text>
      <Text dimColor>{prozent(zielZu(e.titel, u.ziele))}</Text>
    </Text>
  )
}

// Klapp-Schalter unter der Zeile; aufgeklappt: Text, Details, Meilenstein-Balken, Link-Knöpfe.
function prioDetails(ui: any, e: PrioEintrag, u: PrioUmfeld) {
  const { Box, Button, Text } = ui
  const z = zielZu(e.titel, u.ziele)
  const zeilen = [e.rest, ...e.details, z?.gesamt ? zielZeile(z) : ''].filter(Boolean)
  if (!zeilen.length && !e.links.length) return null
  const auf = u.offen(prioKennung(e))
  return (
    <Box flexDirection="column">
      <Button key={`klapp-${e.titel}`} plain dimColor label={auf ? '▾' : '▸'} onPress={() => u.schalte(prioKennung(e))} />
      {auf
        ? zeilen.map((t, k) => (
            // Echte Einrückung (marginLeft), damit umbrochene Folgezeilen unter dem Text bleiben.
            <Box key={`det-${e.titel}-${k}`} marginLeft={2}>
              <Text dimColor wrap="wrap">
                {t}
              </Text>
            </Box>
          ))
        : null}
      {auf ? linkKnoepfe(ui, e, u.oeffne) : null}
    </Box>
  )
}

// Kasten mit Rahmen ganz oben; je Ziel eine Zeile und darunter der Klapp-Schalter.
export function topPriosKasten(ui: any, eintraege: PrioEintrag[], u: PrioUmfeld) {
  const { Box, Text } = ui
  if (!eintraege.length) return null
  return (
    <Box key="top-prios" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text bold color="warning">
        Ziele
      </Text>
      {eintraege.map((e, i) => (
        <Box flexDirection="column" key={`top-${i}`}>
          {prioKopf(ui, e, u)}
          {prioDetails(ui, e, u)}
        </Box>
      ))}
    </Box>
  )
}
