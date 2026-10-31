import { omuZeile } from '@shared/ankuendigung.ts'
import { formatDate } from '@shared/time.ts'
import { PLATFORMS, type Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import { Stern } from './aktionen.tsx'
import { GlockeZeichen, PanelKarte } from './panel-karte.tsx'

type Ankuendigung = NonNullable<Title['ankuendigung']>

const LEISE = 'text-t4 text-ak-leise'
const LINK = 'underline decoration-dotted underline-offset-2 hover:text-ak-text'
const KNOPF = 'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-t3 font-semibold text-ak-text transition hover:bg-ak-flaeche-2'

/** Die Quelle, die die Synchro nennt: der Artikel über deutsche Synchros, sonst die erste. */
export const synchroQuelle = (a: Ankuendigung): string | undefined => a.quellen.find((q) => /synchro/i.test(q)) ?? a.quellen[0]

function AnbieterLink({ name, url }: { name: string; url: string | undefined }) {
  if (!url) return <>{name}</>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK}>
      {name}
    </a>
  )
}

function BescheidKnopf({ gemerkt, onToggle, verbindung, t }: { gemerkt: boolean; onToggle: () => void; verbindung: NewsletterVerbindung; t: Translate }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        aria-pressed={gemerkt}
        onClick={onToggle}
        className={`${KNOPF} ${gemerkt ? 'border-ak-favorit-rand text-ak-favorit-text' : 'border-ak-rand'}`}
      >
        <Stern gefuellt={gemerkt} />
        {t(gemerkt ? 'kopf.gemerkt' : 'termin.bescheid')}
      </button>
      {gemerkt && <p className="text-t4 font-semibold text-ak-favorit-text">{t(verbindung.verbunden ? 'termin.bescheidMail' : 'termin.bescheidOffen')}</p>}
    </div>
  )
}

/** Eine eigene Karte unter dem Kasten: Anbieter (Link zur Serie), Stand mit Quelle, Start mit Untertiteln und der Knopf, der wie das ☆ im Kopf merkt. */
export function TerminOffenKarte({ title, ankuendigung: a, gemerkt, onToggleFavorite, verbindung, t }: {
  title: Title
  ankuendigung: Ankuendigung
  gemerkt: boolean
  onToggleFavorite: (id: number) => void
  verbindung: NewsletterVerbindung
  t: Translate
}) {
  const anbieter = PLATFORMS[a.platform]?.name ?? a.platform
  const omu = omuZeile(a, t as never)
  const quelle = synchroQuelle(a)
  return (
    <PanelKarte symbol={<GlockeZeichen />} titel={t('termin.titel')} akzent="akzent">
      <div className="flex flex-col gap-2">
        <p className="text-t3 text-ak-text">
          <AnbieterLink name={anbieter} url={title.streams.find((s) => s.platform === a.platform)?.url} /> {t('termin.angekuendigt')}
        </p>
        <p className={LEISE}>
          {t('detail.stand', { datum: formatDate(a.stand) })}
          {quelle && (
            <>
              {' · '}
              <a href={quelle} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center ${LINK}`}>
                {t('termin.quelle')} <span aria-hidden="true">↗</span>
              </a>
            </>
          )}
        </p>
        <p className={LEISE}>{omu.charAt(0).toUpperCase() + omu.slice(1)}.</p>
        <BescheidKnopf gemerkt={gemerkt} onToggle={() => onToggleFavorite(title.id)} verbindung={verbindung} t={t} />
      </div>
    </PanelKarte>
  )
}

/** Der Weg beim Anbieter der Ankündigung steht in der Karte (als Link); unter „Weitere Anbieter“ entfällt seine Pille. */
export const ohneAnkuendigungsWeg = <G extends { plattformen: { platform: string }[] }>(gruppen: G[], a: Ankuendigung | undefined): G[] =>
  a ? gruppen.map((g) => ({ ...g, plattformen: g.plattformen.filter((s) => s.platform !== a.platform) })) : gruppen
