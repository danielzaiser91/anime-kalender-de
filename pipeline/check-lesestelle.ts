/**
 * Zusicherungen für `web/src/lib/lesestelle.ts` (Lesestelle über ein Neuladen retten) mit Fake-Dokument, ohne Browser.
 * Läuft in `check:logic`. Jede Zusage aus dem Kopfkommentar hat mindestens einen Fall.
 */
import {
  FRIST_MS,
  GUELTIG_MS,
  NACHLAUF_MS,
  SCHLUESSEL,
  darfWiederherstellen,
  lesestelleFuehrt,
  merkeBeimVerbergen,
  lesestelleOffenFuer,
  merkeLesestelle,
  nimmLesestelle,
  stelleWiederHer,
  starteWiederherstellung,
  type Lesestelle,
  type Umgebung,
} from '../web/src/lib/lesestelle.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

type Tag = { datum: string; top: number; bottom: number }
const KOPF = 56

function dok(tage: Tag[], hoehe = KOPF) {
  const el = (t: Tag) => ({ dataset: { datum: t.datum }, getBoundingClientRect: () => ({ top: t.top, bottom: t.bottom, height: t.bottom - t.top }) })
  return {
    querySelector: (sel: string) => {
      if (sel === 'header') return { getBoundingClientRect: () => ({ height: hoehe }) }
      const m = /data-datum="([^"]+)"/.exec(sel)
      const t = m && tage.find((x) => x.datum === m[1])
      return t ? el(t) : null
    },
    querySelectorAll: () => tage.map(el),
  } as unknown as Document
}

function speicher() {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const ORT = '/#/'
function stelle(extra: Partial<Lesestelle> = {}): Lesestelle {
  return { datum: '2026-10-28', abstand: 44, ort: ORT, zeit: 1000, ...extra }
}

// merken: erster Tag, dessen Unterkante unter der Kopfleiste liegt; verdeckte Tage zählen nicht
{
  const s = speicher()
  merkeLesestelle(dok([{ datum: '2026-10-27', top: -300, bottom: 40 }, { datum: '2026-10-28', top: 100, bottom: 600 }, { datum: '2026-10-29', top: 600, bottom: 900 }]), s, ORT, 5000)
  const got = JSON.parse(s.m.get(SCHLUESSEL) ?? 'null')
  pruefe('merke: nimmt den ersten Tag unter der Kopfleiste, Abstand = Oberkante − Kopfhöhe', got?.datum === '2026-10-28' && got.abstand === 100 - KOPF && got.ort === ORT && got.zeit === 5000, got)
}
{
  const s = speicher()
  merkeLesestelle(dok([{ datum: '2026-10-27', top: -300, bottom: KOPF + 1 }, { datum: '2026-10-28', top: 100, bottom: 600 }]), s, ORT, 1)
  pruefe('merke: Tag, dessen Unterkante genau Kopf+1 ist, zählt als verdeckt', JSON.parse(s.m.get(SCHLUESSEL) ?? 'null')?.datum === '2026-10-28')
}
{
  const s = speicher()
  merkeLesestelle(dok([{ datum: '2026-10-27', top: -300, bottom: 10 }]), s, ORT, 1)
  merkeLesestelle(dok([]), s, ORT, 1)
  pruefe('merke: ohne sichtbaren Tag wird nichts gespeichert', s.m.size === 0)
}
{
  const kaputt = { getItem: () => null, setItem: () => { throw new Error('voll') }, removeItem: () => undefined }
  let geworfen = false
  try {
    merkeLesestelle(dok([{ datum: '2026-10-28', top: 100, bottom: 600 }]), kaputt, ORT, 1)
  } catch {
    geworfen = true
  }
  pruefe('merke: ein Speicherfehler wirft nicht', !geworfen)
}

// nehmen: einmal, Frist, Ansicht, Müll
{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle()))
  const a = nimmLesestelle(s, ORT, 1000 + GUELTIG_MS - 1)
  pruefe('nimm: gültig knapp vor der Frist', a?.datum === '2026-10-28', a)
  pruefe('nimm: gelesen heißt gelöscht', !s.m.has(SCHLUESSEL) && nimmLesestelle(s, ORT, 1000) === undefined)
}
{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle()))
  pruefe('nimm: genau GUELTIG_MS alt gilt nicht mehr', nimmLesestelle(s, ORT, 1000 + GUELTIG_MS) === undefined)
  pruefe('nimm: abgelaufene Lesestelle ist trotzdem gelöscht', !s.m.has(SCHLUESSEL))
}
{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle()))
  pruefe('nimm: andere Ansicht (Adresse) → keine', nimmLesestelle(s, '/#/news', 1001) === undefined)
  s.m.set(SCHLUESSEL, '{kaputt')
  pruefe('nimm: kaputtes JSON → keine', nimmLesestelle(s, ORT, 1001) === undefined)
  s.m.set(SCHLUESSEL, JSON.stringify({ datum: 5, abstand: 'x', ort: ORT, zeit: 1000 }))
  pruefe('nimm: falsche Feldtypen → keine', nimmLesestelle(s, ORT, 1001) === undefined)
}

