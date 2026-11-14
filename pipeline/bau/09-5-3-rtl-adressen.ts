import yaml from 'js-yaml'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'

export function stelleRtlAdressenUm({ titles }: {
  titles: Map<number, Title>
}) {
  /**
   * **RTL+ hat seine Domain gewechselt — die alten Adressen zeigen ins Leere.**
   *
   * aniSearch führt zu zehn Titeln einen Verweis der Form
   * `www.tvnow.de/serien/<slug>-<nummer>`. TVNow heißt seit dem Umbau
   * `plus.rtl.de`, und die alten Adressen leiten **auf die Startseite** um —
   * gemessen am 07.09.2026: alle zehn antworten mit HTTP 200 und landen auf
   * `https://plus.rtl.de/`. Wer im Kalender darauf klickt, steht vor dem ganzen
   * Katalog statt vor der Serie.
   *
   * `data/rtlplus-befunde.json` weiß das seit dem 22.08.2026 für zwei davon
   * (`lebt: false`, `aufStartseite: true`) — der Befund wurde nur nie
   * angewandt. Dieselbe Klasse Fehler wie beim Handbeleg und bei den
   * ADN-Adressen: **ein Befund, den niemand liest, ist kein Befund.**
   *
   * Die neuen Adressen stehen in `data/rtlplus-adressen.yaml`, je Titel
   * einzeln über RTL+' Sitemaps belegt und mit dem `<title>` der Zielseite
   * gegengelesen.
   */
  const rtlAdressen: Record<number, string> = (() => {
    try {
      const roh = yaml.load(readFileSync(resolve(ROOT, 'data/rtlplus-adressen.yaml'), 'utf8'))
      const raus: Record<number, string> = {}
      for (const [k, v] of Object.entries((roh ?? {}) as Record<string, unknown>)) {
        if (!Number.isFinite(Number(k)) || typeof v !== 'string' || !v) continue
        raus[Number(k)] = v
      }
      return raus
    } catch {
      // Datei fehlt oder ist kein gültiges YAML: dann gelten keine Handadressen (leere Zuordnung)
      return {}
    }
  })()
  {
    let ersetzt = 0
    for (const title of titles.values()) {
      const slug = rtlAdressen[title.id]
      if (!slug) continue
      for (const stream of title.streams) {
        if (stream.platform !== 'rtlplus' || !/tvnow\.de/.test(stream.url)) continue
        stream.url = `https://plus.rtl.de/${slug}`
        ersetzt++
      }
    }
    if (ersetzt) log(`${ersetzt} RTL+-Adressen von der abgeschalteten Domain tvnow.de umgestellt`)
  }
}
