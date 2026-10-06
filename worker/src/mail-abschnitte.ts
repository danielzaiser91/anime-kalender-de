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
import { hostVon, istLink } from '../../shared/quelle.ts'

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
 * Die Ansicht im Kalender, die den Titel dieses Termins zeigt.
 *
 * Bewusst über die Teilen-Seite `/t/<ak>/` statt direkt über `#/woche?…`:
 * Alles hinter dem `#` erreicht keinen Server, eine weitergeleitete Mail hätte
 * damit nie eine Vorschau. Die Teilen-Seite springt anschließend selbst in die
 * Wochenansicht — der Hash sagt ihr nur, welcher Tag gemeint ist.
 */
export function calendarUrl(ctx: RowContext, ev: ReleaseEvent): string {
  return `${ctx.siteUrl.replace(/\/$/, '')}/t/${ev.titleId}/#/woche?d=${ev.date}&t=${ev.titleId}`
}

/** Der kleine Link am Ende einer Zeile: führt zur Titelseite im Kalender. */
export function kalenderLink(url: string): string {
  return `<a href="${escapeHtml(url)}" style="color:#7dd3fc;text-decoration:none;">zum Kalender &rsaquo;</a>`
}

/** Eine Zeile unter der Rubrik-Überschrift — sie sagt, was hier zu finden ist. */
export function hinweisZeile(text: string): string {
  return `<p style="margin:6px 0 0;color:#9aa5bd;font-size:13px;">${text}</p>`
}

/**
 * Das Abzeichen an der Zeile — Finale, Start, TV-Premiere **und „heute kostenlos"**.
 *
 * „Kostenlos" ist kein Ersatz für die anderen: Ein Finale heute Abend bleibt ein Finale, auch wenn
 * es frei läuft. Deshalb zwei Abzeichen nebeneinander, das zweite in Grün (29.09.2026, Daniel:
 * „heute kostenlos" als Abzeichen).
 */
export function badge(ev: ReleaseEvent): string {
  const text = abzeichen(ev)
  const farbe = text === 'Premiere' ? '#2dd4bf' : '#fbbf24'
  const marke = text
    ? ` <span style="padding:1px 7px;border:1px solid ${farbe};border-radius:999px;color:${farbe};font-size:11px;font-weight:600;">${text}</span>`
    : ''
  const frei = ev.kostenlos
    ? ' <span style="padding:1px 7px;border:1px solid #22c55e;border-radius:999px;color:#22c55e;font-size:11px;font-weight:600;">heute kostenlos</span>'
    : ''
  return marke + frei
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
 * **TV-Wiederholungen: eine Zeile je Sendung, klein und zusammen**.
 *
 * Sie fallen nicht weg — wer wissen will, was heute im Fernsehen läuft, findet es weiterhin.
 * Sie nehmen nur nicht mehr den Platz der Premieren ein: In der Mail vom 28.09.2026 standen
 * fünf von sechs Zeilen hier.
 */
export function tvWiederholungen(ctx: RowContext, events: ReleaseEvent[]): string {
  const sortiert = [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'),
  )
  const zeilen = sortiert.map((ev) => [...wiederholungsTeile(ev).map(escapeHtml), kalenderLink(calendarUrl(ctx, ev))].join(' · '))
  return `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid #3f4b63;color:#8b98b3;font-weight:700;font-size:15px;letter-spacing:.03em;">
      📺 TV — Wiederholungen
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
      return `Folge ${m.von} war für den ${datum} angekündigt und ist nicht erschienen`
    case 'nachgetragen':
      return `Rückwirkend eingetragen: Folge ${m.von ?? 1} erschien am ${datum}${m.zeit ? ` um ${m.zeit} Uhr` : ''}${anbieter ? ` bei ${anbieter}` : ''} mit deutscher Synchro`
    case 'nachgereicht':
      return m.bis && m.bis !== m.von
        ? `Folgen ${m.von}–${m.bis} verspätet erschienen`
        : `Folge ${m.von} verspätet erschienen`
  }
}

/**
 * **Neuigkeiten: Ankündigungen und Verschiebungen**.
 *
 * Quelle ist `data/news.json` — dieselbe Datei wie auf der Seite, entstanden ohne neuen Abruf
 * (`pipeline/lib/news.ts`: `neu`, `folgen`, `angekuendigt`, `disc`, `kino`, `verspaetet`).
 * Der Link führt auf die Titelseite, wo die Belege stehen.
 */
export function newsBlock(eintraege: NewsEintrag[], siteUrl: string): string {
  const bloecke = eintraege.map((e) => {
    /*
      **Jede Meldung nennt ihre Quelle**. Angezeigt
      wird der Wirt, das Ziel ist die Stelle, an der wir gelesen haben.
    */
    const saetze = e.meldungen
      .map((m) =>
        istLink(m.quelle)
          ? `${escapeHtml(newsSatz(m))} (<a href="${escapeHtml(m.quelle)}" style="color:#7dd3fc;">Quelle: ${escapeHtml(hostVon(m.quelle))}</a>)`
          : escapeHtml(newsSatz(m)),
      )
      .filter(Boolean)
    const link = `${siteUrl.replace(/\/$/, '')}#/datenbank?t=${e.titelId}`
    return `<p style="margin:10px 0 0;padding-top:8px;border-top:1px solid #232c40;">
        <a href="${link}" style="color:#fff;text-decoration:none;"><strong>${escapeHtml(e.titel)}</strong></a><br>
        <span style="color:#9aa5bd;font-size:13px;">${saetze.join(' · ')} —
          ${kalenderLink(link)}</span>
      </p>`
  })
  return `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid #a78bfa;color:#a78bfa;font-weight:700;font-size:15px;letter-spacing:.03em;">
      📰 Neuigkeiten
    </p>
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
      const saetze = e.meldungen
        .map((m) => (istLink(m.quelle) ? `${newsSatz(m)} (Quelle: ${hostVon(m.quelle)})` : newsSatz(m)))
        .filter(Boolean)
        .join(' · ')
      return `* ${e.titel} — ${saetze}\n  ${siteUrl.replace(/\/$/, '')}#/datenbank?t=${e.titelId}`
    })
    .join('\n')
}