// wiederherstellen: Abstand, sofort (auto), fehlender Tag, Untergrenze 0
{
  const aufrufe: ScrollToOptions[] = []
  const win = { scrollY: 1000, scrollTo: (o: ScrollToOptions) => void aufrufe.push(o) } as unknown as Window
  const ok = stelleWiederHer(dok([{ datum: '2026-10-28', top: 500, bottom: 900 }]), win, stelle({ abstand: 44 }))
  pruefe('herstellen: Tag landet im alten Abstand unter der Kopfleiste, sofort', ok && aufrufe.length === 1 && aufrufe[0].top === 500 + 1000 - KOPF - 44 && aufrufe[0].behavior === 'auto', aufrufe)
  const a2: ScrollToOptions[] = []
  const w2 = { scrollY: 0, scrollTo: (o: ScrollToOptions) => void a2.push(o) } as unknown as Window
  stelleWiederHer(dok([{ datum: '2026-10-28', top: 10, bottom: 900 }]), w2, stelle({ abstand: 300 }))
  pruefe('herstellen: nie negativ', a2[0]?.top === 0, a2)
  const a3: ScrollToOptions[] = []
  const w3 = { scrollY: 0, scrollTo: (o: ScrollToOptions) => void a3.push(o) } as unknown as Window
  pruefe('herstellen: Tag fehlt → false und kein Scroll', !stelleWiederHer(dok([]), w3, stelle()) && a3.length === 0)
}

// Start: Umgebung mit Frist- und Beobachter-Attrappe
function umgebung(tage: Tag[], s: ReturnType<typeof speicher>) {
  const sichtbar = tage
  const scrolls: ScrollToOptions[] = []
  const handler = new Map<string, () => void>()
  const fristen: Array<{ rueck: () => void; ms: number; aktiv: boolean }> = []
  let beobachter: (() => void) | undefined
  let beobachterAktiv = false
  const win = {
    scrollY: 0,
    scrollTo: (o: ScrollToOptions) => void scrolls.push(o),
    addEventListener: (art: string, f: () => void) => void handler.set(art, f),
    removeEventListener: (art: string) => void handler.delete(art),
  } as unknown as Window
  const u: Umgebung = {
    doc: dok(sichtbar),
    win,
    speicher: s,
    jetzt: () => 2000,
    beobachte: (r) => {
      beobachter = r
      beobachterAktiv = true
      return () => {
        beobachterAktiv = false
      }
    },
  }
  const frist = (rueck: () => void, ms: number) => {
    const f = { rueck, ms, aktiv: true }
    fristen.push(f)
    return () => {
      f.aktiv = false
    }
  }
  return {
    u,
    frist,
    scrolls,
    handler,
    fristen,
    sichtbar,
    meldeDomAenderung: () => {
      if (beobachterAktiv) beobachter?.()
    },
    laufe: (ms: number) => {
      for (const f of fristen.filter((x) => x.aktiv && x.ms === ms)) {
        f.aktiv = false
        f.rueck()
      }
    },
    beobachterAktiv: () => beobachterAktiv,
  }
}
const TAG: Tag = { datum: '2026-10-28', top: 300, bottom: 800 }

