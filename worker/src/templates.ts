import type { ReleaseEvent } from '../../shared/types.ts'
import { PLATFORMS, RELEASE_TYPES } from '../../shared/types.ts'
import { formatDate, weekdayName } from '../../shared/time.ts'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHELL = (title: string, body: string, footer: string) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#0f1420;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#161c2b;border-radius:14px;overflow:hidden;">
<tr><td style="padding:20px 24px;background:#1d2536;">
  <span style="font-size:20px;">📺</span>
  <span style="color:#fff;font-size:17px;font-weight:700;margin-left:6px;">Anime-Kalender DE</span>
</td></tr>
<tr><td style="padding:24px;color:#d7dced;font-size:15px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:16px 24px;background:#121826;color:#7c879e;font-size:12px;line-height:1.6;">${footer}</td></tr>
</table></td></tr></table></body></html>`

export function confirmMail(confirmUrl: string): { subject: string; html: string; text: string } {
  const subject = 'Bitte bestätige deine Newsletter-Anmeldung'
  const html = SHELL(
    subject,
    `<p style="margin:0 0 14px;">Fast geschafft. Ein Klick noch, dann bekommst du die anstehenden
     Anime-Releases mit deutscher Synchro per Mail.</p>
     <p style="margin:0 0 20px;"><a href="${confirmUrl}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
       Anmeldung bestätigen</a></p>
     <p style="margin:0;color:#9aa5bd;font-size:13px;">Falls der Knopf nicht geht:<br>
     <a href="${confirmUrl}" style="color:#7dd3fc;word-break:break-all;">${confirmUrl}</a></p>`,
    'Diese Mail wurde angefordert. Warst du das nicht, ignoriere sie einfach — ohne Bestätigung wird nichts gespeichert.',
  )
  const text = `Anmeldung bestätigen: ${confirmUrl}\n\nWarst du das nicht, ignoriere diese Mail — ohne Bestätigung wird nichts gespeichert.`
  return { subject, html, text }
}

/** Direktlinks je Release-Slug, aus `releases.json` geladen. */
export interface ReleaseLink {
  platformUrl?: string
  buyUrl?: string
}

/** Was jede Zeile zum Verlinken braucht. */
interface RowContext {
  siteUrl: string
  links: Map<string, ReleaseLink>
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
function calendarUrl(ctx: RowContext, ev: ReleaseEvent): string {
  const slug = encodeURIComponent(ev.releaseSlug)
  return `${ctx.siteUrl.replace(/\/$/, '')}/r/${slug}/#/woche?d=${ev.date}&r=${slug}`
}

/** Zum Anbieter selbst: Streamingseite, bei Disc-Releases die Kaufseite. */
function watchUrl(ctx: RowContext, ev: ReleaseEvent): string | undefined {
  const link = ctx.links.get(ev.releaseSlug)
  if (!link) return undefined
  return ev.releaseType === 'disc' ? (link.buyUrl ?? link.platformUrl) : (link.platformUrl ?? link.buyUrl)
}

function eventRow(ctx: RowContext, ev: ReleaseEvent, highlight: boolean): string {
  const type = RELEASE_TYPES[ev.releaseType]
  const time = ev.time ? `${ev.time} Uhr` : ev.releaseType === 'disc' ? 'im Handel' : 'Zeit offen'
  const episode = ev.episode ? ` · Folge ${ev.episode}${ev.episodeCount ? `/${ev.episodeCount}` : ''}` : ''
  const platform = PLATFORMS[ev.platform]
  const watch = watchUrl(ctx, ev)

  // Der Anbietername ist der Knopf zum Ansehen. Fehlt der Deeplink, bleibt er
  // schlichter Text — ein Link ins Leere wäre schlimmer als keiner.
  const platformPart = watch
    ? `<a href="${escapeHtml(watch)}" style="color:${platform.color};text-decoration:none;font-weight:600;">${escapeHtml(
        platform.name,
      )} ${ev.releaseType === 'disc' ? 'kaufen' : 'ansehen'} &rsaquo;</a>`
    : escapeHtml(platform.name)

  return `<tr>
    <td style="padding:7px 0;border-top:1px solid #232c40;">
      <span style="display:inline-block;width:3px;height:14px;background:${type.color};vertical-align:-2px;border-radius:2px;"></span>
      ${highlight ? '<span style="color:#fbbf24;">★</span> ' : ''}<a href="${escapeHtml(
        calendarUrl(ctx, ev),
      )}" style="color:#fff;text-decoration:none;"><strong>${escapeHtml(ev.name)}</strong></a><br>
      <span style="color:#9aa5bd;font-size:13px;">${escapeHtml(time)}${escapeHtml(episode)} · ${platformPart}${
        ev.estimated ? ' · Termin abgeleitet' : ''
      }</span>
    </td>
  </tr>`
}

