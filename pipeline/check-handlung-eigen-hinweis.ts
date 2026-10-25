/** Überholte eigene Handlungen sind ein Hinweis, verwaiste ein Fehler (`check-handlung-eigen-bestand.ts`); die Quelle gewinnt im Bau. Läuft in `check:logic`. */
import { bewerteEigeneHandlungen } from './lib/handlung-eigen-bestand.ts'
import { eigeneTexteAktiv, type EigeneHandlung } from './lib/handlung-eigen.ts'
import { laufeGegenKulisse } from './lib/bestand-kulisse.ts'

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
  905: { de: 'Quelltext' }, // Titel fehlt, Bestand führt trotzdem Text
}
const titel = new Set([901, 902, 903]) // 904 und 905 fehlen ganz
const r = bewerteEigeneHandlungen([901, 902, 903, 904].map(eintrag), titel, (id) => bestand[id])
pruefe('überholt: nur Hinweis', r.hinweise.length === 1 && r.hinweise[0] === 901, r.hinweise.join('|'))
pruefe('verwaist: Fehler', r.fehler.length === 1 && r.fehler[0]!.includes('904'), r.fehler.join('|'))
const nurUeberholt = bewerteEigeneHandlungen([eintrag(901)], new Set([901]), (id) => bestand[id])
pruefe('nur überholt: kein Fehler', nurUeberholt.fehler.length === 0 && nurUeberholt.hinweise.length === 1)
const verwaistMitText = bewerteEigeneHandlungen([eintrag(905)], titel, (id) => bestand[id])
pruefe('Titel fehlt und Bestand führt Text: nur Fehler, kein Hinweis', verwaistMitText.fehler.length === 1 && verwaistMitText.hinweise.length === 0, JSON.stringify(verwaistMitText))
pruefe('leer', bewerteEigeneHandlungen([], titel, () => undefined).hinweise.length === 0)

// Bau-Regel mit festem Fixture (nicht der Live-Datei): liefert eine Quelle für den ersten Eintrag einen Text, gewinnt sie; die anderen bleiben aktiv.
const fix = [eintrag(911), eintrag(912), eintrag(913)]
const bau = eigeneTexteAktiv(fix, (id) => id === 911, () => true)
pruefe('Bau: Quelltext gewinnt', bau.ungenutzt.length === 1 && bau.ungenutzt[0]!.id === 911, JSON.stringify(bau.ungenutzt))
pruefe('Bau: übrige Einträge aktiv', bau.aktiv.map((e) => e.id).join(',') === '912,913', JSON.stringify(bau.aktiv))
pruefe('Bau: leere Liste stürzt nicht ab', eigeneTexteAktiv([], () => true, () => true).aktiv.length === 0)

// Das Skript als eigener Prozess: Exit-Code und Zeile.
const SKRIPT = 'check-handlung-eigen-bestand.ts'
const lauf = (e: EigeneHandlung[], t: unknown[], g: Record<string, unknown>) =>
  laufeGegenKulisse(SKRIPT, {
    'data/handlung-eigen.yaml': JSON.stringify(e), // JSON ist gültiges YAML
    'public/data/titles.json': JSON.stringify(t),
    'public/data/synopses/1.json': JSON.stringify(g), // 33 % 32 = 1
  })
const a = lauf([eintrag(33)], [{ id: 33 }], { 33: { de: 'Quelltext' } })
pruefe('Prozess überholt: Exit 0 + WARNUNG-Zeile', a.code === 0 && /^⚠ WARNUNG Eigene Handlung: 1 überholt .*: 33$/m.test(a.aus), `${a.code} ${a.aus}`)
const b = lauf([eintrag(33), eintrag(65)], [{ id: 33 }], {})
pruefe('Prozess verwaist: Exit 1', b.code === 1 && b.aus.includes('FEHLER') && b.aus.includes('65'), `${b.code} ${b.aus}`)
const c = lauf([eintrag(33)], [{ id: 33 }], {})
pruefe('Prozess sauber: Exit 0 ohne WARNUNG', c.code === 0 && !c.aus.includes('⚠ WARNUNG'), `${c.code} ${c.aus}`)
const d = laufeGegenKulisse(SKRIPT, {
  'data/handlung-eigen.yaml': JSON.stringify([eintrag(33)]),
  'public/data/titles.json': '[]',
  'public/data/meta.json': JSON.stringify({ quarantaene: [{ titleId: 33, releases: [] }] }),
})
pruefe('Prozess: zurückgestellter Titel gilt nicht als verwaist', d.code === 0 && !d.aus.includes('FEHLER'), `${d.code} ${d.aus}`)

if (fehler) process.exit(1)
console.log('Eigene Handlung überholt: Hinweis statt Fehler, Quelle gewinnt im Bau, Prozess-Exit 0/1 mit WARNUNG-Zeile: 12 Fälle ok.')
