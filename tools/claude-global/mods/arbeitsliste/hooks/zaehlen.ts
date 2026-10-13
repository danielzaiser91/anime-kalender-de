export type Groesse = 'gross' | 'normal' | 'klein'
// Ein Verweis aus der Zeile: href als https:// oder file:///C:/…, pfad als URL bzw. absoluter Windows-Pfad zum Öffnen.
export type Verweis = { label: string; href: string; pfad: string }
export type Eintrag = { titel: string; rest: string; groesse: Groesse; links: Verweis[] }
export type Liste = { inArbeit: Eintrag[]; todo: Eintrag[] }

// Konvention: der fette Titel in stand.md ist der Kurztitel.
export const KURZTITEL_MAX = 36

// Zeilen mit "- " bis zur nächsten "## "-Überschrift, je Abschnitt; der autonome Modus
// hat seine eigene Statuszeile und zählt deshalb nicht als Eintrag.
export function zaehle(text: string): Liste {
  const liste: Liste = { inArbeit: [], todo: [] }
  let ziel: Eintrag[] | null = null

  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) {
      ziel = zeile.startsWith('## In Arbeit')
        ? liste.inArbeit
        : zeile.startsWith('## Als Nächstes (Todo)')
          ? liste.todo
          : null
    } else if (ziel && zeile.startsWith('- ')) {
      const eintrag = kurzMitMarke(zeile.slice(2))
      if (!/^autonomer modus\b/i.test(eintrag.titel)) ziel.push(eintrag)
    }
  }

  return liste
}

export type Icon = 'kalender' | 'wartet' | 'blockiert'
export type Zeitpunkt = { tag?: { tag: number; monat: number }; std: number; min: number }
// Dringlichkeit eines Jetzt-Eintrags: 🔴 dringend (blockiert Arbeit / live falsch), 🟠 heute (ohne Marke), 🔵 wenn Zeit ist.
export type Dringlichkeit = 'dringend' | 'heute' | 'bald'
export type DanielEintrag = Eintrag & { icon?: Icon; dringlichkeit?: Dringlichkeit; zeit?: Zeitpunkt; faellig?: boolean }
export type DanielTodo = { jetzt: DanielEintrag[]; spaeter: DanielEintrag[] }

const ICONS: Record<string, Icon> = { '📅': 'kalender', '⏳': 'wartet', '🚫': 'blockiert' }
const DRINGLICHKEITEN: Record<string, Dringlichkeit> = { '🔴': 'dringend', '🟠': 'heute', '🔵': 'bald' }

// „Daniel-Todo“: Zeilen „- “ unter „## Daniel-Todo“, geteilt durch „### Jetzt“ / „### Später“
// (ohne Unterüberschrift: Jetzt). In Jetzt steht nach „- “ 🔴 / 🟠 / 🔵 (ohne Marke: heute), in Später
// 📅 / ⏳ / 🚫; bei 📅 beginnt der Titel mit „HH:MM“ oder „TT.MM. HH:MM“. Keine Nummern.
export function zaehleVonDir(text: string): DanielTodo {
  const ergebnis: DanielTodo = { jetzt: [], spaeter: [] }
  let drin = false
  let ziel = ergebnis.jetzt

  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) {
      drin = zeile.startsWith('## Daniel-Todo')
      ziel = ergebnis.jetzt
    } else if (drin && zeile.startsWith('### ')) {
      ziel = /^### Sp(ä|ae)ter/.test(zeile) ? ergebnis.spaeter : ergebnis.jetzt
    } else if (drin) {
      if (zeile.startsWith('- ')) {
        const eintrag = danielEintrag(zeile.slice(2))
        if (ziel === ergebnis.jetzt) eintrag.dringlichkeit ??= 'heute'
        ziel.push(eintrag)
      }
    }
  }

  return ergebnis
}

