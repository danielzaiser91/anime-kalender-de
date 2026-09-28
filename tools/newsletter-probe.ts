#!/usr/bin/env node
/**
 * **Wie die gebaute Newsletter-Mail aussieht** (28.09.2026).
 *
 * Gerendert wird die **echte** `digestMail()` aus `worker/src/templates.ts` — mit erfundenen
 * Terminen, aber echtem Code. Ein Nachbau würde den Nachbau prüfen; ein Bild zeigt, was von der
 * Reihenfolge (Favoriten, Kino, Stream, Handel, TV-Premieren, TV-Wiederholungen, Neuigkeiten)
 * und den Abzeichen wirklich ankommt.
 *
 * Aufruf: `node node_modules/tsx/dist/cli.mjs tools/newsletter-probe.ts`
 * Ergebnis: `docs/newsletter-probe.png`
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import type { ReleaseEvent } from '../shared/types.ts'
import { digestMail } from '../worker/src/templates.ts'

const t = (id: string, titleId: number, extra: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({
    id,
    releaseSlug: id,
    titleId,
    date: '2026-09-28',
    time: '18:25',
    releaseType: 'weekly',
    platform: 'crunchyroll',
    name: id,
    ...extra,
  }) as ReleaseEvent

const termine: ReleaseEvent[] = [
  t('Frieren — Beyond Journey’s End', 1, { staffelfinale: true, time: '18:25' }),
  t('Dragon Ball Daima', 1, { platform: 'tv', sender: 'ProSieben MAXX', tvPremiere: true, time: '17:10' }),
  t('Solo Leveling', 2, { time: '08:00', staffelfinale: true }),
  t('Chainsaw Man — Reze Arc', 2, { releaseType: 'batch', platform: 'primevideo', time: undefined }),
  t('Look Back', 2, { platform: 'kino', releaseType: 'movie', time: undefined }),
  t('I Parry Everything!', 2, { platform: 'disc', releaseType: 'disc', time: undefined }),
  t('One Piece Log: Fish-Man Island Saga', 2, { platform: 'tv', sender: 'ProSieben MAXX', tvPremiere: true }),
  t('Dragon Ball', 2, { platform: 'tv', sender: 'ProSieben MAXX', tvPremiere: false, episode: 5, episodeCount: 15, time: '17:10' }),
  t('Dragon Ball', 2, { platform: 'tv', sender: 'ProSieben MAXX', tvPremiere: false, episode: 6, episodeCount: 15, time: '17:35' }),
  t('Detektiv Conan', 2, { platform: 'tv', sender: 'ProSieben MAXX', tvPremiere: false, episode: 144, time: '18:00' }),
]

const mail = digestMail(termine, 'daily', 'https://anime-kalender.de/', 'https://anime-kalender.de/unsubscribe?token=x', {
  favorites: new Set([1]),
  news: [
    {
      am: '2026-09-28',
      titelId: 164702,
      titel: 'Black Clover',
      slug: 'black-clover-164702',
      meldungen: [{ art: 'angekuendigt', platform: 'crunchyroll', datum: '2026-10-03' }],
    },
    {
      am: '2026-09-28',
      titelId: 180523,
      titel: 'Magic Knight Rayearth (2026)',
      slug: 'magic-knight-rayearth-180523',
      meldungen: [{ art: 'neu', platform: 'crunchyroll' }],
    },
  ],
})

mkdirSync('docs', { recursive: true })
const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 660, height: 900 }, deviceScaleFactor: 2 })
await seite.setContent(mail.html)
await seite.screenshot({ path: 'docs/newsletter-probe.png', fullPage: true })
await browser.close()
console.log('Betreff:', mail.subject)
console.log('Bild: docs/newsletter-probe.png')
