/**
 * **Die Abschnitte der Newsletter-Mail** (28.09.2026).
 *
 * Eigenes Modul, weil `templates.ts` über die Dateigrenze wuchs: Hier stehen die Teile, die es
 * vorher nicht gab — die eingeklappten TV-Wiederholungen, die Neuigkeiten und die kleinen
 * Bausteine drumherum. Was eine *Zeile* ausmacht (`eventRow`), bleibt in `templates.ts`.
 *
 * Die Reihenfolge der Rubriken und die Einordnung eines Termins stehen in `mail-sorten.ts` —
 * dort ohne HTML, damit man die Regeln lesen kann.
 */
import type { NewsEintrag, NewsMeldung, ReleaseEvent } from '../../shared/types.ts'
import { PLATFORMS, anbieterName } from '../../shared/types.ts'
import { abzeichen } from './mail-sorten.ts'

/** Was jede Zeile zum Verlinken braucht. */
export interface RowContext {
  siteUrl: string
  links: Map<string, { platformUrl?: string; buyUrl?: string }>
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Die Ansicht im Kalender, die genau diesen Termin zeigt.
 *
 * Bewusst über die Teilen-Seite `/r/<slug>/` statt direkt über `#/woche?…`:
 * Alles hinter dem `#` erreicht keinen Server, eine weitergeleitete Mail hätte
 * damit nie eine Vorschau. Die Teilen-Seite hat eigene Vorschaubilder und
 * springt anschließend selbst in die Wochenansicht — der Hash sagt ihr nur,
 * welcher Tag gemeint ist.
 */
export function calendarUrl(ctx: RowContext, ev: ReleaseEvent): string {
  const slug = encodeURIComponent(ev.releaseSlug)
  return `${ctx.siteUrl.replace(/\/$/, '')}/r/${slug}/#/woche?d=${ev.date}&r=${slug}`
}

/** Eine Zeile unter der Rubrik-Überschrift — sie sagt, was hier zu finden ist. */
export function hinweisZeile(text: string): string {
  return `<p style="margin:6px 0 0;color:#9aa5bd;font-size:13px;">${text}</p>`
}

/** Das Abzeichen an der Zeile — Finale, Start oder TV-Premiere. */
export function badge(ev: ReleaseEvent): string {
  const text = abzeichen(ev)
  if (!text) return ''
  const farbe = text === 'Premiere' ? '#2dd4bf' : '#fbbf24'
  return ` <span style="padding:1px 7px;border:1px solid ${farbe};border-radius:999px;color:${farbe};font-size:11px;font-weight:600;">${text}</span>`
}

/** Eine Zeile für die eingeklappte Wiederholungsliste — Titel, Folge, Zeit, Sender. */
function wiederholungsTeile(ev: ReleaseEvent): string[] {
  const teile = [ev.name]
  if (ev.episode && !ev.sichtung) teile.push(`Fg. ${ev.episode}`)
  if (ev.time) teile.push(`${ev.time} Uhr`)
  const wer = ev.sender || PLATFORMS[ev.platform]?.name
  if (wer) teile.push(wer)
  return teile
}

/**
 * **TV-Wiederholungen: eine Zeile je Sendung, klein und zusammen** (Daniel, 28.09.2026: „vor
 * allem wenn es wiederholungen sind, sind es nebensächliche infos").
 *
 * Sie fallen nicht weg — wer wissen will, was heute im Fernsehen läuft, findet es weiterhin.
 * Sie nehmen nur nicht mehr den Platz der Premieren ein: In der Mail vom 28.09.2026 standen
 * fünf von sechs Zeilen hier.
 */
export function tvWiederholungen(ctx: RowContext, events: ReleaseEvent[]): string {
  const sortiert = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'),
  )
  const zeilen = sortiert.map((ev) => wiederholungsTeile(ev).map(escapeHtml).join(' · '))
  return `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid #3f4b63;color:#8b98b3;font-weight:700;font-size:15px;letter-spacing:.03em;">
      📺 TV — Wiederholungen
    </p>
    <p style="margin:6px 0 0;color:#8b98b3;font-size:13px;">
      ${sortiert.length === 1 ? 'Eine Sendung' : `${sortiert.length} Sendungen`} — die Folgen liefen schon auf Deutsch.
      <a href="${escapeHtml(calendarUrl(ctx, sortiert[0]))}" style="color:#7dd3fc;">Im Kalender ansehen &rsaquo;</a>
    </p>
    <p style="margin:8px 0 0;color:#8b98b3;font-size:13px;line-height:1.7;">${zeilen.join('<br>')}</p>`
}