{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle({ zeit: 1500 })))
  const k = umgebung([], s)
  starteWiederherstellung(k.u, ORT, k.frist)
  pruefe('start: Lesestelle sofort offen für ihren Tag', lesestelleOffenFuer(['2026-10-28']))
  pruefe('start: …aber nicht für eine andere Woche', !lesestelleOffenFuer(['2026-11-03']))
  pruefe('start: Tag fehlt noch → kein Scroll', k.scrolls.length === 0)
  k.sichtbar.push(TAG)
  k.u.doc = dok(k.sichtbar)
  k.meldeDomAenderung()
  pruefe('start: erscheint der Tag, wird genau einmal gescrollt', k.scrolls.length === 1 && k.scrolls[0].behavior === 'auto', k.scrolls)
  pruefe('start: nach Erfolg bleibt sie für den Sprung-Entscheid offen', lesestelleOffenFuer(['2026-10-28']))
  pruefe('start: nach Erfolg ist der Beobachter aus', !k.beobachterAktiv())
  const gesprungen: { current: string | undefined } = { current: undefined }
  pruefe('führt: offene Lesestelle übernimmt, Woche gilt als angesprungen', lesestelleFuehrt([{ date: '2026-10-28' }], gesprungen, '2026-10-26') && gesprungen.current === '2026-10-26')
  const andere: { current: string | undefined } = { current: undefined }
  pruefe('führt: andere Woche → nein, Sprung bleibt erlaubt', !lesestelleFuehrt([{ date: '2026-11-03' }], andere, '2026-11-02') && andere.current === undefined)
  k.laufe(NACHLAUF_MS)
  pruefe('start: nach dem Nachlauf ist sie nicht mehr offen', !lesestelleOffenFuer(['2026-10-28']))
  pruefe('führt: nach dem Nachlauf übernimmt sie nicht mehr', !lesestelleFuehrt([{ date: '2026-10-28' }], { current: undefined }, '2026-10-26'))
}
{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle({ zeit: 1500 })))
  const k = umgebung([], s)
  starteWiederherstellung(k.u, ORT, k.frist)
  k.laufe(FRIST_MS)
  pruefe('start: Frist ohne Tag → aufgegeben, nicht mehr offen, Beobachter aus', !lesestelleOffenFuer(['2026-10-28']) && !k.beobachterAktiv())
  k.sichtbar.push(TAG)
  k.u.doc = dok(k.sichtbar)
  k.meldeDomAenderung()
  pruefe('start: nach der Frist wird nicht mehr gescrollt', k.scrolls.length === 0)
}
for (const art of ['wheel', 'touchstart', 'keydown', 'mousedown']) {
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle({ zeit: 1500 })))
  const k = umgebung([], s)
  starteWiederherstellung(k.u, ORT, k.frist)
  k.handler.get(art)?.()
  pruefe(`start: ${art} vor dem Tag beendet die Wiederherstellung`, !lesestelleOffenFuer(['2026-10-28']) && !k.beobachterAktiv())
  k.sichtbar.push(TAG)
  k.u.doc = dok(k.sichtbar)
  k.meldeDomAenderung()
  pruefe(`start: nach ${art} bleibt die Seite stehen`, k.scrolls.length === 0)
}
{
  const s = speicher()
  const k = umgebung([TAG], s)
  starteWiederherstellung(k.u, ORT, k.frist)
  pruefe('start: ohne gespeicherte Lesestelle nichts offen, nichts bewegt', !lesestelleOffenFuer(['2026-10-28']) && k.scrolls.length === 0 && k.fristen.length === 0)
}
{
  // Kreislauf: Merken vor dem Neuladen → Lesen im neuen Start → Wiederherstellen; Tag schon da → sofort
  const s = speicher()
  merkeLesestelle(dok([{ datum: '2026-10-28', top: 130, bottom: 700 }]), s, ORT, 1900)
  const k = umgebung([{ datum: '2026-10-28', top: 900, bottom: 1400 }], s)
  starteWiederherstellung(k.u, ORT, k.frist)
  pruefe('kreislauf: gemerkt (Abstand 74) → nach dem Neuladen im selben Abstand', k.scrolls.length === 1 && k.scrolls[0].top === 900 + 0 - KOPF - 74, k.scrolls)
  k.laufe(NACHLAUF_MS)
}

