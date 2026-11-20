// Ziele-Kasten (Daniel, 20.11.2026): je Ziel ein Ordner `ziele/<n>-<slug>/` mit `plan.md`; Status der Aufgaben nur dort.
// plan.md: `# <Name> — Gesamtplan`, optional `**Kennzahl:** <Wert> — …`, Abschnitte `## Aufgaben` und `## Meilensteine`
// (beide mit `- [status] …`, deshalb nach Abschnitt geparst).
import type { ZielPlan, ZielAufgabe } from '../types'
export type { ZielPlan, ZielAufgabe }

const AUFGABE = /^- \[(aktiv|bald|geplant|erledigt)\]\s+(.+?)(?:\s+—\s+(.*))?$/
const MEILENSTEIN = /^- \[(erreicht|in Arbeit|offen)\]/
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/

// Aufgaben-Link relativ zum Planordner wird absolut, damit der Knopf die Datei öffnen kann.
function aufgabe(m: RegExpExecArray, ordner: string): ZielAufgabe {
  const link = LINK.exec(m[3] ?? '')?.[1]
  const datei = link ? `${ordner}/${link.replace(/^\.\//, '')}` : null
  return { status: m[1] as ZielAufgabe['status'], titel: m[2]!.replace(/\*\*/g, ''), datei }
}

export function leseZielPlan(text: string, ordner: string): ZielPlan {
  const z: ZielPlan = { name: '', kennzahl: null, erreicht: 0, gesamt: 0, aufgaben: [], plan: `${ordner}/plan.md` }
  let abschnitt = ''
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('# ') && !z.name) z.name = zeile.slice(2).split(' — ')[0]!.trim()
    else if (zeile.startsWith('## ')) abschnitt = zeile.slice(3).trim()
    else if (zeile.startsWith('**Kennzahl:**') && z.kennzahl === null) z.kennzahl = zeile.slice(13).split(' — ')[0]!.trim()
    else if (abschnitt === 'Aufgaben') {
      const m = AUFGABE.exec(zeile)
      if (m) z.aufgaben.push(aufgabe(m, ordner))
    } else if (abschnitt === 'Meilensteine') {
      const m = MEILENSTEIN.exec(zeile)
      if (!m) continue
      z.gesamt++
      if (m[1] === 'erreicht') z.erreicht++
    }
  }
  return z
}

const erste = (z: ZielPlan, status: ZielAufgabe['status']) => z.aufgaben.find(a => a.status === status)

// Knopf unter dem Ziel: erste aktive, sonst erste baldige, sonst erste geplante Aufgabe.
export const naechsteAufgabe = (z: ZielPlan): ZielAufgabe | null => erste(z, 'aktiv') ?? erste(z, 'bald') ?? erste(z, 'geplant') ?? null

// Kugel: grün bei aktiver Aufgabe, gelb bei baldiger, sonst grau (null = dimColor).
export const kugelFarbe = (z: ZielPlan): 'success' | 'warning' | null => (erste(z, 'aktiv') ? 'success' : erste(z, 'bald') ? 'warning' : null)

// Nie ein Prozentwert aus Meilensteinen: Daniel las 33 % als Datenabdeckung (20.11.2026).
export const kennzahlText = (z: ZielPlan): string => z.kennzahl ?? `${z.erreicht} von ${z.gesamt} Meilensteinen`

type Dateien = { list: (p: string) => Promise<{ name: string; kind: string }[]>; read: (p: string) => Promise<string> }

// Ordner nach Namen sortiert; ein Ordner ohne lesbares plan.md wird übersprungen, ein fehlender Zielordner ergibt keine Ziele.
export async function ladeZiele(d: Dateien, wurzel: string): Promise<ZielPlan[]> {
  const eintraege = await d.list(wurzel).catch(() => [])
  const ordner = eintraege.filter(e => e.kind === 'dir').map(e => e.name).sort()
  const plaene = await Promise.all(
    ordner.map(n =>
      d.read(`${wurzel}/${n}/plan.md`).then(
        t => leseZielPlan(t, `${wurzel}/${n}`),
        () => null,
      ),
    ),
  )
  return plaene.filter((p): p is ZielPlan => p !== null)
}
