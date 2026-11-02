// Vorlader für pipeline/check-fetch-pruefungen-laufzeit.ts: eine Netflix-Reihe aus Staffel 1, einer OVA und Staffel 2 (Namen „Staffelreihe“,
// „Staffelreihe Nebenausgabe“, „Staffelreihe 2“) unter EINER Netflix-Adresse, Bestand als Attrappe wie in `meldung-netflix-umleitung-mock.mjs`.
// AK_SZENARIO: `zwei` = 12 Meldungen Staffel 2 (Netflix meldet den Auftrag der ersten Staffel als titel_id); `gemischt` = je 12 Meldungen Staffel 1 und 2.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { baueFetchAttrappe, istMeldungsabruf, meldungsAntwort } from './fetch-attrappe.mjs'

// `primegemischt` = je 12 Meldungen Staffel 1 und 2 an EINER Prime-Seite (eine Gruppe mit zwei Staffelnummern).
const PRIME = process.env.AK_SZENARIO === 'primegemischt'
const PLATTFORM = PRIME ? 'primevideo' : 'netflix'
const NETFLIX = PRIME ? 'https://www.amazon.de/gp/video/detail/B0TESTSTAFF' : 'https://www.netflix.com/title/81152346'
const stream = [{ platform: PLATTFORM, url: NETFLIX }]
const titel = (id, titleDe, format, jpStart, episodes) => ({ id, titleDe, format, jpStart, episodes, franchiseId: 7, streams: stream })
// `ohnezahl` = Staffel 2 gemeldet, aber unser zweiter Titel trägt keine Zahl im Namen (Haikyu!! TO THE TOP, 22.09.2026).
// `notizen` = 24 durchgezählte Meldungen EINER Gruppe (Folge 1–24, ohne Staffelnummer) mit Netflix' Aufteilung 1–12 / 13–24, Notiz je Folge:
// der Beleg trägt die Notiz der letzten Meldung seiner Staffel (Folge 12), nicht die der Gruppe (22.09.2026).
const OHNE_ZAHL = process.env.AK_SZENARIO === 'ohnezahl'
const titles = [
  titel(900001, 'Staffelreihe', 'TV', '2020-01-01', 12),
  titel(900002, 'Staffelreihe Nebenausgabe', 'OVA', '2020-06-01', 1),
  titel(900003, OHNE_ZAHL ? 'Staffelreihe Fortsetzung' : 'Staffelreihe 2', 'TV', '2021-01-01', 12),
]
const reihe = titles.map((t) => ({ id: t.id, name: t.titleDe, format: t.format, jpStart: t.jpStart }))
// `summe` / `summefalsch` = F100: ein Cartoon (-900001, 40 Folgen) an der Netflix-Adresse, Netflix meldet nur Staffel 2 (12 Folgen) mit Folgentiteln
// "Titel <28 + n>" (`summefalsch`: um 5 verschoben); die Wegwerf-Wurzel liefert unsere Folgenliste und JustWatch (28 Folgen davor).
// `summerl` = dasselbe ohne Titel in der Notiz (wie Beyblade X bei Netflix), die Titel kommen aus RTL+; `summerl2` = Anbieter-Staffeln 2 und 3 zu je 6 Folgen.
// `summerl3` = wie `summerl2`, aber Staffel 3 trägt richtige Titel in der Notiz (dürfen die Bestätigung von Staffel 2 nicht stellen); `summezwei` = zwei Titel an der Netflix-Adresse.
const SUMME = ['summe', 'summefalsch', 'summerl', 'summerl2', 'summerl3', 'summezwei'].includes(process.env.AK_SZENARIO)
const summeTitel = { id: -900001, titleDe: 'Summenreihe', format: 'TV', episodes: 40, streams: stream }
const attrappe = SUMME ? { titles: [], franchises: {}, cartoons: process.env.AK_SZENARIO === 'summezwei' ? [summeTitel, { ...summeTitel, id: -900002, titleDe: 'Summenreihe Zwei' }] : [summeTitel] } : { titles, franchises: { 7: reihe }, cartoons: [] }
const bestandDatei = /(?:^|[\\/])public[\\/]data[\\/](titles|franchises|cartoons)\.json$/

const echteLesung = fs.readFileSync
fs.readFileSync = (p, ...rest) => {
  const treffer = typeof p === 'string' ? bestandDatei.exec(p) : null
  return treffer ? JSON.stringify(attrappe[treffer[1]]) : echteLesung(p, ...rest)
}
syncBuiltinESMExports()

const zeile = (staffel, nr) => ({
  id: 930000 + staffel * 100 + nr,
  plattform: PLATTFORM,
  url: NETFLIX,
  sprachen: '["Deutsch"]',
  befund: 'dub',
  titel: 'Staffelreihe',
  folgen: 12,
  folge_nr: nr,
  staffel,
  staffeln: null,
  serientitel: null,
  notiz: 'Netflix-Seite: Staffeltest',
  teil_von: null,
  teil_bis: null,
  gemeldet_am: '2026-10-18T10:00:00.000Z',
  seiten_kennung: PRIME ? 'B0TESTSTAFF' : null,
  titel_id: 900001,
  folge: null,
})
const folgen = (staffel) => Array.from({ length: 12 }, (_, i) => zeile(staffel, i + 1))
const aufteilung = JSON.stringify([{ seq: 1, name: 'Staffel 1', folgen: 12, erste: 1 }, { seq: 2, name: 'Staffel 2', folgen: 12, erste: 13 }])
const durchgezaehlt = Array.from({ length: 24 }, (_, i) => ({ ...zeile(0, i + 1), staffel: null, staffeln: aufteilung, notiz: `Randprobe Folge ${i + 1}` }))

const verschiebung = process.env.AK_SZENARIO === 'summefalsch' ? 5 : 0
const nurStaffel2 = JSON.stringify([{ seq: 2, name: '', folgen: 12, erste: 1 }])
const ohneTitel = ['summerl', 'summerl2', 'summerl3', 'summezwei'].includes(process.env.AK_SZENARIO)
const notizDerSumme = (i) => (ohneTitel ? '8 Tonspuren' : `Folge ${i + 1}: Titel ${29 + i + verschiebung}`)
const summeMeldungen = Array.from({ length: 12 }, (_, i) => ({ ...zeile(2, i + 1), titel_id: process.env.AK_SZENARIO === 'summezwei' ? null : -900001, staffeln: nurStaffel2, notiz: notizDerSumme(i) }))
const zweiStaffeln = JSON.stringify([{ seq: 2, name: '', folgen: 6, erste: 1 }, { seq: 3, name: '', folgen: 6, erste: 1 }])
const summeMeldungen2 = [2, 3].flatMap((s) => Array.from({ length: 6 }, (_, i) => ({ ...zeile(s, i + 1), titel_id: -900001, staffeln: zweiStaffeln, notiz: s === 3 && process.env.AK_SZENARIO === 'summerl3' ? `Folge ${i + 1}: Titel ${35 + i}` : '8 Tonspuren' })))

globalThis.fetch = baueFetchAttrappe(
  (url, opt) => {
    if (!istMeldungsabruf(url, opt)) return undefined
    if (SUMME) return meldungsAntwort(['summerl2', 'summerl3'].includes(process.env.AK_SZENARIO) ? summeMeldungen2 : summeMeldungen)
    if (process.env.AK_SZENARIO === 'notizen') return meldungsAntwort(durchgezaehlt)
    return meldungsAntwort(process.env.AK_SZENARIO !== 'zwei' && process.env.AK_SZENARIO !== 'ohnezahl' ? [...folgen(1), ...folgen(2)] : folgen(2))
  },
)