/** Termine nach Tag gruppiert ausgeben. */
function dateSections(ctx: RowContext, events: ReleaseEvent[], highlight: boolean): string {
  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = byDate.get(ev.date)
    if (list) list.push(ev)
    else byDate.set(ev.date, [ev])
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([date, list]) => `<p style="margin:16px 0 2px;color:#7dd3fc;font-weight:700;font-size:14px;">
        ${weekdayName(date)}, ${formatDate(date)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
          .map((ev) => eventRow(ctx, ev, highlight))
          .join('')}</table>`,
    )
    .join('')
}

function textSections(ctx: RowContext, events: ReleaseEvent[]): string {
  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = byDate.get(ev.date)
    if (list) list.push(ev)
    else byDate.set(ev.date, [ev])
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([date, list]) =>
        `${weekdayName(date)}, ${formatDate(date)}\n` +
        list
          .map((ev) => {
            const watch = watchUrl(ctx, ev)
            return (
              `  - ${ev.name}${ev.episode ? ` (Folge ${ev.episode})` : ''} — ${
                ev.time ? `${ev.time} Uhr` : ev.releaseType === 'disc' ? 'im Handel' : 'Zeit offen'
              }, ${PLATFORMS[ev.platform].name}\n` +
              `    Kalender: ${calendarUrl(ctx, ev)}` +
              (watch ? `\n    ${ev.releaseType === 'disc' ? 'Kaufen' : 'Ansehen'}: ${watch}` : '')
            )
          })
          .join('\n'),
    )
    .join('\n\n')
}

export interface DigestOptions {
  /** AniList-IDs der gemerkten Titel. */
  favorites?: Set<number>
  /** Adresse, über die der Nutzer seine Favoriten abgleichen kann. */
  syncUrl?: string
  /** Direktlinks zum Anbieter, je Release-Slug. */
  links?: Map<string, ReleaseLink>
}

export function digestMail(
  events: ReleaseEvent[],
  frequency: 'daily' | 'weekly',
  siteUrl: string,
  unsubUrl: string,
  options: DigestOptions = {},
): { subject: string; html: string; text: string } {
  const favorites = options.favorites ?? new Set<number>()
  const mine = events.filter((e) => favorites.has(e.titleId))
  const rest = events.filter((e) => !favorites.has(e.titleId))
  const ctx: RowContext = { siteUrl, links: options.links ?? new Map() }

  // Der Betreff nennt zuerst, was den Leser wirklich betrifft.
  const subject =
    mine.length > 0
      ? `${mine.length} ${mine.length === 1 ? 'Folge' : 'Folgen'} deiner Favoriten${
          rest.length ? ` und ${rest.length} weitere Releases` : ''
        }`
      : frequency === 'daily'
        ? `Heute mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`
        : `Diese Woche mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`

  const heading = (text: string, colour: string) =>
    `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid ${colour};color:${colour};font-weight:700;font-size:15px;letter-spacing:.03em;">${text}</p>`

  let body = ''
  if (mine.length > 0) {
    body += heading('★ Deine Favoriten', '#fbbf24') + dateSections(ctx, mine, true)
  }
  if (rest.length > 0) {
    body +=
      mine.length > 0
        ? heading('Weitere Releases', '#3f4b63') + dateSections(ctx, rest, false)
        : `<p style="margin:0;">${
            frequency === 'daily' ? 'Das steht heute an:' : 'Das steht in den nächsten sieben Tagen an:'
          }</p>` + dateSections(ctx, rest, false)
  }

  // Ohne gemerkte Titel ist der Hinweis nützlich; mit gemerkten wäre er Lärm.
  const favouriteHint =
    favorites.size === 0 && options.syncUrl
      ? `<p style="margin:22px 0 0;padding:12px 14px;background:#1d2536;border-radius:9px;color:#9aa5bd;font-size:13px;line-height:1.6;">
           Du hast noch keine Favoriten hinterlegt. Markiere im Kalender die Serien, denen du folgst —
           ihre neuen Folgen stehen dann ganz oben in dieser Mail.<br>
           <a href="${options.syncUrl}" style="color:#7dd3fc;">Favoriten übernehmen</a>
         </p>`
      : ''

  const html = SHELL(
    subject,
    `${body}${favouriteHint}
     <p style="margin:24px 0 0;"><a href="${siteUrl}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;">
       Im Kalender ansehen</a></p>`,
    `Du bekommst diese Mail, weil du den Newsletter bestätigt hast.
     <a href="${unsubUrl}" style="color:#7dd3fc;">Abmelden</a> ·
     <a href="${siteUrl}#/datenschutz" style="color:#7dd3fc;">Datenschutz</a>${
       options.syncUrl ? ` · <a href="${options.syncUrl}" style="color:#7dd3fc;">Favoriten abgleichen</a>` : ''
     }`,
  )

  const text =
    `${subject}\n\n` +
    (mine.length > 0 ? `DEINE FAVORITEN\n\n${textSections(ctx, mine)}\n\n` : '') +
    (rest.length > 0 ? `${mine.length > 0 ? 'WEITERE RELEASES\n\n' : ''}${textSections(ctx, rest)}\n\n` : '') +
    `Kalender: ${siteUrl}\n` +
    (options.syncUrl ? `Favoriten abgleichen: ${options.syncUrl}\n` : '') +
    `Abmelden: ${unsubUrl}`

  return { subject, html, text }
}

