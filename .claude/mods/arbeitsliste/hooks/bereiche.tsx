// Bereichskopf mit Klapp-Schalter und Kasten „Ziele“ (Daniel, 16.10.2026; Farbkugeln seit 20.11.2026).
// Klappzustand: Kennungen `bereich:<id>` in der Liste `aufgeklappt`, gelesen als Abweichung vom Standard.
import { kennzahlText, kugelFarbe, naechsteAufgabe } from './ziele-ordner'
import type { ZielPlan } from './ziele-ordner'

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

// Zwei Zeilen je Ziel: „● Name  Kennzahl“ (Name öffnet plan.md), darunter „↳ Aufgabe“ (öffnet ihre .md).
function zielZeilen(ui: any, z: ZielPlan, oeffne: (pfad: string) => void) {
  const { Box, Button, Text } = ui
  const farbe = kugelFarbe(z)
  const a = naechsteAufgabe(z)
  const datei = a?.datei
  return (
    <Box flexDirection="column" key={`ziel-${z.name}`}>
      <Box flexDirection="row">
        <Text color={farbe ?? undefined} dimColor={!farbe}>
          ●
        </Text>
        <Button key={`ziel:${z.name}`} plain label={` ${z.name}`} onPress={() => oeffne(z.plan)} />
        <Text dimColor>{`  ${kennzahlText(z)}`}</Text>
      </Box>
      {a ? <Button key={`aufgabe:${z.name}`} plain dimColor={!datei} label={`↳ ${a.titel}`} onPress={() => datei && oeffne(datei)} /> : null}
    </Box>
  )
}

// Kasten mit Rahmen ganz oben; ohne Ziele kein Kasten.
export function zieleKasten(ui: any, ziele: ZielPlan[], oeffne: (pfad: string) => void) {
  const { Box, Text } = ui
  if (!ziele.length) return null
  return (
    <Box key="ziele" flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
      <Text bold color="warning">
        Ziele
      </Text>
      {ziele.map(z => zielZeilen(ui, z, oeffne))}
    </Box>
  )
}
