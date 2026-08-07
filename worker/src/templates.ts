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

export function digestMail(
  events: ReleaseEvent[],
  frequency: 'daily' | 'weekly',
  siteUrl: string,
  unsubUrl: string,
): { subject: string; html: string; text: string } {
  const subject =
    frequency === 'daily'
      ? `Heute mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`
      : `Diese Woche mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`

  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = byDate.get(ev.date)
    if (list) list.push(ev)
    else byDate.set(ev.date, [ev])
  }

  const sections = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const rows = list
        .map((ev) => {
          const type = RELEASE_TYPES[ev.releaseType]
          const time = ev.time
            ? `${ev.time} Uhr`
            : ev.releaseType === 'disc'
              ? 'im Handel'
              : 'Zeit offen'
          const episode = ev.episode ? ` · Folge ${ev.episode}${ev.episodeCount ? `/${ev.episodeCount}` : ''}` : ''
          return `<tr>
            <td style="padding:7px 0;border-top:1px solid #232c40;">
              <span style="display:inline-block;width:3px;height:14px;background:${type.color};vertical-align:-2px;border-radius:2px;"></span>
              <strong style="color:#fff;">${escapeHtml(ev.name)}</strong><br>
              <span style="color:#9aa5bd;font-size:13px;">${escapeHtml(time)}${escapeHtml(episode)} · ${escapeHtml(PLATFORMS[ev.platform].name)}${ev.estimated ? ' · Termin abgeleitet' : ''}</span>
            </td>
          </tr>`
        })
        .join('')
      return `<p style="margin:20px 0 4px;color:#7dd3fc;font-weight:700;font-size:14px;">
        ${weekdayName(date)}, ${formatDate(date)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
    })
    .join('')

  const html = SHELL(
    subject,
    `<p style="margin:0;">${
      frequency === 'daily' ? 'Das steht heute an:' : 'Das steht in den nächsten sieben Tagen an:'
    }</p>${sections}
     <p style="margin:24px 0 0;"><a href="${siteUrl}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;">
       Im Kalender ansehen</a></p>`,
    `Du bekommst diese Mail, weil du den Newsletter bestätigt hast.
     <a href="${unsubUrl}" style="color:#7dd3fc;">Abmelden</a> ·
     <a href="${siteUrl}#/datenschutz" style="color:#7dd3fc;">Datenschutz</a>`,
  )

  const text =
    `${subject}\n\n` +
    [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([date, list]) =>
          `${weekdayName(date)}, ${formatDate(date)}\n` +
          list
            .map(
              (ev) =>
                `  - ${ev.name} (${ev.time ? `${ev.time} Uhr` : ev.releaseType === 'disc' ? 'im Handel' : 'Zeit offen'}, ${PLATFORMS[ev.platform].name})`,
            )
            .join('\n'),
      )
      .join('\n\n') +
    `\n\nKalender: ${siteUrl}\nAbmelden: ${unsubUrl}`

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