interface MonitorLine {
  name: string
  url: string
  ok: boolean
  reason?: string
  ms: number
  downSince?: string
}

/**
 * Störungsmeldung. Kommt höchstens einmal am Tag, deshalb steht alles drin,
 * was zur Einschätzung nötig ist — nachfragen kann man ihr nicht.
 */
export function outageMail(
  down: MonitorLine[],
  totalCount: number,
  siteUrl: string,
): { subject: string; html: string; text: string } {
  const subject =
    down.length === 1
      ? `Nicht erreichbar: ${down[0].name}`
      : `${down.length} von ${totalCount} Seiten nicht erreichbar`

  const rows = down
    .map(
      (d) => `<tr><td style="padding:8px 0;border-top:1px solid #232c40;">
        <strong style="color:#fff;">${escapeHtml(d.name)}</strong><br>
        <span style="color:#f87171;font-size:13px;">${escapeHtml(d.reason ?? 'nicht erreichbar')}</span><br>
        <span style="color:#7c879e;font-size:12px;">${escapeHtml(d.url)}${
          d.downSince ? ` · zuletzt erreichbar ${escapeHtml(d.downSince)}` : ' · noch nie erreichbar gewesen'
        }</span>
      </td></tr>`,
    )
    .join('')

  const html = SHELL(
    subject,
    `<p style="margin:0 0 8px;">Die Prüfung lief gerade und hat Folgendes gefunden:</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <p style="margin:20px 0 0;color:#9aa5bd;font-size:13px;">
       ${totalCount - down.length} von ${totalCount} Seiten antworten normal.
       Diese Meldung kommt höchstens einmal am Tag — bleibt eine Seite länger weg,
       erfährst du es erst in der Wochenübersicht wieder.</p>`,
    `Erreichbarkeitsprüfung · <a href="${siteUrl}" style="color:#7dd3fc;">Anime-Kalender DE</a>`,
  )

  const text =
    `${subject}\n\n` +
    down
      .map(
        (d) =>
          `- ${d.name}: ${d.reason ?? 'nicht erreichbar'}\n  ${d.url}${
            d.downSince ? `\n  zuletzt erreichbar: ${d.downSince}` : ''
          }`,
      )
      .join('\n') +
    `\n\n${totalCount - down.length} von ${totalCount} Seiten antworten normal.`

  return { subject, html, text }
}

/**
 * Wochenübersicht. Kommt auch, wenn alles läuft — genau das ist ihr Zweck:
 * Sie beweist, dass die Überwachung selbst noch lebt. Ohne sie wäre Stille
 * nicht von „alles in Ordnung" zu unterscheiden.
 */
export function weeklyStatusMail(
  lines: MonitorLine[],
  siteUrl: string,
): { subject: string; html: string; text: string } {
  const down = lines.filter((l) => !l.ok)
  const subject =
    down.length === 0
      ? `Wochenübersicht: alle ${lines.length} Seiten laufen`
      : `Wochenübersicht: ${down.length} von ${lines.length} Seiten gestört`

  const rows = lines
    .slice()
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.name.localeCompare(b.name, 'de'))
    .map(
      (l) => `<tr>
        <td style="padding:5px 8px 5px 0;border-top:1px solid #232c40;white-space:nowrap;color:${
          l.ok ? '#34d399' : '#f87171'
        };">${l.ok ? '●' : '▲'}</td>
        <td style="padding:5px 0;border-top:1px solid #232c40;color:#d7dced;">${escapeHtml(l.name)}</td>
        <td style="padding:5px 0;border-top:1px solid #232c40;text-align:right;color:#7c879e;font-size:13px;white-space:nowrap;">${
          l.ok ? `${l.ms} ms` : escapeHtml(l.reason ?? 'weg')
        }</td>
      </tr>`,
    )
    .join('')

  const html = SHELL(
    subject,
    `<p style="margin:0 0 8px;">Stand der letzten Prüfung:</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <p style="margin:18px 0 0;color:#7c879e;font-size:12px;">
       Diese Mail kommt einmal die Woche, auch wenn alles läuft — daran erkennst du,
       dass die Überwachung selbst noch arbeitet.</p>`,
    `Erreichbarkeitsprüfung · <a href="${siteUrl}" style="color:#7dd3fc;">Anime-Kalender DE</a>`,
  )

  const text =
    `${subject}\n\n` +
    lines.map((l) => `${l.ok ? 'ok  ' : 'WEG '} ${l.name} — ${l.ok ? `${l.ms} ms` : (l.reason ?? '')}`).join('\n')

  return { subject, html, text }
}

export function page(title: string, message: string, siteUrl: string): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e17;color:#e6e9f0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:420px;padding:32px;text-align:center;">
<div style="font-size:38px;">📺</div>
<h1 style="font-size:20px;margin:12px 0 8px;">${escapeHtml(title)}</h1>
<p style="color:#9aa5bd;line-height:1.6;margin:0 0 22px;">${escapeHtml(message)}</p>
<a href="${siteUrl}" style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;">Zum Kalender</a>
</div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