{
  // Browser lädt neu, ohne dass App-Code lief: die Lesestelle muss schon beim Verbergen im Speicher stehen
  const s = speicher()
  const ereignisse = new Map<string, () => void>()
  const winE = { addEventListener: (a: string, f: () => void) => void ereignisse.set('win:' + a, f) } as unknown as Window
  const d = dok([{ datum: '2026-10-28', top: 130, bottom: 700 }]) as unknown as { hidden: boolean; addEventListener: (a: string, f: () => void) => void }
  d.addEventListener = (a, f) => void ereignisse.set('doc:' + a, f)
  d.hidden = false
  const g = globalThis as unknown as { location: { pathname: string; hash: string } }
  g.location = { pathname: '/', hash: '#/' }
  merkeBeimVerbergen(d as unknown as Document, winE, s, () => 7000)
  ereignisse.get('doc:visibilitychange')?.()
  pruefe('verbergen: sichtbar → nichts gemerkt', s.m.get(SCHLUESSEL) === undefined)
  d.hidden = true
  ereignisse.get('doc:visibilitychange')?.()
  const l = JSON.parse(s.m.get(SCHLUESSEL) ?? 'null') as Lesestelle | null
  pruefe('verbergen: hidden merkt Tag, Abstand, Ort und Zeit', l?.datum === '2026-10-28' && l.abstand === 74 && l.ort === ORT && l.zeit === 7000, l)
  s.m.delete(SCHLUESSEL)
  ereignisse.get('win:pagehide')?.()
  pruefe('verbergen: pagehide merkt ebenfalls', s.m.has(SCHLUESSEL))
  const k = umgebung([{ datum: '2026-10-28', top: 900, bottom: 1400 }], s)
  k.u.jetzt = () => 7000 + 11 * 3_600_000
  starteWiederherstellung(k.u, ORT, k.frist)
  pruefe('verbergen: nach 11 h und Neuladen wird zurückgesetzt', k.scrolls.length === 1 && k.scrolls[0].top === 770, k.scrolls)
}
{
  const s = speicher()
  s.m.set(SCHLUESSEL, JSON.stringify(stelle({ zeit: 1000 })))
  pruefe('gültig: 11 h alt gilt', nimmLesestelle(s, ORT, 1000 + 11 * 3_600_000) !== undefined)
  s.m.set(SCHLUESSEL, JSON.stringify(stelle({ zeit: 1000 })))
  pruefe('gültig: 13 h alt gilt nicht', nimmLesestelle(s, ORT, 1000 + 13 * 3_600_000) === undefined)
  pruefe('art: reload darf', darfWiederherstellen('reload', false))
  pruefe('art: back_forward darf', darfWiederherstellen('back_forward', false))
  pruefe('art: verworfener Tab darf, auch bei navigate', darfWiederherstellen('navigate', true))
  pruefe('art: frische Navigation darf nicht', !darfWiederherstellen('navigate', false) && !darfWiederherstellen(undefined, false))
}

if (fehler > 0) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log(`✔ lesestelle: merken, nehmen (Frist, Ansicht, Müll), wiederherstellen (sofort, Frist, Berührung), Kreislauf (${faelle} Fälle)`)
