/**
 * **Steht im ausgelieferten Datensatz eine Adresse, die die Linkprüfung als tot kennt?**
 *
 * Der Bau entfernt tote Verweise an einer Stelle — und legt sie an mehreren wieder an.
 * Am 17.09.2026 waren es zwei: die Ergänzung aus Handbelegen und die aus den gemeldeten
 * Rohfolgen. Beide hatten denselben Grund („die Adresse steht ja im Beleg") und
 * denselben Fehler: Ein Beleg sagt, welche Sprache die Seite hatte, nicht ob es sie noch
 * gibt. Bei „Your Name." kam der 404 nach jedem Bau zurück, und aufgefallen ist es nur,
 * weil Daniel ihn angeklickt hat.
 *
 * Eine Prüfung im Quelltext fängt immer nur die Stelle, die man schon kennt. Diese hier
 * fragt das Ergebnis: Führt ein ausgelieferter Weg auf eine Adresse mit belegtem 404 oder
 * einer Regionssperre? Dann ist irgendwo eine Runde dazugekommen, die den Riegel nicht
 * kennt — welche, sagt die Liste.
 *
 * Abgänge (`entfernteStreams`) sind ausgenommen: Sie **sollen** die tote Adresse
 * festhalten, sind nicht anklickbar und tragen ihr Datum.
 *
 * Aufruf: npx tsx pipeline/check-tote-adressen.ts
 */
import { readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'

const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[] | { titles: Title[] }
const titles: Title[] = Array.isArray(roh) ? roh : roh.titles
const befunde = JSON.parse(readFileSync('data/link-check.json', 'utf8')) as Record<
  string,
  { status: number | string; geprueftAm?: string }
>

const tot = (url?: string): boolean => {
  if (!url) return false
  const s = befunde[url]?.status
  return s === 404 || s === 'region'
}

const treffer: string[] = []
for (const t of titles) {
  for (const s of t.streams ?? []) {
    if (tot(s.url)) treffer.push(`${t.id} ${t.titleDe ?? t.titleEn ?? ''} — ${s.platform}: ${s.url}`)
  }
  for (const w of t.watchLinks ?? []) {
    if (tot(w.url)) treffer.push(`${t.id} ${t.titleDe ?? t.titleEn ?? ''} — ${w.name}: ${w.url}`)
  }
}

if (treffer.length) {
  console.error(`${treffer.length} ausgelieferte Adresse(n) sind als tot belegt:`)
  for (const z of treffer.slice(0, 20)) console.error(`  ${z}`)
  if (treffer.length > 20) console.error(`  … und ${treffer.length - 20} weitere`)
  console.error('\nIrgendeine Runde in build.ts legt sie nach dem Entfernen wieder an — dort gehört `lautPruefungTot` davor.')
  process.exit(1)
}
console.log(`Keine tote Adresse im Datensatz (${Object.keys(befunde).length} geprüfte Adressen).`)
