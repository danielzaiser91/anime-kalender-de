import { ShareIcon } from './hilfen.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { HideEye, FavoriteStar, ReihenStern } from '../ui.tsx'
import { FORMAT_DE } from '@shared/mappings.ts'
import { jpAngabe } from './kino.tsx'
import { WeitereTitel } from './weitere.tsx'
import { type Title, type FranchiseMember } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'

export function PanelBuehne({ reihenName, buehnenBild, title, onToggleHidden, favorites, onToggleFavorite, reihenIds, onClose, t, unterzeile, eigenerTeil }: {
  reihenName: string
  buehnenBild: string | undefined
  title: Title
  onToggleHidden: (id: number) => void
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
  reihenIds: number[]
  onClose: () => void
  t: Translate
  unterzeile: (string | undefined)[]
  eigenerTeil: FranchiseMember | undefined
}) {
  return (
    <>
      <div className="relative shrink-0" style={{ isolation: 'isolate' }}>
        <h2
          title={reihenName}
          className="line-clamp-2 px-4 pb-2 pt-1 text-lg font-semibold leading-tight text-slate-900 dark:text-white"
        >
          {reihenName}
        </h2>

        {/*
          **410 px, und der Ausschnitt sitzt tief.**

          Daniel am 03.09.2026, in zwei Schritten: erst „cover height: 210 ->
          410px; background-position: 50% 20 -> 90%", nach dem Ansehen dann
          „auf 50% 10% und 400px reduzieren (sind paar negativ aufgefallen mit
          der verschiebung, so ist besser)". Bei 90 % lag der Ausschnitt zu
          tief — manche Cover zeigten dann den Bildrand statt der Figuren.

          Der „Staffel 1"-Block darunter holt einen Teil davon wieder herein
          (sein `-mt-24`): Das Cover bleibt groß, der Weg zum Inhalt kurz.
        */}
        <div className="relative h-[400px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-cover"
            style={{
              backgroundImage: buehnenBild ? `url(${buehnenBild})` : undefined,
              backgroundPosition: '50% 10%',
              zIndex: -2,
            }}
          />
          {/*
            **Ein Verlauf, der erst in der unteren Hälfte anfängt.**

            Vorher lagen zwei übereinander — einer von oben, einer von links —
            und beide begannen sofort: Das Cover war schon in der ersten Zeile
            zur Hälfte abgedunkelt. Der von links ist ganz entfallen, denn er
            schob den Kontrast vom Titel weg, und der Titel liegt nicht mehr
            hier. Übrig bleibt der von unten, der bei 52 % transparent
            anfängt und in den Panel-Grund ausläuft — damit das Cover ohne
            Kante in die Seite übergeht.

            **Die Farben kommen aus `styles.css` und wechseln mit dem Thema.**
            Bis zum 25.08.2026 standen sie hier fest als `rgba(11,15,22,…)`;
            im hellen Thema lag der dunkle Titel damit auf einem dunklen
            Verlauf (Daniel, mit Bild: „styling kaputt im light mode").
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: -1,
              background:
                'linear-gradient(180deg, transparent 0%, transparent 52%, var(--buehne-mitte) 78%, var(--buehne-unten) 92%, var(--panel-grund) 100%)',
            }}
          />
          {/*
            Senkrecht an der rechten Kante, direkt unter der Titelzeile. Jedes
            Symbol behält seinen dunklen Grund: Auf einem hellen Cover wäre ein
            blankes Symbol sonst genauso unlesbar wie blanker Text.
          */}
          {/*
            In der Ecke, nicht neben ihr: `top-0 right-0`, und gerundet ist nur
            die Kante, die ins Bild zeigt (Daniel, 03.09.2026).
          */}
          <div className="absolute right-0 top-0 z-10 flex flex-col items-center gap-1.5 rounded-bl-lg bg-black/50 px-1.5 py-2 backdrop-blur-[3px]">
            <ShareIcon slug={title.slug} name={anzeigeName(title)} />
            <HideEye hidden={false} onToggle={() => onToggleHidden(title.id)} />
            <FavoriteStar active={favorites.has(title.id)} onToggle={() => onToggleFavorite(title.id)} />
            {reihenIds.length > 1 && (
              <ReihenStern
                alleGemerkt={reihenIds.every((id) => favorites.has(id))}
                anzahl={reihenIds.length}
                onMerken={() => {
                  for (const id of reihenIds) if (!favorites.has(id)) onToggleFavorite(id)
                }}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('detail.close')}
              className="cursor-pointer px-1 text-sm text-white transition hover:opacity-70"
            >
              ✕
            </button>
          </div>

          {/*
            Die Unterzeile überlappt das Cover — sie kostet damit keine eigene
            Höhe. In der Ecke wie die Bedienelemente gegenüber, gerundet nur
            zum Bild hin.

            **Die Schreibweisen stehen darin, nicht darunter** (Daniel,
            03.09.2026: „weitere schreibweisen unter subtitle schieben, selber
            container nächste zeile"). Als eigene Zeile im Inhaltsbereich
            kosteten sie 24 px für eine Angabe, die fast niemand aufklappt.
          */}
          {/*
            **Kein Kasten ohne Inhalt.**

            Die Unterzeile setzt sich aus vier Angaben zusammen — Format,
            Folgenzahl, Jahr, Studio. Fehlen alle vier, stand hier trotzdem
            ein grauer Balken über dem Cover: eine leere Fläche, die aussieht
            wie ein Ladefehler (Daniel, 04.09.2026, mit Bild; er konnte den
            Zustand nicht wiederholen, er trat beim Wechsel zwischen Tabs
            auf).

            Die Ursache ist damit nicht gefunden — sie steht als Aufgabe in
            `status.md`. Aber der sichtbare Schaden entsteht erst hier, und er
            gehört unabhängig von seiner Ursache verhindert: Ein Kasten, der
            nichts zu sagen hat, wird nicht gezeichnet.
          */}
          {unterzeile.length > 0 && (
          <div className="absolute left-0 top-0 z-10 max-w-[calc(100%-4rem)] rounded-br-lg bg-[rgba(8,12,18,.74)] px-2.5 py-1 backdrop-blur-[3px]">
          <p className="text-xs text-slate-300">
            {[
              title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
              /*
                **„1 Folgen" gab es hier zu lesen** — bei „Venus Wars" stand
                „Film · 1 Folgen · JP 1989" (03.09.2026). Falsch in beidem: Der
                Plural stimmt nicht, und ein Film hat keine Folgen, sondern ist
                einer. Bei genau einer Einheit sagt das Format schon alles.
              */
              title.episodes && title.episodes > 1
                ? `${title.episodes} ${t('detail.episodes')}`
                : undefined,
              jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
              title.studios?.[0],
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <WeitereTitel title={title} />
          </div>
          )}

          {/*
            **Die Altersfreigabe als Marke, gegenüber der Unterzeile.**

            Sie stand bis zum 04.09.2026 in der Faktenzeile des Kastens,
            zwischen zwei Angaben, die den Kopf darüber wiederholten. Als
            deren Dopplung fiel, blieb sie als einzige übrig — und gehört
            damit dorthin, wo die Werkangaben stehen. Daniel: „ab 12 kann als
            label icon oben rechts vom sub-title-div."

            Rechts, weil links der Untertitel steht und die Schließen-Leiste
            erst 3,5 rem tiefer beginnt; die Marke passt in die Lücke
            dazwischen, ohne beide anzufassen.
          */}
          {title.fsk !== undefined && (
            <span className="absolute right-11 top-0 z-10 rounded-b-lg bg-[rgba(8,12,18,.74)] px-2 py-1 text-xs font-semibold tabular-nums text-slate-200 backdrop-blur-[3px]">
              {t('antwort.fskAb', { n: title.fsk })}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
