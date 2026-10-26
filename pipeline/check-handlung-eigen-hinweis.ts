/** Überholte und verwaiste eigene Handlungen sind Warnungen (`check-handlung-eigen-bestand.ts`, verwaist seit 26.10.2026); die Quelle gewinnt im Bau. Läuft in `check:logic`. */
import { bewerteEigeneHandlungen } from './lib/handlung-eigen-bestand.ts'
import { eigeneTexteAktiv, ladeEigeneHandlungen, type EigeneHandlung } from './lib/handlung-eigen.ts'
import { laufeGegenKulisse } from './lib/bestand-kulisse.ts'
import { ergaenzeEigeneHandlungen, ungenutztWarnung } from './bau/handlung-eigen-einbinden.ts'

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
const keiner = new Set<number>()
const r = bewerteEigeneHandlungen([901, 902, 903, 904].map(eintrag), titel, (id) => bestand[id], keiner)
pruefe('überholt: nur Hinweis', r.hinweise.length === 1 && r.hinweise[0] === 901, r.hinweise.join('|'))
pruefe('verwaist: Eintrag 904 gemeldet', r.verwaist.join() === '904', r.verwaist.join('|'))
const nurUeberholt = bewerteEigeneHandlungen([eintrag(901)], new Set([901]), (id) => bestand[id], keiner)
pruefe('nur überholt: kein Fehler', nurUeberholt.verwaist.length === 0 && nurUeberholt.hinweise.length === 1)
const verwaistMitText = bewerteEigeneHandlungen([eintrag(905)], titel, (id) => bestand[id], keiner)
pruefe('Titel fehlt und Bestand führt Text: nur verwaist, kein Hinweis', verwaistMitText.verwaist.length === 1 && verwaistMitText.hinweise.length === 0, JSON.stringify(verwaistMitText))
pruefe('leer', bewerteEigeneHandlungen([], titel, () => undefined, keiner).hinweise.length === 0)

// Hinter dem Toggle (verschoben, nicht verloren): Warnung statt verwaist; ein Titel ohne jede Spur bleibt verwaist.
const versteckt = bewerteEigeneHandlungen([904, 906].map(eintrag), titel, () => undefined, new Set([904, 907]))
pruefe('hinter dem Toggle: nur Warnung', versteckt.versteckt.join() === '904' && versteckt.verwaist.join() === '906', JSON.stringify(versteckt))
const sichtbarUndVersteckt = bewerteEigeneHandlungen([eintrag(901)], titel, (id) => bestand[id], new Set([901]))
pruefe('sichtbar und zugleich hinter dem Toggle: gilt als sichtbar', sichtbarUndVersteckt.versteckt.length === 0 && sichtbarUndVersteckt.hinweise.length === 1, JSON.stringify(sichtbarUndVersteckt))

// Die Bau-Warnung: hinter dem Toggle bleibt der Eintrag stehen, sonst lautet sie weiter "löschen".
const grund = { id: 5, grund: 'Titel nicht im Bestand' }
pruefe('Bau-Warnung hinter dem Toggle sagt, dass der Eintrag bleibt', ungenutztWarnung(grund, new Set([5])).includes('hinter dem Toggle') && !ungenutztWarnung(grund, new Set([5])).includes('löschen'))
pruefe('Bau-Warnung ohne Toggle bleibt "löschen"', ungenutztWarnung(grund, new Set([6])).includes('löschen') && !ungenutztWarnung(grund, new Set([6])).includes('Toggle'))
const echteId = ladeEigeneHandlungen()[0]!.id
const warnungen: string[] = []
const warnAlt = console.warn
console.warn = (...a: unknown[]) => void warnungen.push(a.join(' '))
ergaenzeEigeneHandlungen({}, [], [{ id: echteId }])
console.warn = warnAlt
pruefe('Bau: ergaenzeEigeneHandlungen gibt die verschobenen Titel an die Warnung weiter', warnungen.some((w) => w.includes(`Eigene Handlung ${echteId} liegt hinter dem Toggle`)), warnungen.join('|'))

// Bau-Regel mit festem Fixture (nicht der Live-Datei): liefert eine Quelle für den ersten Eintrag einen Text, gewinnt sie; die anderen bleiben aktiv.
const fix = [eintrag(911), eintrag(912), eintrag(913)]
const bau = eigeneTexteAktiv(fix, (id) => id === 911, () => true)
pruefe('Bau: Quelltext gewinnt', bau.ungenutzt.length === 1 && bau.ungenutzt[0]!.id === 911, JSON.stringify(bau.ungenutzt))
pruefe('Bau: übrige Einträge aktiv', bau.aktiv.map((e) => e.id).join(',') === '912,913', JSON.stringify(bau.aktiv))
pruefe('Bau: leere Liste stürzt nicht ab', eigeneTexteAktiv([], () => true, () => true).aktiv.length === 0)

