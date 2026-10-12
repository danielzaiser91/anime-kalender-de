/** Wikipedia-Rohtext (`?action=raw`) lesbar machen: Markup entfernen, Abschnitte und Einleitung holen, Infobox-Fakten, Sätze. */

const PLOT_NAMEN = 'Plot|Plot summary|Synopsis|Premise|Story|Storyline|Handlung|Inhalt|Inhaltsangabe|Handlungsübersicht|Prämisse|Handlung und Figuren|Story and setting|Setting'

/** Entfernt Verweise, Vorlagen, Tabellen, Kommentare und Auszeichnung. Innerste Vorlagen zuerst, damit verschachtelte Infoboxen mit verschwinden. */
export function sauber(t: string): string {
  let s = t
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  s = s.replace(/<gallery[\s\S]*?<\/gallery>/g, '').replace(/\{\|[\s\S]*?\|\}/g, '')
  for (let i = 0; i < 8; i++) s = s.replace(/\{\{[^{}]*\}\}/g, '')
  s = s.replace(/\[\[(?:Datei|File|Bild|Image|Kategorie|Category):[^\]]*\]\]/gi, '')
  s = s.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '')
  return s.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Abschnitt unter einer der Überschriften `namen` (mit Unterabschnitten bis zur nächsten Überschrift gleicher oder höherer Ebene). */
export function abschnitt(text: string, namen = PLOT_NAMEN): string {
  const m = new RegExp(`^(=+)\\s*(?:${namen})\\s*\\1\\s*$`, 'im').exec(text)
  if (!m) return ''
  const rest = text.slice(m.index + m[0].length)
  const ende = new RegExp(`^={1,${m[1]!.length}}[^=]`, 'm').exec(rest)
  return sauber(ende ? rest.slice(0, ende.index) : rest)
}

/** Text vor der ersten Überschrift, ohne Infobox und Vorspann-Vorlagen. */
export function einleitung(text: string): string {
  const kopf = text.split(/^==/m)[0] ?? ''
  return sauber(kopf)
}

/** Sätze eines Absatzes; schneidet an Satzzeichen vor Großbuchstaben oder Anführungszeichen, kurze Kürzel („Dr.“, „Nr.“) trennen nicht. */
export function saetze(text: string): string[] {
  const roh = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])(?<!\b(?:Dr|Nr|Vol|St|Mr|Mrs|Ms|vs|ca|bzw|z\.B|d\.h)\.)\s+(?=["„'A-ZÄÖÜ])/)
  return roh.map((s) => s.trim()).filter((s) => s.length > 20)
}

export function istWeiterleitung(text: string): string | undefined {
  return /^\s*#(?:redirect|weiterleitung)\s*:?\s*\[\[([^\]#|]+)/i.exec(text)?.[1]?.trim()
}

export function istBegriffsklaerung(text: string): boolean {
  return /\{\{\s*(?:disambiguation|disambig|dab|begriffsklärung|hndis|set index)/i.test(text) || /may refer to:|steht für:|bezeichnet:?\s*$/im.test(einleitung(text).slice(0, 400))
}

/** Handelt die Seite von Animation (Anime, Zeichentrick, Serie, Film)? Schützt vor geratenen Seiten, die etwas anderes meinen. */
export function istAnimationsSeite(text: string): boolean {
  if (istBegriffsklaerung(text)) return false
  const kopf = text.slice(0, 6000).toLowerCase()
  return /anime|manga|animat|zeichentrick|trickfilm|cartoon|fernsehserie|television series|tv series|web series|film series|animated|ona\b|ova\b/.test(kopf)
}

const INFOBOX_FELDER = /^\|[ \t]*(studio|director|regie|produktion|produktionsfirma|network|sender|first[ _]?aired|first|last|original[ _]?run|released|release|erstausstrahlung|premiere|runtime|laufzeit|episodes|episoden|folgen|länge|original[ _]?title|originaltitel|genre|media[ _]?type|type)[ \t]*=[ \t]*(.*)$/gim

function wert(v: string): string {
  const datum = v.replace(/\{\{\s*(?:start|film|end) date[^|}]*\|(\d{4})\|(\d{1,2})\|(\d{1,2})[^}]*\}\}/gi, '$1-$2-$3')
  return sauber(datum).replace(/\s+/g, ' ').trim()
}

/** Faktenfelder der Infobox (Studio, Regie, Termine, Folgen …) als Name → Wert; leere Werte entfallen. Felder in einer Zeile (`| a = | b = x`) werden getrennt. */
export function infobox(text: string): Record<string, string> {
  const raus: Record<string, string> = {}
  const zeilen = text.replace(/[ \t]\|[ \t]*(?=[\w ]+=)/g, '\n| ')
  for (const m of zeilen.matchAll(INFOBOX_FELDER)) {
    const w = wert(m[2]!)
    const name = m[1]!.toLowerCase().replace(/[\s_]+/g, '')
    if (w && !(name in raus)) raus[name] = w.slice(0, 160)
  }
  return raus
}
