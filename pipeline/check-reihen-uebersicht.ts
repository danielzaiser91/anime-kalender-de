/**
 * Zusicherungen für die Reihen-Übersicht großer Reihen (Daniel, F148, 20.11.2026): eingeklappte Gruppen mit Zahl, offen nur die
 * Gruppe des geöffneten Titels, in einer Gruppe über 12 Teilen ein Fenster um ihn mit „Alle n zeigen“. Kern ist „Zahl = Liste“:
 * live zählte der Kopf auch Teile hinter dem Schalter. Gerendert wird das echte `ReihenListe` im Mini-DOM; Klicks laufen über die
 * echten Knöpfe. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { ignoriereCss, installiereMiniDom, klicke, MiniKnoten } from '../tools/mini-dom.ts'

ignoriereCss()
const { useLang } = await import('../web/src/lib/i18n.tsx')
const { ReihenListe } = await import('../web/src/components/detail/reihen-liste.tsx')
const { fensterUm, gruppeVon, istGrosseReihe } = await import('../web/src/components/detail/reihen-uebersicht-regeln.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (name: string, ist: unknown, soll: unknown) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), ist)
const { t } = useLang()

const teil = (id: number, name: string, mehr: Partial<FranchiseMember> = {}): FranchiseMember =>
  ({ id, name, format: 'TV', jpYear: 2000, episodes: 12, ...mehr }) as FranchiseMember
const film = (n: number, mehr: Partial<FranchiseMember> = {}) => teil(900200 + n, `Reihe: Film ${n}`, { format: 'MOVIE', episodes: 1, jpYear: 2000 + n, ...mehr })
const filme = (anzahl: number, ohne: number[] = []) => Array.from({ length: anzahl }, (_, i) => film(i + 1, ohne.includes(i + 1) ? { ohneSynchro: true } : {}))

/* Große Reihe: 3 Staffeln, 15 Filme (14 und 15 ohne Synchro), 4 Specials (eins ohne Synchro). Ohne Schalter sind es 3 + 13 + 3 = 19. */
const GROSS: FranchiseMember[] = [
  teil(900101, 'Reihe', { jpYear: 1999 }),
  teil(900102, 'Reihe Staffel 2', { jpYear: 2003 }),
  teil(900103, 'Reihe Staffel 3', { jpYear: 2007 }),
  ...filme(15, [14, 15]),
  teil(900301, 'Reihe Special 1', { format: 'OVA', episodes: 1, jpYear: 2001 }),
  teil(900302, 'Reihe Special 2', { format: 'OVA', episodes: 1, jpYear: 2002 }),
  teil(900303, 'Reihe Special 3', { format: 'OVA', episodes: 1, jpYear: 2004 }),
  teil(900304, 'Reihe Special 4', { format: 'OVA', episodes: 1, jpYear: 2005, ohneSynchro: true }),
]
const ids = (teile: FranchiseMember[]) => teile.map((m) => m.id - 900200)

/* Regeln: Fenster aus fünf Teilen, am Rand verschoben; Größe hängt am sichtbaren Stand ohne Schalter. */
const dreizehn = filme(13)
gleich('Fenster am Anfang: 1–5', ids(fensterUm(dreizehn, 900201)), [1, 2, 3, 4, 5])
gleich('Fenster beim zweiten: 1–5', ids(fensterUm(dreizehn, 900202)), [1, 2, 3, 4, 5])
gleich('Fenster in der Mitte: 5–9', ids(fensterUm(dreizehn, 900207)), [5, 6, 7, 8, 9])
gleich('Fenster beim vorletzten: 9–13', ids(fensterUm(dreizehn, 900212)), [9, 10, 11, 12, 13])
gleich('Fenster am Ende: 9–13', ids(fensterUm(dreizehn, 900213)), [9, 10, 11, 12, 13])
gleich('Teil nicht in der Gruppe: alle', fensterUm(dreizehn, 900999).length, 13)
gleich('Gruppe mit drei Teilen: alle drei', ids(fensterUm(filme(3), 900202)), [1, 2, 3])
const gruppen = (anzahl: number, ohne: number[] = []) => [{ titel: 'Filme', teile: filme(anzahl, ohne) }]
pruefe('12 Filme: keine große Reihe', !istGrosseReihe(gruppen(12), 900201))
pruefe('13 Filme: große Reihe', istGrosseReihe(gruppen(13), 900201))
pruefe('13 Filme, einer ohne Synchro: 12 sichtbar, keine große Reihe', !istGrosseReihe(gruppen(13, [13]), 900201))
pruefe('13 Filme, der ohne Synchro ist geöffnet: große Reihe', istGrosseReihe(gruppen(13, [13]), 900213))
gleich('Gruppe des Teils', gruppeVon([{ titel: 'A', teile: filme(2) }, { titel: 'B', teile: [teil(900301, 'x')] }], 900301), 'B')
gleich('Teil in keiner Gruppe', gruppeVon([{ titel: 'A', teile: filme(2) }], 900999), undefined)

