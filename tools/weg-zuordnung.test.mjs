/**
 * Disney+ „nichts da?“ bei mehreren Staffeln (Bleach-Form): Die Erweiterung kann keine `titelId` mitschicken
 * (`titelIdFuer` liefert bei mehreren Staffel-IDs null). Der Bau (`fetch-pruefungen.ts`) ordnet die Meldung dann
 * über die Adresse zu (`baueNachUrl`): alle Titel an dieser Adresse, nie „ohne Zuordnung“.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { baueNachUrl } from '../pipeline/lib/nach-url.ts'
import { schluesselAdresse } from '../pipeline/lib/zuordnung.ts'

const ext = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension')
const lies = (d) => readFileSync(join(ext, d), 'utf8')
const URL = 'https://www.disneyplus.com/de-de/series/bleach/4Afet1Q421gy'

/* Die Erweiterung: mehrere Staffeln, mehrere IDs → die Meldung trägt keine titelId. */
const k = vm.createContext({ Date, Set, Array, Number, Object, Boolean, String })
k.globalThis = k
vm.runInContext(lies('pruefstand-zeit.js'), k)
vm.runInContext(lies('disney-staffeln.js'), k)
vm.runInContext(lies('disney-weg.js'), k)
const gesendet = []
k.chrome = { storage: { sync: { get: async () => ({ token: 't' }) } } }
k.fetch = async (u, o) => (gesendet.push(JSON.parse(o.body)), { ok: true })
const staffeln = [
  { nr: 1, id: 'a1', folgen: 16 },
  { nr: 2, id: 'a2', folgen: 13 },
  { nr: 3, id: 'a3', folgen: 13 },
]
const vermerk = { merke: (u, ok) => ok }
const ok = await k.akDisneyWegSenden({ url: URL, titel: 'Bleach', staffeln }, { worker: 'https://w.example/pruefung', anbieterStaffeln: [], weg: vermerk })
assert.equal(ok, true, 'Meldung gesendet')
assert.equal(gesendet.length, 1)
assert.equal(gesendet[0].titelId ?? null, null, 'bei mehreren Staffel-IDs keine titelId')
assert.equal(gesendet[0].vorhanden, 'nein')
assert.equal(gesendet[0].url, URL, 'die Adresse ist die Zuordnung')

/* Mit einer einzigen Staffel-ID dagegen trägt sie die titelId (Gegenprobe, sonst wäre die Aussage oben leer). */
gesendet.length = 0
await k.akDisneyWegSenden({ url: URL, titel: 'Bleach', staffeln: [staffeln[0]] }, { worker: 'https://w.example/pruefung', anbieterStaffeln: [], weg: vermerk })
assert.equal(gesendet[0].titelId, 'a1', 'eine Staffel: titelId gesetzt')

/* Der Bau: drei Staffel-Titel teilen sich die Adresse → alle drei, in Reihenfolge, nicht nur der letzte. */
const titel = [
  { id: 101, streams: [{ url: URL }] },
  { id: 102, streams: [{ url: URL }, { url: URL }] },
  { id: 103, streams: [{ url: 'https://www.justwatch.example/gti-103', seite: URL }] },
  { id: 999, streams: [{ url: 'https://www.disneyplus.com/de-de/series/anderes/zzz' }] },
  { id: 998 },
]
const nachUrl = baueNachUrl(titel)
const ids = nachUrl.get(schluesselAdresse(URL)) ?? []
assert.deepEqual([...new Set(ids)].sort(), [101, 102, 103], 'alle Titel der Adresse')
assert.ok(ids.length > 0, 'ids.length > 0: keine Meldung ohne Zuordnung')
assert.deepEqual(nachUrl.get(schluesselAdresse('https://www.disneyplus.com/de-de/series/anderes/zzz')), [999], 'fremde Adresse bleibt getrennt')
assert.equal(nachUrl.get(schluesselAdresse('https://www.disneyplus.com/de-de/series/unbekannt/qqq')), undefined, 'unbekannte Adresse: keine Zuordnung (bleibt in ohneZuordnung)')
console.log('weg-zuordnung: 8 Prüfungen bestanden')