function danielEintrag(roh: string): DanielEintrag {
  const i = /^(📅|⏳|🚫|🔴|🟠|🔵)\s*/u.exec(roh)
  const eintrag: DanielEintrag = kurzMitMarke(i ? roh.slice(i[0].length) : roh)
  if (!i) return eintrag
  const dringlichkeit = DRINGLICHKEITEN[i[1]!]
  if (dringlichkeit) {
    eintrag.dringlichkeit = dringlichkeit
    return eintrag
  }
  eintrag.icon = ICONS[i[1]!]
  const z = eintrag.icon === 'kalender' ? /^(?:(\d{1,2})\.(\d{1,2})\. )?(\d{1,2}):(\d{2})\b/.exec(eintrag.titel) : null
  if (z) {
    eintrag.zeit = { std: Number(z[3]), min: Number(z[4]) }
    if (z[1]) eintrag.zeit.tag = { tag: Number(z[1]), monat: Number(z[2]) }
  }
  return eintrag
}

// Zeitpunkt eines 📅-Eintrags als Millisekunden (ohne Datum: heute, im Jahr von „jetzt“).
function zeitMs(z: Zeitpunkt, jetzt: Date): number {
  const d = new Date(jetzt)
  if (z.tag) d.setMonth(z.tag.monat - 1, z.tag.tag)
  d.setHours(z.std, z.min, 0, 0)
  return d.getTime()
}

// Fällige 📅-Einträge (Zeit erreicht) wandern von Später nach Jetzt, markiert; in Später stehen
// 📅 nach Zeit aufsteigend zuerst, danach ⏳/🚫 in Dateireihenfolge.
export function teile(todo: DanielTodo, jetzt: Date): DanielTodo {
  const nachZeit = (a: DanielEintrag, b: DanielEintrag) => zeitMs(a.zeit!, jetzt) - zeitMs(b.zeit!, jetzt)
  const faellig = todo.spaeter.filter(e => e.zeit && zeitMs(e.zeit, jetzt) <= jetzt.getTime()).sort(nachZeit)
  const bleibt = todo.spaeter.filter(e => !faellig.includes(e))
  return {
    jetzt: [...todo.jetzt, ...faellig.map(e => ({ ...e, faellig: true, dringlichkeit: 'heute' as const }))],
    spaeter: [...bleibt.filter(e => e.zeit).sort(nachZeit), ...bleibt.filter(e => !e.zeit)],
  }
}

