import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { ROOT } from './util.ts'

/**
 * **Telekom-Shop-Wege „über TMDB", deren Ziel von Hand als falsch belegt ist** (`data/shop-wege-falsches-ziel.yaml`).
 *
 * Daniel am 31.10.2026 an „Princess Principal: Crown Handler 3": maxdome und freenet meinVOD („über TMDB") führten über TMDB und
 * JustWatch zur Seite von Chapter 2; maxdome führt nur Chapter 1 und 2. TMDB nennt für alle Kapitel dieselbe Anbieterliste.
 * Verworfen wird nur, was die Liste mit Beleg nennt — nie über den Namen geraten (Dirigent, 31.10.2026: gestrichen wird nur, was eine
 * Quelle widerlegt). Direkte Adressen (JustWatch, Handpflege) bleiben.
 */
export type ShopWegFalsch = { anilistId: number; title: string; anbieter: string[]; beleg: string; belegtAm: string }

/** Lädt die Handliste; ein Eintrag ohne Kennung, Anbieter, Beleg oder Datum zählt nicht. */
export function ladeShopWegeFalsch(datei = resolve(ROOT, 'data/shop-wege-falsches-ziel.yaml')): ShopWegFalsch[] {
  const roh = (yaml.load(readFileSync(datei, 'utf8')) as ShopWegFalsch[] | null) ?? []
  return roh.filter((e) => e?.anilistId && e.anbieter?.length && e.beleg && e.belegtAm)
}

/** Ein verworfener Weg: für Log und Zählung. */
export type VerworfenerKapitelWeg = { id: number; name: string; weg: string }

const istTmdbWeg = (url: string): boolean => /themoviedb\.org/.test(url)

/** Entfernt die „über TMDB"-Wege, die die Liste für den Titel und den Anbieter nennt, und nennt sie. */
export function entferneKapitelShopWege(titles: Iterable<Title>, liste: ShopWegFalsch[]): VerworfenerKapitelWeg[] {
  const weg: VerworfenerKapitelWeg[] = []
  for (const t of titles) {
    const anbieter = liste.filter((e) => e.anilistId === t.id).flatMap((e) => e.anbieter.map((a) => a.toLowerCase()))
    if (!anbieter.length || !t.watchLinks?.length) continue
    t.watchLinks = t.watchLinks.filter((w) => {
      if (!istTmdbWeg(w.url) || !anbieter.includes(w.name.toLowerCase())) return true
      weg.push({ id: t.id, name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? '?', weg: w.name })
      return false
    })
  }
  return weg
}
