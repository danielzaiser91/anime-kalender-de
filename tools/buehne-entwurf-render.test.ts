/**
 * Render-Test der Bühnen-Ansicht „entwurf“ (`renderToString`, ohne Browser und ohne die App):
 * Fälle bauen (`faelle-bau.ts`), Zelle (`zelle-inhalt.tsx`), Ausschnitt `entwurf` und der Prüfstein `empfehlung-reise`.
 * Vorlage für künftige Bühnen-Entwürfe (Skill `mockups`).
 */
import assert from 'node:assert/strict'
import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { EIGENE_AUSSCHNITTE } from '../web/buehne/ausschnitte/eigene.ts'
import { EntwurfAnsicht } from '../web/buehne/ausschnitte/entwurf.tsx'
import type { Title } from '../shared/types.ts'
import type { AusschnittEigenschaften } from '../web/buehne/ausschnitte/typ.ts'
import { baueFaelle, ladeFaelleAus, type FaelleDatei, type Fall } from '../web/buehne/faelle-bau.ts'
import { mockup, mockupMit } from '../web/buehne/register.ts'
import { ZelleInhalt } from '../web/buehne/zelle-inhalt.tsx'
import { VorschlaegeAnsicht } from '../web/buehne/mockups/empfehlung-reise.tsx'

const rendere = <P extends object>(komponente: ComponentType<P>, eigenschaften: P): string => renderToString(createElement(komponente, eigenschaften))

// --- Fälle bauen: drei Fälle mit je eigenen Titeln, Kennungen 10…19 und 20…
const titel = (id: number) => ({ id, titleDe: `Titel ${id}`, coverImage: `https://bild.invalid/${id}.jpg` })
const roh = (): FaelleDatei => ({
  heute: '2999-12-31',
  meta: {},
  faelle: {
    a: { name: 'A', titleId: 10, synopsen: {}, disc: {}, sprecher: {}, folgen: {}, 'titles.json': [10, 11, 12, 13].map(titel) },
    b: { name: 'B', titleId: 14, synopsen: {}, disc: {}, sprecher: {}, folgen: {}, 'titles.json': [14, 15, 16].map(titel) },
    c: { name: 'C', titleId: 17, synopsen: {}, disc: {}, sprecher: {}, folgen: {}, 'titles.json': [17, 18, 19].map(titel) },
  },
})
const abgerufen: string[] = []
const attrappe = (async (adresse: URL) => {
  abgerufen.push(adresse.href)
  return new Response(JSON.stringify(roh()))
}) as unknown as typeof fetch
const fertig = await ladeFaelleAus(new URL('https://buehne.invalid/faelle.json'), attrappe)
assert.deepEqual(abgerufen, ['https://buehne.invalid/faelle.json'])
assert.deepEqual(Object.keys(fertig.faelle), ['a', 'b', 'c', 'alle', 'nutzer-neu', 'nutzer-aktiv'])
assert.equal((fertig.faelle.alle!['titles.json'] as unknown[]).length, 10)
assert.equal(fertig.faelle['nutzer-neu']!.name, 'Nutzer: neu (nichts gemerkt)')
assert.equal(fertig.faelle['nutzer-aktiv']!.name, 'Nutzer: 3 gemerkt, 5 gesehen')
assert.deepEqual(fertig.faelle['nutzer-neu']!.nutzer, { merkliste: [], verlauf: [] })
assert.deepEqual(fertig.faelle['nutzer-aktiv']!.nutzer, { merkliste: [10, 11, 12], verlauf: [13, 14, 15, 16, 17] })
assert.deepEqual(fertig.faelle['nutzer-aktiv']!['titles.json'], fertig.faelle.alle!['titles.json'])
assert.equal(fertig.faelle.alle!.nutzer, undefined)
assert.deepEqual(baueFaelle(roh()).faelle['nutzer-aktiv']!.nutzer, fertig.faelle['nutzer-aktiv']!.nutzer)

// --- Zelle: Mockup-Name, Variante (leer ohne `v`), Ersatz und Stil kommen beim Ausschnitt an.
const erhalten: AusschnittEigenschaften[] = []
const ausschnitte = {
  entwurf: (e: AusschnittEigenschaften) => {
    erhalten.push(e)
    return createElement('p', null, `mockup=${e.mockup};variante=${e.variante}`)
  },
}
const fall = fertig.faelle['nutzer-aktiv']!
const ersatzB = {}
mockup({ name: 'zz-zelle', titel: 'Zelle', ausschnitt: 'entwurf', faelle: [], varianten: { A: { ersatz: {}, stil: '.zz{}' }, B: { ersatz: ersatzB } } })
const zelle = (suche: string) => rendere(ZelleInhalt, { werte: new URLSearchParams(suche), fall, ausschnitte: ausschnitte as never })
assert.match(zelle('mockup=zz-zelle&v=B'), /mockup=zz-zelle;variante=B/)
assert.equal(erhalten.at(-1)!.fall, fall)
assert.equal(erhalten.at(-1)!.ersatz, ersatzB)
assert.match(zelle('mockup=zz-zelle'), /mockup=zz-zelle;variante=<\/p>$/)
assert.equal(erhalten.at(-1)!.variante, '')
assert.deepEqual(erhalten.at(-1)!.ersatz, {})
assert.match(zelle('mockup=zz-zelle&v=A'), /^<style>\.zz\{\}<\/style>/)
assert.doesNotMatch(zelle('mockup=zz-zelle&v=B'), /<style>/)
assert.match(zelle('mockup=zz-zelle&v=Z'), /variante=Z/)
assert.equal(zelle('mockup=gibt-es-nicht'), '')
assert.equal(zelle(''), '')