/**
 * **Eine Nachricht in einem Satz** — dieselbe Wortwahl wie auf der Seite (`web/src/lib/i18n.tsx`,
 * `news.*`). Zwei Formulierungen für dieselbe Sache wären zwei Wahrheiten.
 */
export function newsSatz(m: NewsMeldung): string {
  const anbieter = m.anbieter || (m.platform ? anbieterName(m.platform) : '')
  const datum = m.datum ? m.datum.split('-').reverse().join('.') : ''
  switch (m.art) {
    case 'neu':
      if (m.weiterer && anbieter) return `Jetzt auch auf Deutsch bei ${anbieter}`
      return anbieter ? `Erstmals mit deutscher Synchro bei ${anbieter}` : 'Erstmals mit deutscher Synchro'
    case 'folgen':
      return m.bis && m.bis !== m.von
        ? `Folgen ${m.von}–${m.bis} auf Deutsch bei ${anbieter}`
        : `Folge ${m.von} auf Deutsch bei ${anbieter}`
    case 'angekuendigt':
      return `Start am ${datum}${anbieter ? ` bei ${anbieter}` : ''}`
    case 'disc':
      return `Erscheint am ${datum} auf Disc`
    case 'kino':
      return `Kinostart am ${datum}`
    case 'verspaetet':
      return m.nachgereichtAm
        ? `Folge ${m.von} kam mit Verspätung am ${m.nachgereichtAm.split('-').reverse().join('.')}`
        : `Folge ${m.von} war für den ${datum} angekündigt und ist nicht erschienen`
  }
}

/**
 * **Neuigkeiten: Ankündigungen und Verschiebungen** (Daniel, 28.09.2026: „News, eventuell? Wenn
 * wir neue interessante news reinbekommen, wie zB ankündigungen, sollten diese eventuell auch
 * angezeigt werden (inkl Link zur Quelle)").
 *
 * Quelle ist `data/news.json` — dieselbe Datei wie auf der Seite, entstanden ohne neuen Abruf
 * (`pipeline/lib/news.ts`: `neu`, `folgen`, `angekuendigt`, `disc`, `kino`, `verspaetet`).
 * Der Link führt auf die Titelseite, wo die Belege stehen.
 */
export function newsBlock(eintraege: NewsEintrag[], siteUrl: string): string {
  const bloecke = eintraege.map((e) => {
    const saetze = e.meldungen.map(newsSatz).filter(Boolean)
    const link = `${siteUrl.replace(/\/$/, '')}#/datenbank?t=${e.titelId}`
    return `<p style="margin:10px 0 0;padding-top:8px;border-top:1px solid #232c40;">
        <a href="${link}" style="color:#fff;text-decoration:none;"><strong>${escapeHtml(e.titel)}</strong></a><br>
        <span style="color:#9aa5bd;font-size:13px;">${saetze.map(escapeHtml).join(' · ')} —
          <a href="${link}" style="color:#7dd3fc;">Quelle im Kalender &rsaquo;</a></span>
      </p>`
  })
  return `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid #a78bfa;color:#a78bfa;font-weight:700;font-size:15px;letter-spacing:.03em;">
      📰 Neuigkeiten
    </p>
    <p style="margin:6px 0 0;color:#9aa5bd;font-size:13px;">Ankündigungen, auf die niemand einen Termin setzen kann.</p>
    ${bloecke.join('')}`
}

/** Dieselben Wiederholungen für die Textfassung. */
export function wiederholungsText(events: ReleaseEvent[]): string {
  return [...events]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'))
    .map((ev) => `* ${wiederholungsTeile(ev).join(' · ')}`)
    .join('\n')
}

/** Dieselben Neuigkeiten für die Textfassung. */
export function newsText(eintraege: NewsEintrag[], siteUrl: string): string {
  return eintraege
    .map((e) => {
      const saetze = e.meldungen.map(newsSatz).filter(Boolean).join(' · ')
      return `* ${e.titel} — ${saetze}\n  ${siteUrl.replace(/\/$/, '')}#/datenbank?t=${e.titelId}`
    })
    .join('\n')
}