// Markdown weg (**fett**, `code`, [Text](Ziel)), dann am ersten „ — “, „: “ oder Satzende
// trennen — ein Vorsatz unter 20 Zeichen („Fahrplan 1:“) bleibt am Titel.
export function klartext(roh: string): string {
  return roh
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function kurz(roh: string): Eintrag {
  const klar = klartext(roh)

  let schnitt = klar.length
  for (const muster of [/ — /g, /: /g, /\. (?=[A-ZÄÖÜ„])/g]) {
    for (const treffer of klar.matchAll(muster)) {
      if (treffer.index >= 20 && treffer.index < schnitt) schnitt = treffer.index
    }
  }

  const titel = klar.slice(0, schnitt).replace(/[.;,:]+$/, '')
  const rest = klar.slice(schnitt).replace(/^( — |: |\. )/, '').trim()
  return { titel, rest, groesse: 'normal', links: [] }
}

// Relative Ziele in stand.md gelten gegen diesen Ordner.
export const BASIS_DIR = 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/'

// Datei-URL → Windows-Pfad („file:///C:/a%20b“ → „C:\a b“).
function fileUrlZuPfad(url: string): string {
  let p = url.replace(/^file:\/\/\//i, '')
  try { p = decodeURIComponent(p) } catch { /* unverändert */ }
  return p.replace(/\//g, '\\')
}

// Ziel aus stand.md → klickbarer href und Pfad zum Öffnen; Dateien immer absolut, URLs unverändert.
// Ohne Ziel (Anker „#…“, leer) null. Bei https bleibt der Teil nach „#“ (die Seite routet über den Hash), bei Dateien fällt er weg.
export function loeseZiel(ziel: string): { href: string; pfad: string } | null {
  const roh = ziel.trim()
  const z = /^https?:\/\//i.test(roh) ? roh : roh.replace(/#.*$/, '')
  if (!z) return null
  if (/^https?:\/\//i.test(z)) return { href: z, pfad: z }
  let pfad: string
  if (/^file:\/\/\//i.test(z)) pfad = fileUrlZuPfad(z)
  else if (/^[A-Za-z]:[\\/]/.test(z)) pfad = z.replace(/\//g, '\\')
  else pfad = (BASIS_DIR + z.replace(/^\.\//, '')).replace(/\//g, '\\')
  const href = 'file:///' + pfad.replace(/\\/g, '/').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')
  return { href, pfad }
}

const NACKT = /https?:\/\/[^\s)\]>"'`]+|\b[A-Za-z]:[\\/][^\s)\]>"'`,;]*/g

// Alle Verweise einer Zeile: Markdown-Links [Text](Ziel), danach nackte URLs und Pfade (C:\… / C:/…);
// gleiche Ziele nur einmal.
export function extrahiereLinks(roh: string): Verweis[] {
  const aus: Verweis[] = []
  const neu = (label: string, ziel: string) => {
    const l = loeseZiel(ziel)
    if (l && !aus.some(v => v.href === l.href)) aus.push({ label, ...l })
  }
  const rest = roh.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, text: string, ziel: string) => {
    neu(text.trim(), ziel)
    return ' '
  })
  for (const m of rest.matchAll(NACKT)) {
    const ziel = m[0].replace(/[.,;:!?]+$/, '')
    neu(ziel.replace(/^https?:\/\/(www\.)?/i, '').replace(/^.*[\\/](?=[^\\/]+$)/, ''), ziel)
  }
  return aus
}

// Größenmarke am Zeilenanfang („[groß] “ / „[klein] “); ohne Marke ist der Eintrag normal.
export function kurzMitMarke(roh: string): Eintrag {
  const treffer = /^\[(groß|klein)\]\s*/.exec(roh)
  const eintrag = kurz(treffer ? roh.slice(treffer[0].length) : roh)
  if (treffer) eintrag.groesse = treffer[1] === 'groß' ? 'gross' : 'klein'
  const ohneMarke = treffer ? roh.slice(treffer[0].length) : roh
  eintrag.links = extrahiereLinks(ohneMarke)
  return eintrag
}

const RANG: Record<Groesse, number> = { gross: 0, normal: 1, klein: 2 }

// Große zuerst, kleine zuletzt; innerhalb einer Gruppe bleibt die Reihenfolge der Datei.
export function sortiere(eintraege: Eintrag[]): Eintrag[] {
  return eintraege
    .map((e, i) => ({ e, i }))
    .sort((a, b) => RANG[a.e.groesse] - RANG[b.e.groesse] || a.i - b.i)
    .map(x => x.e)
}

const DRINGLICH_RANG: Record<Dringlichkeit, number> = { dringend: 0, heute: 1, bald: 2 }

// Jetzt: nach Dringlichkeit, darin groß vor normal vor klein; sonst Reihenfolge der Datei.
export function sortiereJetzt(eintraege: DanielEintrag[]): DanielEintrag[] {
  const rang = (e: DanielEintrag) => DRINGLICH_RANG[e.dringlichkeit ?? 'heute']
  return eintraege
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rang(a.e) - rang(b.e) || RANG[a.e.groesse] - RANG[b.e.groesse] || a.i - b.i)
    .map(x => x.e)
}

// Titel über dem Kurztitel-Limit.
export function zuLang(liste: Liste, vonDir: Eintrag[]): number {
  const titel = [...liste.inArbeit, ...liste.todo].map(e => e.titel)
  for (const e of vonDir) titel.push(e.titel)
  return titel.filter(t => t.length > KURZTITEL_MAX).length
}

export type LiveEintrag = Eintrag & { zeit: number }

// Einträge verschwinden nach 2 Tagen (Daniel, 10.10.2026).
export const LIVE_TAGE = 2

// „## Neu und live testbar“: Zeilen „- [JJJJ-MM-TT HH:MM] Kurztext — [Link](https://…)“ (Ortszeit).
// Zeitstempel nicht lesbar oder älter als LIVE_TAGE: nicht anzeigen; neueste zuerst.
export function zaehleLive(text: string, jetzt: Date): LiveEintrag[] {
  const aus: LiveEintrag[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## Neu und live testbar')
    else if (drin) {
      const m = /^- \[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\]\s*(.+)/.exec(zeile)
      if (!m) continue
      const zeit = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!).getTime()
      const d = new Date(zeit)
      if (d.getMonth() !== +m[2]! - 1 || d.getDate() !== +m[3]! || d.getHours() !== +m[4]! || jetzt.getTime() - zeit > LIVE_TAGE * 86_400_000) continue
      aus.push({ ...kurzMitMarke(m[6]!), zeit })
    }
  }
  return aus.sort((a, b) => b.zeit - a.zeit)
}

export const ORTE = ['pipeline', 'worker', 'warteliste', 'deploy'] as const
export type Ort = (typeof ORTE)[number] | '?'
export type PipelineEintrag = Eintrag & { zeit: number; ort: Ort }

// „## In Pipeline“: gemergt, noch nicht live. Zeilen „- [JJJJ-MM-TT HH:MM] **Kurztext** — Ort: <ort> (Details)“
// (Zeit = Merge, Ortszeit). Ort außerhalb von ORTE → „?“. Kein Ablauf nach Zeit; die Hauptsitzung löscht die
// Zeile, sobald live gemessen. Älteste zuerst; Zeitstempel nicht lesbar: nicht anzeigen.
export function zaehlePipeline(text: string): PipelineEintrag[] {
  const aus: PipelineEintrag[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## In Pipeline')
    else if (drin) {
      const m = /^- \[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\]\s*(.+)/.exec(zeile)
      if (!m) continue
      const zeit = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!).getTime()
      const d = new Date(zeit)
      if (d.getMonth() !== +m[2]! - 1 || d.getDate() !== +m[3]! || d.getHours() !== +m[4]!) continue
      const roh = m[6]!
      const o = /\bOrt:\s*([\p{L}]+)\s*(?:\(([^)]*)\))?/iu.exec(roh)
      const wort = o?.[1]?.toLowerCase()
      const ort = ORTE.find(x => x === wort) ?? '?'
      const eintrag = kurzMitMarke(roh.replace(/\s*—\s*Ort:.*$/u, ''))
      aus.push({ ...eintrag, rest: o?.[2]?.trim() ?? '', zeit, ort })
    }
  }
  return aus.sort((a, b) => a.zeit - b.zeit)
}

export function kuerze(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

// Jeder Bereich im Pane zeigt höchstens so viele Einträge; der Rest steht hinter „+ N weitere“.
export const SICHTBAR_MAX = 5

export type Schnitt<T> = { sichtbar: T[]; versteckt: number; kuerzbar: boolean; offen: boolean }

// `aufgeklappt`: Kennungen der Bereiche (und Kleinigkeiten), die ausgeklappt sind.
// `max` 0: die Gruppe ist zu, bis sie aufgeklappt wird (Kleinigkeiten).
export function schneide<T>(liste: T[], id: string, aufgeklappt: string[], max = SICHTBAR_MAX): Schnitt<T> {
  const offen = aufgeklappt.includes(id)
  const kuerzbar = liste.length > max
  return { sichtbar: offen || !kuerzbar ? liste : liste.slice(0, max), versteckt: Math.max(0, liste.length - max), kuerzbar, offen }
}

export function schalte(aufgeklappt: string[], id: string): string[] {
  return aufgeklappt.includes(id) ? aufgeklappt.filter(x => x !== id) : [...aufgeklappt, id]
}
