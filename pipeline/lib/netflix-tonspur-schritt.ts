/**
 * Der Schritt „Netflix-Filme: Tonspur lesen und melden“ am Ende von `pipeline/check-links.ts`:
 * wählt die offenen Filme, liest ihre Titelseiten und hängt die Ja als Handbeleg an `data/dub-confirmed.yaml`
 * (derselbe Schreibweg wie die Browser-Meldungen, `haengeBelegeAn`).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { ladeHandbelege } from './dub-confirmed.ts'
import { haengeBelegeAn } from './belege-anhaengen.ts'
import { ROOT } from './util.ts'
import {
  WIEDERHOLUNG_TAGE,
  erneutSeit,
  leseNetflixFilme,
  waehleNetflixFilme,
  type TonspurBefund,
  type TonspurLaufErgebnis,
} from './netflix-tonspur-lauf.ts'

/** Ein ehrlicher Abruf: dieselbe Kennung wie die Linkprüfung, deutsche Fassung der Seite. */
export async function holeNetflixTitelseite(url: string): Promise<{ status: number; text: string }> {
  const kennung = /\/title\/(\d+)/.exec(url)?.[1]
  const res = await fetch(`https://www.netflix.com/de/title/${kennung}`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'anime-kalender.de/1.0 (+https://anime-kalender.de; kontakt@anime-kalender.de)',
      'Accept-Language': 'de-DE,de;q=0.9',
    },
  })
  return { status: res.status, text: res.status === 200 ? await res.text() : '' }
}

export async function netflixTonspurSchritt(o: {
  titles: Title[]
  bestand: Record<string, TonspurBefund | undefined>
  heute: string
  hole?: (url: string) => Promise<{ status: number; text: string }>
  pause: () => Promise<void>
  weiter: () => boolean
  log: (t: string) => void
  warn: (t: string) => void
}): Promise<TonspurLaufErgebnis> {
  const erneutDatei = resolve(ROOT, 'data/erneut-melden.yaml')
  const erneut = existsSync(erneutDatei) ? (yaml.load(readFileSync(erneutDatei, 'utf8')) as Parameters<typeof erneutSeit>[0]) : []
  const grenze = new Date(Date.parse(`${o.heute}T12:00:00Z`) - WIEDERHOLUNG_TAGE * 86_400_000).toISOString().slice(0, 10)
  const filme = waehleNetflixFilme({
    titles: o.titles,
    checks: ladeHandbelege(),
    erneut: erneutSeit(Array.isArray(erneut) ? erneut : []),
    bestand: o.bestand,
    grenze,
  })
  const erg = await leseNetflixFilme({ filme, bestand: o.bestand, hole: o.hole ?? holeNetflixTitelseite, pause: o.pause, weiter: o.weiter, heute: o.heute })
  o.log(`Netflix-Filme (Tonspur der Titelseite): ${filme.length} offen, ${erg.gelesen} gelesen — ${erg.ja} Deutsch, ${erg.nein} ohne Deutsch, ${erg.unbekannt} unbekannt${erg.gesperrt ? ', Netflix sperrt (403/429) — Rest nächste Woche' : ''}`)
  if (erg.zeilen.length) haengeBelegeAn({ datei: resolve(ROOT, 'data/dub-confirmed.yaml'), zeilen: erg.zeilen, heute: o.heute, log: o.log, warn: o.warn })
  return erg
}
