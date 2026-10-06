import type { Release, Title } from '../../shared/types.ts'

/**
 * **Die leise Zeile unter „Erstmals mit deutscher Synchro"** (Daniel, 06.10.2026, Vorschlag A): wann es losgeht, in welchem Takt und
 * wie weit die deutsche Fassung hinter Japan liegt — „ab 04.10. · sonntags wöchentlich · zeitgleich mit der japanischen Fassung".
 *
 * „Simuldub" heißt: die Synchro erscheint zur Japan-Ausstrahlung. Läuft sie Wochen später, steht „n Wochen nach der japanischen
 * Fassung". Den japanischen Start nimmt der Bau vom AniList-Eintrag (`jpStartTag`); fehlt er, entfällt nur dieser Teil. Bei Titeln,
 * deren deutscher Start lange zurückliegt (Katalog, Disc), gibt es keine Zeile — dort ist der Abstand zu Japan keine Auskunft.
 */
const TAGE = ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags']
const FENSTER_TAGE = 120

const tagesDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000)

export function neuZeile(t: Pick<Title, 'jpStartTag'>, r: Pick<Release, 'releaseType' | 'schedule'> | undefined, heute: string): string | undefined {
  const tag = r?.schedule?.firstEpisodeDate
  if (!r || !tag || (r.releaseType !== 'weekly' && r.releaseType !== 'batch')) return undefined
  if (tagesDiff(heute, tag) > FENSTER_TAGE) return undefined
  const teile = [`ab ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`]
  if (r.releaseType === 'weekly') teile.push(`${TAGE[new Date(`${tag}T12:00:00Z`).getUTCDay()]} wöchentlich`)
  else if (r.schedule?.episodeCount && !r.schedule.episodeCountAssumed) teile.push(`alle ${r.schedule.episodeCount} Folgen auf einmal`)
  if (t.jpStartTag) {
    const abstand = tagesDiff(tag, t.jpStartTag)
    if (Math.abs(abstand) <= 2) teile.push('zeitgleich mit der japanischen Fassung')
    else if (abstand > 2 && abstand <= FENSTER_TAGE) {
      const wochen = Math.max(1, Math.round(abstand / 7))
      teile.push(`${wochen} ${wochen === 1 ? 'Woche' : 'Wochen'} nach der japanischen Fassung`)
    }
  }
  return teile.join(' · ')
}

/**
 * **„Nach 14 Jahren endlich …"** (Daniel, 06.10.2026, an Kamisama Kiss): Liegt der japanische Start mindestens fünf Jahre zurück, nennt die
 * Meldung die Jahre und freut sich mit. Gab es die deutsche Fassung schon vorher auf Disc oder im TV (aniSearch, `deErstausgabe` mit
 * Synchro, mindestens drei Monate früher), heißt es „endlich im Stream" und die Dauer steht dabei.
 */
export function neuJahre(t: Pick<Title, 'jpYear' | 'deErstausgabe'>, tag: string): { jahre?: number; discSeitText?: string } {
  const jahre = t.jpYear ? Number(tag.slice(0, 4)) - t.jpYear : 0
  if (jahre < 5) return {}
  const von = t.deErstausgabe?.synchro && t.deErstausgabe.von
  const tage = von ? tagesDiff(tag, von) : 0
  if (!von || tage < 90) return { jahre }
  const monate = Math.round(tage / 30.4)
  return { jahre, discSeitText: monate < 24 ? `${monate} Monaten` : `${Math.floor(monate / 12)} Jahren` }
}