// --- Ausschnitt `entwurf`: Entwurf der Variante, Vorher = heutige Seite oder „Neu“.
assert.equal(EIGENE_AUSSCHNITTE.entwurf, EntwurfAnsicht)
const zeigeNutzer = (name: string) => (e: { fall: Fall }) => createElement('p', null, `${name}:${e.fall.nutzer?.merkliste.length}`)
mockup({ name: 'zz-neu', titel: 'Neu', ausschnitt: 'entwurf', faelle: [], varianten: { A: { ersatz: {}, entwurf: zeigeNutzer('EA') }, B: { ersatz: {}, entwurf: zeigeNutzer('EB') }, C: { ersatz: {} } } })
mockup({ name: 'zz-heute', titel: 'Heute', ausschnitt: 'entwurf', faelle: [], vorher: zeigeNutzer('HEUTE'), varianten: { A: { ersatz: {}, entwurf: zeigeNutzer('EA') } } })
const ansicht = (mockupName: string, variante: string) => rendere(EntwurfAnsicht, { fall, ersatz: {}, mockup: mockupName, variante })
assert.match(ansicht('zz-neu', 'A'), /EA:3/)
assert.match(ansicht('zz-neu', 'B'), /EB:3/)
assert.match(ansicht('zz-heute', ''), /HEUTE:3/)
assert.match(ansicht('zz-neu', ''), /Neu – diese Ansicht gibt es heute nicht/)
assert.match(ansicht('zz-neu', 'C'), /Neu – diese Ansicht/)
assert.match(ansicht('zz-heute', 'Z'), /Neu – diese Ansicht/)
assert.match(ansicht('gibt-es-nicht', 'A'), /Neu – diese Ansicht/)

// --- Prüfstein `empfehlung-reise`: Vorschläge je Nutzer-Fall.
const bestand = fertig.faelle.alle!['titles.json'] as Title[]
const data = { titles: bestand, titleById: new Map(bestand.map((t) => [t.id, t])) }
const vorschlaege = (nutzerFall: string) => rendere(VorschlaegeAnsicht, { fall: fertig.faelle[nutzerFall]!, data })
const zeilen = (html: string) => html.match(/<li /g)?.length ?? 0
const gemerkt = (html: string) => html.match(/aria-label="Gemerkt"/g)?.length ?? 0
const aktiv = vorschlaege('nutzer-aktiv')
assert.equal(zeilen(aktiv), 5)
assert.equal(gemerkt(aktiv), 3)
assert.deepEqual([...aktiv.matchAll(/Titel (\d+)</g)].map((m) => Number(m[1])), [10, 11, 12, 18, 19])
for (const gesehen of [13, 14, 15, 16, 17]) assert.ok(!aktiv.includes(`Titel ${gesehen}<`), `gesehen ${gesehen} fehlt`)
assert.ok(aktiv.indexOf('Gemerkt') < aktiv.indexOf('Titel 10<') + 400)
const neu = vorschlaege('nutzer-neu')
assert.equal(zeilen(neu), 5)
assert.equal(gemerkt(neu), 0)
assert.deepEqual([...neu.matchAll(/Titel (\d+)</g)].map((m) => Number(m[1])), [10, 11, 12, 13, 14])
assert.match(neu, /Fünf Vorschläge für dich/)

const reise = mockupMit('empfehlung-reise')!
assert.deepEqual(reise.faelle, ['nutzer-neu', 'nutzer-aktiv'])
assert.equal(reise.ausschnitt, 'entwurf')
assert.deepEqual(Object.keys(reise.varianten), ['A', 'B'])
assert.notEqual(reise.varianten.A.entwurf, reise.varianten.B.entwurf)
assert.match(ansicht('empfehlung-reise', 'A'), /Entdecken/)
assert.match(ansicht('empfehlung-reise', 'A'), /Los geht&#x27;s/)
assert.doesNotMatch(ansicht('empfehlung-reise', 'B'), /Entdecken/)
assert.match(ansicht('empfehlung-reise', ''), /Neu – diese Ansicht/)

console.log('buehne-entwurf-render.test: ok')