// Das Skript als eigener Prozess: Exit-Code und Zeile.
const SKRIPT = 'check-handlung-eigen-bestand.ts'
const lauf = (e: EigeneHandlung[], t: unknown[], g: Record<string, unknown>, versteckt: unknown[] = []) =>
  laufeGegenKulisse(SKRIPT, {
    'data/handlung-eigen.yaml': JSON.stringify(e), // JSON ist gültiges YAML
    'public/data/titles.json': JSON.stringify(t),
    'public/data/synopses/1.json': JSON.stringify(g), // 33 % 32 = 1
    'public/data/ohne-synchro.json': JSON.stringify(versteckt),
  })
const a = lauf([eintrag(33)], [{ id: 33 }], { 33: { de: 'Quelltext' } })
pruefe('Prozess überholt: Exit 0 + WARNUNG-Zeile', a.code === 0 && /^⚠ WARNUNG Eigene Handlung: 1 überholt .*: 33$/m.test(a.aus), `${a.code} ${a.aus}`)
const b = lauf([eintrag(33), eintrag(65)], [{ id: 33 }], {})
pruefe('Prozess verwaist: Exit 0 + herabgestufte WARNUNG-Zeile', b.code === 0 && /^⚠ WARNUNG \[vorher rot\] Eigene Handlung: 1 ohne Titel im Bestand .*: 65$/m.test(b.aus) && !b.aus.includes('FEHLER'), `${b.code} ${b.aus}`)
const c = lauf([eintrag(33)], [{ id: 33 }], {})
pruefe('Prozess sauber: Exit 0 ohne WARNUNG', c.code === 0 && !c.aus.includes('⚠ WARNUNG'), `${c.code} ${c.aus}`)
const d = laufeGegenKulisse(SKRIPT, {
  'data/handlung-eigen.yaml': JSON.stringify([eintrag(33)]),
  'public/data/titles.json': '[]',
  'public/data/meta.json': JSON.stringify({ quarantaene: [{ titleId: 33, releases: [] }] }),
})
pruefe('Prozess: zurückgestellter Titel gilt nicht als verwaist', d.code === 0 && !d.aus.includes('FEHLER'), `${d.code} ${d.aus}`)

// Der Anlass vom 26.10.2026, wörtlich: Titel 212503 (Hyouken II) ist sichtbar gewesen, liegt hinter dem Toggle und trägt eine eigene Handlung.
const hyouken = { id: 212503, titleRomaji: 'Hyouken no Majutsushi ga Sekai wo Suberu II', jpStatus: 'RELEASING', ohneSynchro: true }
const e = lauf([eintrag(212503)], [{ id: 33 }], {}, [hyouken])
pruefe('Prozess hinter dem Toggle: Exit 0 + WARNUNG-Zeile', e.code === 0 && /^⚠ WARNUNG Eigene Handlung: 1 ohne deutsche Synchro im Katalog .*: 212503$/m.test(e.aus) && !e.aus.includes("FEHLER"), `${e.code} ${e.aus}`)
const g = lauf([eintrag(212503), eintrag(65)], [{ id: 33 }], {}, [hyouken])
pruefe('Prozess hinter dem Toggle und verwaist: nur der verwaiste in der herabgestuften Zeile', g.code === 0 && /^⚠ WARNUNG \[vorher rot\] Eigene Handlung: 1 ohne Titel im Bestand .*: 65$/m.test(g.aus), `${g.code} ${g.aus}`)
const h = lauf([eintrag(212503)], [{ id: 33 }], {}, [])
pruefe('Prozess ohne Liste hinter dem Toggle: verwaist, Exit 0', h.code === 0 && /^⚠ WARNUNG \[vorher rot\] Eigene Handlung: 1 ohne Titel im Bestand .*: 212503$/m.test(h.aus), `${h.code} ${h.aus}`)
// Festgehalten, nicht gewünscht: ohne-synchro.json führt den ganzen AniList-Katalog, Verschobene und Katalog sind dort nicht zu trennen — ein Katalogtitel ist nur Warnung.
const katalogTitel = lauf([eintrag(70)], [{ id: 33 }], {}, [{ id: 70, ohneSynchro: true }])
pruefe('Prozess Katalogtitel ohne Verschiebung: Warnung (bekannte Grenze), Exit 0', katalogTitel.code === 0 && /^⚠ WARNUNG Eigene Handlung: 1 ohne deutsche Synchro im Katalog .*: 70$/m.test(katalogTitel.aus), `${katalogTitel.code} ${katalogTitel.aus}`)

if (fehler) process.exit(1)
console.log('Eigene Handlung überholt: Hinweis statt Fehler, Quelle gewinnt im Bau, Prozess-Exit 0 mit WARNUNG-Zeile auch bei verwaist, hinter dem Toggle keine Verwaisung: alle Fälle ok.')