/* Fokus und `querySelectorAll` gibt es im Mini-DOM nicht; der Test braucht beide für „Alle zeigen“. */
let fokus: MiniKnoten | null = null
Object.assign(MiniKnoten.prototype, {
  focus(this: MiniKnoten) {
    fokus = this
  },
  querySelectorAll(this: MiniKnoten, art: string) {
    return this.finde((k) => k.localName === art)
  },
})

type Stand = { titel: number; ohneOffen?: boolean; suche?: string }
const aufrufe = { wechsel: [] as number[] }
function props(teile: FranchiseMember[], s: Stand) {
  return {
    reihenTeile: teile,
    t,
    reihenName: 'Reihe',
    title: { id: s.titel } as Title,
    favorites: new Set<number>(),
    wechselt: false,
    wechsleZu: (id: number) => void aufrufe.wechsel.push(id),
    reiheOhneOffen: s.ohneOffen ? 1 : null,
    reihenSchluessel: 1,
    reiheSuche: { reihe: 1, text: s.suche ?? '' },
    setReiheOhneOffen: () => {},
    setReiheSuche: () => {},
  }
}

/* Erst statisch (läuft auch gegen die Spur, die im Mini-DOM nicht misst): Kopfzahl = sichtbare Teile, nicht alle 22. */
const statisch = renderToStaticMarkup(h(ReihenListe, props(GROSS, { titel: 900102 })))
gleich('statisch: Kopfzahl 19 (3 + 13 + 3, ohne Teile hinter dem Schalter)', /tabular-nums text-ak-text">(\d+)</.exec(statisch)?.[1], '19')
pruefe('statisch: große Reihe als Übersicht', statisch.includes('data-reihe-uebersicht'))
if (!statisch.includes('data-reihe-uebersicht')) {
  console.error(`\n${verletzt} Prüfung(en) verletzt (keine Übersicht, Rest übersprungen)`)
  process.exit(1)
}

const klasse = (k: MiniKnoten) => k.attribute.get('class') ?? ''
async function oeffne(teile: FranchiseMember[], s: Stand) {
  const dom = installiereMiniDom(
    { setTimeout: () => 0, clearTimeout: () => {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
    () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }),
  )
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const zeige = (st: Stand) => act(async () => wurzel.render(h(ReihenListe, props(teile, st))))
  await zeige(s)
  const gruppenKnoten = () => dom.wurzel.finde((k) => k.attribute.has('data-reihe-gruppe'))
  const lage = () => {
    const kopfZahl = dom.wurzel.finde((k) => klasse(k).includes('rounded-full') && klasse(k).includes('tabular-nums'))[0]?.textContent
    const gruppe = gruppenKnoten().map((g) => {
      const kopf = g.finde((k) => k.attribute.has('aria-expanded'))[0]!
      const ziel = dom.wurzel.finde((k) => k.attribute.get('id') === kopf.attribute.get('aria-controls'))
      return {
        titel: g.attribute.get('data-reihe-gruppe'),
        zahl: Number(kopf.finde((k) => klasse(k).includes('tabular-nums'))[0]?.textContent),
        offen: kopf.attribute.get('aria-expanded') === 'true',
        ziel: ziel.length === 1 && g.contains(ziel[0]!),
        zeilen: g.finde((k) => k.attribute.has('data-reihe-teil')).map((k) => Number(k.attribute.get('data-reihe-teil')) - 900200),
        alle: g.finde((k) => k.attribute.has('data-reihe-alle'))[0]?.textContent ?? null,
      }
    })
    return { kopfZahl: kopfZahl === undefined ? null : Number(kopfZahl), gruppe, uebersicht: dom.wurzel.finde((k) => k.attribute.has('data-reihe-uebersicht')).length === 1 }
  }
  const kopfVon = (titel: string) => gruppenKnoten().find((g) => g.attribute.get('data-reihe-gruppe') === titel)!.finde((k) => k.attribute.has('aria-expanded'))[0]!
  return {
    lage,
    zeige,
    text: () => dom.wurzel.textContent,
    klickeGruppe: (titel: string) => act(async () => klicke(dom.wurzel, kopfVon(titel))),
    klickeTeil: (id: number) =>
      act(async () => klicke(dom.wurzel, dom.wurzel.finde((k) => k.attribute.get('data-reihe-teil') === String(id))[0]!.finde((k) => k.localName === 'button')[0]!)),
    klickeAlle: () => act(async () => klicke(dom.wurzel, dom.wurzel.finde((k) => k.attribute.has('data-reihe-alle'))[0]!)),
    schalterText: () => dom.wurzel.finde((k) => k.localName === 'label' && k.finde((x) => x.localName === 'input').length > 0)[0]?.textContent ?? '',
    ende: async () => {
      await act(async () => wurzel.unmount())
      dom.entferne()
    },
  }
}

/** Zahl = Liste: Kopfzahl = Summe der Gruppenzahlen; jede offene Gruppe zeigt so viele Zeilen (oder ihr Fenster plus „Alle n“). */
function zahlGleichListe(fall: string, l: Awaited<ReturnType<Awaited<ReturnType<typeof oeffne>>['lage']>>) {
  gleich(`${fall}: Kopfzahl = Summe der Gruppen`, l.kopfZahl, l.gruppe.reduce((s, g) => s + g.zahl, 0))
  for (const g of l.gruppe) {
    pruefe(`${fall}: ${g.titel} — aria-controls zeigt auf den eigenen Bereich`, g.ziel)
    if (!g.offen) gleich(`${fall}: ${g.titel} zu — keine Zeile`, g.zeilen.length, 0)
    else if (g.alle === null) gleich(`${fall}: ${g.titel} offen — Zeilen = Zahl`, g.zeilen.length, g.zahl)
    else gleich(`${fall}: ${g.titel} gekappt — „Alle n“ nennt die Zahl`, g.alle, `Alle ${g.zahl} zeigen`)
  }
}
const kurz = (l: Awaited<ReturnType<Awaited<ReturnType<typeof oeffne>>['lage']>>) => l.gruppe.map((g) => [g.titel, g.zahl, g.offen ? g.zeilen.length : '-'])

/* Staffel geöffnet: nur die Hauptserie offen; der Kopf zählt 19, nicht alle 22 Teile. */
const a = await oeffne(GROSS, { titel: 900102 })
pruefe('große Reihe: Übersicht statt Spur', a.lage().uebersicht)
gleich('Staffel geöffnet: Gruppen, Zahlen, offene Zeilen', kurz(a.lage()), [['Hauptserie', 3, 3], ['Filme', 13, '-'], ['Specials & OVAs', 3, '-']])
gleich('Staffel geöffnet: Kopf zählt nur Gezeigtes (19 statt 22)', a.lage().kopfZahl, 19)
zahlGleichListe('Staffel geöffnet', a.lage())
await a.klickeGruppe('Filme')
gleich('Filme aufgeklappt: alle 13, kein Fenster', [a.lage().gruppe[1]!.zeilen.length, a.lage().gruppe[1]!.alle], [13, null])
zahlGleichListe('Filme aufgeklappt', a.lage())
await a.klickeGruppe('Hauptserie')
gleich('Hauptserie zugeklappt', a.lage().gruppe[0]!.offen, false)
zahlGleichListe('Hauptserie zugeklappt', a.lage())
pruefe('Schalter nennt die 3 Teile dahinter', /3/.test(a.schalterText()), a.schalterText())
await a.zeige({ titel: 900102, ohneOffen: true })
gleich('Schalter an: 3 + 15 + 4, Kopf 22', [kurz(a.lage()).map((g) => g[1]), a.lage().kopfZahl], [[3, 15, 4], 22])
zahlGleichListe('Schalter an', a.lage())
await a.zeige({ titel: 900207 })
gleich('Wechsel auf Film 7: Filme bleibt offen, Hauptserie bleibt zu', a.lage().gruppe.map((g) => g.offen), [false, true, false])
await a.ende()

/* Film geöffnet: Fenster um ihn, „Alle 13 zeigen“; danach alle und der Fokus auf der ersten neuen Zeile. */
const b = await oeffne(GROSS, { titel: 900207 })
gleich('Film 7: nur Filme offen', b.lage().gruppe.map((g) => g.offen), [false, true, false])
gleich('Film 7: Fenster 5–9', b.lage().gruppe[1]!.zeilen, [5, 6, 7, 8, 9])
await b.klickeTeil(900208)
await b.klickeTeil(900207)
gleich('Klick auf Film 8 wechselt, der geöffnete Film 7 tut nichts', aufrufe.wechsel, [900208])
zahlGleichListe('Film 7 mit Fenster', b.lage())
fokus = null
await b.klickeAlle()
gleich('Alle gezeigt: 13 Zeilen, Knopf weg', [b.lage().gruppe[1]!.zeilen.length, b.lage().gruppe[1]!.alle], [13, null])
zahlGleichListe('Film 7 alle', b.lage())
gleich('Fenster begann nach dem Anfang: Fokus auf Film 1', fokus && Number((fokus as MiniKnoten).parentNode?.attribute.get('data-reihe-teil')) - 900200, 1)
await b.ende()

const c = await oeffne(GROSS, { titel: 900201 })
gleich('Film 1: Fenster 1–5', c.lage().gruppe[1]!.zeilen, [1, 2, 3, 4, 5])
fokus = null
await c.klickeAlle()
gleich('Fenster am Anfang: Fokus auf Film 6', fokus && Number((fokus as MiniKnoten).parentNode?.attribute.get('data-reihe-teil')) - 900200, 6)
await c.ende()

const d = await oeffne(GROSS, { titel: 900213 })
gleich('Film 13 (letzter sichtbarer): Fenster 9–13', d.lage().gruppe[1]!.zeilen, [9, 10, 11, 12, 13])
await d.ende()

/* Ein Teil ohne Synchro ist geöffnet: er zählt mit, der Rest bleibt hinter dem Schalter. */
const e = await oeffne(GROSS, { titel: 900214 })
gleich('Film 14 ohne Synchro geöffnet: Filme 14, Fenster 10–14', [e.lage().gruppe[1]!.zahl, e.lage().gruppe[1]!.zeilen], [14, [10, 11, 12, 13, 14]])
zahlGleichListe('Film 14 geöffnet', e.lage())
await e.ende()

/* Suche: alle Treffer, auch hinter dem Schalter, alle Gruppen offen, kein Fenster. */
const f = await oeffne(GROSS, { titel: 900207, suche: 'film 1' })
gleich('Suche „film 1“: nur Filme, 1 und 10–15', [kurz(f.lage()), f.lage().gruppe[0]?.zeilen], [[['Filme', 7, 7]], [1, 10, 11, 12, 13, 14, 15]])
zahlGleichListe('Suche', f.lage())
await f.zeige({ titel: 900207, suche: 'zzzz' })
gleich('Suche ohne Treffer: keine Gruppe, keine Kopfzahl', [f.lage().gruppe.length, f.lage().kopfZahl], [0, null])
pruefe('Suche ohne Treffer: Hinweis', (f.text() ?? '').includes('Kein Teil passt'))
await f.ende()

/* Kleine Reihe (12 Filme) bleibt Spur — Gegenprobe zur Grenze; die Spur misst im Browser, darum hier statisch. */
const klein = renderToStaticMarkup(h(ReihenListe, props([teil(900101, 'Reihe'), ...filme(12)], { titel: 900101 })))
pruefe('12 Filme: Spur, keine Übersicht', klein.includes('role="tab"') && !klein.includes('data-reihe-uebersicht'))

if (verletzt > 0) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\ncheck-reihen-uebersicht: Fenster, Grenze 12, Zahl = Liste (Kopf, Gruppen, Schalter, Suche), Aufklappen, Alle zeigen mit Fokus ✓')
