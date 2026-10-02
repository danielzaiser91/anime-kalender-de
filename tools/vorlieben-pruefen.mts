// Zusicherung: Schnellfilter sind Vorlieben im Browser, keine Adress-Parameter (web/src/lib/vorlieben.ts). Speicher-Stub, kein Browser.
const speicher = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
}
;(globalThis as any).window = { location: { hash: '', pathname: '/' }, addEventListener() {}, removeEventListener() {} }
const { parseHash, buildHash } = await import('../web/src/lib/router.ts')
const { vorliebenNachfuehren } = await import('../web/src/lib/vorlieben.ts')
let fehler = 0
const ist = (ok: boolean, t: string) => { console.log((ok ? '✓ ' : '✗ ') + t); if (!ok) fehler++ }

const leer = parseHash('#/woche')
ist(!leer.filters.favoritesOnly && !leer.filters.excluded.releaseTypes.includes('disc'), 'ohne Vorlieben: Standardansicht')

// Disc ausblenden einschalten
const mitDisc = { ...leer.filters, excluded: { ...leer.filters.excluded, releaseTypes: ['disc'] as any } }
vorliebenNachfuehren(leer.filters, mitDisc)
const nach = parseHash('#/woche')
ist(nach.filters.excluded.releaseTypes.includes('disc'), 'Disc-Ausblenden bleibt nach dem Neuladen')
ist(!buildHash({ ...nach, view: 'woche' }).includes('xrt'), 'Adresse trägt kein xrt=disc')

// Kostenlos + Bestätigt + Favoriten
const alle = { ...nach.filters, kostenlosOnly: true, confirmedOnly: true, favoritesOnly: true, availableOnly: true }
vorliebenNachfuehren(nach.filters, alle)
const n2 = parseHash('#/datenbank')
ist(n2.filters.kostenlosOnly && n2.filters.confirmedOnly && n2.filters.favoritesOnly && n2.filters.availableOnly, 'alle Schnellfilter bleiben')
const h = buildHash(n2)
ist(!/fav=|frei=|sicher=|wo=/.test(h), `Adresse ohne Schnellfilter-Parameter (${h})`)

// ausschalten
vorliebenNachfuehren(n2.filters, { ...n2.filters, favoritesOnly: false })
ist(!parseHash('#/woche').filters.favoritesOnly, 'Favoriten wieder aus')

// Push-Link: fav=1 gilt einmalig, wird nicht zur Vorliebe
speicher.clear()
const push = parseHash('#/woche?fav=1')
ist(push.filters.favoritesOnly, 'fav=1 in der Adresse schaltet ein')
vorliebenNachfuehren(push.filters, { ...push.filters, kostenlosOnly: true })
const nachPush = parseHash('#/woche')
ist(nachPush.filters.kostenlosOnly && !nachPush.filters.favoritesOnly, 'fav=1 aus der Adresse wird nicht gemerkt, Kostenlos schon')

// Speicher gesperrt
;(globalThis as any).localStorage = { getItem() { throw new Error('gesperrt') }, setItem() { throw new Error('gesperrt') } }
let geworfen = false
try { parseHash('#/woche'); vorliebenNachfuehren(leer.filters, mitDisc) } catch { geworfen = true }
ist(!geworfen, 'gesperrter Speicher wirft nicht')
console.log(fehler ? `${fehler} Fehler` : 'alles ok')

process.exit(fehler ? 1 : 0)
