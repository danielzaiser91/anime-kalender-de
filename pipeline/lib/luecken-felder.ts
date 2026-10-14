import type { Title } from '../../shared/types.ts'
import { bildDerReihe, grundOhneBanner } from './banner-luecken.ts'
import type { Feld, Kontext } from './luecken-rahmen.ts'

/** Eine kleine Prüfung je Feld des Detail-Panels. Pflichtfelder zuerst, danach die bedingten (nur zur Information). */
const hatBanner = (t: Title, k: Kontext): boolean => Boolean(k.banner[String(t.id)]?.p)

const hatWeg = (t: Title): boolean =>
  (t.streams?.length ?? 0) > 0 || (t.watchLinks?.length ?? 0) > 0 || Boolean(t.deErstausgabe)

const hatTermin = (t: Title, k: Kontext): boolean => k.tage.has(t.id)

function bannerHinweis(t: Title, k: Kontext): string {
  const uebergang = t.bannerImage?.includes('anilist.co') ? 'AniList-Banner steht (Übergang)' : 'keins'
  return `${uebergang}; ${bildDerReihe(t, k.alle, k.banner)}`
}

function handlungGrund(t: Title, k: Kontext): string | undefined {
  const s = k.synopsen[t.id]
  if (s?.de) return undefined
  return s?.en ? 'nur englisch' : 'keine Handlung'
}

function belegGrund(t: Title, k: Kontext): string | undefined {
  const b = k.belege.get(t.id)
  if (b && b.mitBild > 0) return undefined
  return b && b.quellen > 0 ? 'Quelle ohne Bild' : 'Termin ohne Quelle'
}

export const FELDER: Feld[] = [
  { datei: 'cover-sd.md', name: 'Cover SD', pflicht: true, fehlt: (t) => (t.coverImage ? undefined : 'kein Cover') },
  {
    datei: 'cover-hq.md',
    name: 'Cover HQ',
    pflicht: true,
    fehlt: (t, k) => (k.synopsen[t.id]?.cg ? undefined : (k.hqGrund.get(t.id) ?? 'ohne Angabe')),
  },
  {
    datei: 'banner.md',
    name: 'Banner (TMDB)',
    pflicht: true,
    fehlt: (t, k) => (hatBanner(t, k) ? undefined : grundOhneBanner(t.id, k.banner, k.zuordnung)),
    hinweis: bannerHinweis,
  },
  { datei: 'titel-de.md', name: 'Deutscher Titel', pflicht: true, fehlt: (t) => (t.titleDe ? undefined : 'kein deutscher Titel') },
  { datei: 'handlung-de.md', name: 'Handlung deutsch', pflicht: true, fehlt: handlungGrund },
  { datei: 'studio.md', name: 'Studio', pflicht: true, fehlt: (t) => (t.studios?.length ? undefined : 'kein Studio') },
  { datei: 'jahr.md', name: 'Jahr', pflicht: true, fehlt: (t) => (t.jpYear ? undefined : 'kein Jahr') },
  { datei: 'folgenzahl.md', name: 'Folgenzahl', pflicht: true, fehlt: (t) => (t.episodes ? undefined : 'keine Folgenzahl') },
  { datei: 'bezugsweg.md', name: 'Bezugsweg', pflicht: true, fehlt: (t) => (hatWeg(t) ? undefined : 'kein Stream, Kaufweg oder Disc') },
  { datei: 'beleg-bild.md', name: 'Quellenbeleg mit Bild', pflicht: true, gilt: hatTermin, fehlt: belegGrund },
  { datei: 'sprecher.md', name: 'Sprecher', pflicht: false, fehlt: (t) => (t.hasVoices ? undefined : 'keine Sprecher') },
  { datei: 'trailer.md', name: 'Trailer', pflicht: false, fehlt: (t) => (t.trailer ? undefined : 'kein Trailer') },
  { datei: 'fsk.md', name: 'FSK', pflicht: false, fehlt: (t) => (t.fsk == null ? 'keine FSK' : undefined) },
  { datei: 'bewertung.md', name: 'Bewertung', pflicht: false, fehlt: (t) => (t.score == null ? 'keine Bewertung' : undefined) },
  {
    datei: 'schlagworte.md',
    name: 'Schlagworte',
    pflicht: false,
    fehlt: (t) => ((t.genres?.length ?? 0) + (t.keywords?.length ?? 0) > 0 ? undefined : 'keine Schlagworte'),
  },
]
