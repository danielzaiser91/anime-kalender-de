/**
 * Was Amazon beim Staffelwechsel wirklich tut — gemessen statt vermutet.
 *
 * Am 24.08.2026 sind an der Amazon-Erweiterung ein Dutzend Fehler aufgetreten,
 * die alle dieselbe Wurzel haben: Beim Wechsel über das Auswahlfeld tauscht
 * Amazon Adresse, Quelltext und Folgenliste **nacheinander** aus, und in diesem
 * Fenster widersprechen sich die Quellen. Wie lange es dauert und in welcher
 * Reihenfolge, ließ sich von außen nicht beobachten — die Sitzung gehört
 * Daniel, und ein Wechsel im Dropdown ist kein Seitenaufruf, den ein Skript
 * nachstellen kann.
 *
 * Dieses Skript schreibt bei jedem Takt mit, was die vier Quellen sagen, aus
 * denen die Erweiterung ihre Auskunft baut. Es **liest nur** — es klickt nicht,
 * meldet nicht und ändert nichts an der Seite.
 *
 * ## Benutzen
 *
 * 1. Amazon-Titelseite öffnen, F12, Reiter „Konsole"
 * 2. Dieses Skript einfügen, Enter
 * 3. Im Auswahlfeld die Staffel wechseln
 * 4. `akDiagnose()` eingeben — die Tabelle erscheint und liegt in der
 *    Zwischenablage
 */
;(() => {
  const takte = []
  const start = Date.now()

  const asinAusAdresse = () =>
    /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10})(?:[/?]|$)/.exec(location.pathname)?.[1] ?? null

  const staffelAusAdresse = () =>
    Number(/[?&]ref_=[^&]*_s(\d+)/.exec(location.search)?.[1]) || null

  function ausQuelltext() {
    const html = document.documentElement?.innerHTML ?? ''
    let asin = null
    for (const m of html.matchAll(/titleID/g)) {
      const t = /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10})/.exec(html.slice(m.index, m.index + 80))
      if (t) {
        asin = t[1]
        break
      }
    }
    return {
      asin,
      staffel: Number(/"seasonNumber\\*"\s*:\s*(\d+)/.exec(html)?.[1]) || null,
      folgenText: Number(/>\s*(\d+)\s*Folgen\s*</.exec(html)?.[1]) || null,
      episodeCount: Number(/"episodeCount"\s*:\s*(\d+)/.exec(html)?.[1]) || null,
      staffelZahl: Number(/(\d+)\s*Staffeln/.exec(html)?.[1]) || null,
      // Wie viele Folgen mit Tonspur gerade lesbar sind — das ist die Zahl,
      // die am Knopf steht.
      gelesen: [...html.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\][\s\S]{0,400}?"episodeNumber"\s*:\s*(\d+)/g)]
        .length,
      abschnitte: (/episodePages/.test(html) && [...html.matchAll(/\\?"token\\?"\s*:\s*\\?"([A-Za-z0-9+/=_.-]{20,})/g)].length) || 0,
    }
  }

  function schnappschuss() {
    const q = ausQuelltext()
    return {
      ms: Date.now() - start,
      titel: (document.title || '').replace(/^Amazon\.de:\s*/, '').replace(/\s*ansehen.*$/, '').slice(0, 40),
      dropdown: ([...document.querySelectorAll('button,[role="button"]')]
        .map((e) => (e.textContent || '').trim())
        .find((t) => /^(Staffel|Season)\s*\d+$/i.test(t)) ?? '—'),
      adrAsin: asinAusAdresse() ?? '—',
      adrStaffel: staffelAusAdresse() ?? '—',
      qtAsin: q.asin ?? '—',
      qtStaffel: q.staffel ?? '—',
      folgenText: q.folgenText ?? '—',
      episodeCount: q.episodeCount ?? '—',
      gelesen: q.gelesen,
      abschnitte: q.abschnitte,
    }
  }

  let letzte = ''
  setInterval(() => {
    const s = schnappschuss()
    // Nur festhalten, was sich geändert hat — sonst stehen dort hundert
    // gleiche Zeilen und die interessante geht darin unter.
    const finger = JSON.stringify({ ...s, ms: 0 })
    if (finger === letzte) return
    letzte = finger
    takte.push(s)
  }, 250)

  globalThis.akDiagnose = () => {
    const kopf = ['ms', 'dropdown', 'adrAsin', 'adrStaffel', 'qtAsin', 'qtStaffel', 'folgenText', 'episodeCount', 'gelesen', 'abschnitte']
    const zeilen = takte.map((t) => kopf.map((k) => String(t[k])).join(' | '))
    const text = [
      `Titel: ${takte[takte.length - 1]?.titel ?? '?'}`,
      `Adresse: ${location.pathname}${location.search}`,
      '',
      kopf.join(' | '),
      kopf.map(() => '---').join(' | '),
      ...zeilen,
    ].join('\n')
    console.log(text)
    try {
      copy(text)
      console.log('%c↑ liegt in der Zwischenablage', 'color:#4ade80')
    } catch {
      console.log('(Zwischenablage ging nicht — Text oben markieren und kopieren)')
    }
    return text
  }

  console.log('%cakDiagnose läuft. Staffel wechseln, dann akDiagnose() eingeben.', 'color:#4ade80;font-weight:bold')
})()
