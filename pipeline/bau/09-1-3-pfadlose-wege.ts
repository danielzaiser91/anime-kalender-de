import { log } from '../lib/util.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type Title } from '../../shared/types.ts'

export function reparierePfadloseWege({ alleChecks, titles, crAdresseZu }: {
  alleChecks: DubCheck[]
  titles: Map<number, Title>
  crAdresseZu: (name: string) => string | undefined
}) {
  /** Was am Ende übrig bleibt und niemand automatisch auflösen kann. */
  const suchOffen: { id: number; titel: string; plattform: string; url: string }[] = []
  /** Titel und Anbieter, für die die Suchfrage beantwortet ist — ein Nein oder ein Beleg mit Adresse. */
  const beantworteteSuchen = new Set(
    alleChecks.filter((c) => c.available === false || c.url).map((c) => `${c.anilistId}|${c.platform}`),
  )

  let ohnePfad = 0
  let ohnePfadWeg = 0
  for (const title of titles.values()) {
    if (!title.streams?.length) continue
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
    title.streams = title.streams.filter((stream) => {
      let pfad = ''
      try {
        pfad = new URL(stream.url).pathname
      } catch {
        pfad = ''
      }
      if (pfad !== '' && pfad !== '/') return true
      if (stream.platform === 'crunchyroll' && name) {
        const echte = crAdresseZu(name)
        if (echte) {
          stream.url = echte
          ohnePfad++
          return true
        }
      }
      /*
        **Ins Gedächtnis kommt das nicht**: Es ist kein belegtes Nein, sondern
        eine kaputte Adresse. Taucht dieselbe Serie später mit einer echten
        Adresse auf, soll sie kommen dürfen.
      */
      ohnePfadWeg++
      /*
        **Eine beantwortete Frage kommt nicht wieder** (22.09.2026). Overgeared stand weiter als
        Suchadresse in der Statusanzeige und führte auf Crunchyrolls Startseite, obwohl Daniel am
        20.09. geantwortet hatte: „dort gibt es keine Serienseite" (`available: false`).
      */
      if (!beantworteteSuchen.has(`${title.id}|${stream.platform}`))
        suchOffen.push({ id: title.id, titel: name, plattform: stream.platform, url: stream.url })
      return false
    })
  }
  if (ohnePfad) log(`${ohnePfad} Verweise ohne Pfad über den deutschen Katalog auf ihre Serienadresse gesetzt`)
  if (ohnePfadWeg) log(`${ohnePfadWeg} Verweise ohne Pfad entfernt — eine nackte Domain ist kein Weg zu einem Titel`)
  return { beantworteteSuchen, suchOffen }
}
