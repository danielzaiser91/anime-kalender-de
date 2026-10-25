/** Überholte eigene Handlungen sind ein Hinweis, verwaiste ein Fehler (`check-handlung-eigen-bestand.ts`); die Quelle gewinnt im Bau. Läuft in `check:logic`. */
import { bewerteEigeneHandlungen } from './lib/handlung-eigen-bestand.ts'
import { ergaenzeEigeneHandlungen } from './bau/handlung-eigen-einbinden.ts'
import { ladeEigeneHandlungen, type EigeneHandlung } from './lib/handlung-eigen.ts'
import { type SynopsisEintrag } from './bau/13-1-anreichern.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}
const eintrag = (id: number): EigeneHandlung => ({ id, text: 'x', umfang: 'titel', lizenz: 'l', quellen: [] })
const bestand: Record<number, { de?: string; eigen?: unknown }> = {
  901: { de: 'Quelltext' }, // überholt
  902: { de: 'Eigener Text', eigen: {} }, // genutzt
  903: {}, // kein Text
}
const titel = new Set([901, 902, 903]) // 904 fehlt ganz
const r = bewerteEigeneHandlungen([901, 902, 903, 904].map(eintrag), titel, (id) => bestand[id])
pruefe('überholt: nur Hinweis', r.hinweise.length === 1 && r.hinweise[0]!.includes('901'), r.hinweise.join('|'))
pruefe('verwaist: Fehler', r.fehler.length === 1 && r.fehler[0]!.includes('904'), r.fehler.join('|'))
const nurUeberholt = bewerteEigeneHandlungen([eintrag(901)], new Set([901]), (id) => bestand[id])
pruefe('nur überholt: kein Fehler', nurUeberholt.fehler.length === 0 && nurUeberholt.hinweise.length === 1)
pruefe('leer', bewerteEigeneHandlungen([], titel, () => undefined).hinweise.length === 0)

// Bau mit der echten Datei: liefert eine Quelle für den ersten Eintrag einen Text, gewinnt sie; alle anderen Einträge bleiben aktiv.
const echte = ladeEigeneHandlungen()
const id = echte[0]!.id
const synopses: Record<number, SynopsisEintrag> = { [id]: { de: 'Quelltext' } as SynopsisEintrag }
const aktiv = ergaenzeEigeneHandlungen(synopses, echte.map((e) => ({ id: e.id })))
pruefe('Bau: Quelltext bleibt', synopses[id]!.de === 'Quelltext' && !synopses[id]!.eigen)
pruefe('Bau: übrige Einträge aktiv', aktiv === echte.length - 1, String(aktiv))

if (fehler) process.exit(1)
console.log('Eigene Handlung überholt: Hinweis statt Fehler, Quelle gewinnt im Bau: 6 Fälle ok.')
