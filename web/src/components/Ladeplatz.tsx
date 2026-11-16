/** Platzhalter für eine nachladende Ansicht; der Fuß bleibt unsichtbar (styles.css), solange er steht, sonst springt er beim Füllen aus dem Bild. */
export function Ladeplatz() {
  return <div className="min-h-[60vh]" data-ladeplatz aria-hidden />
}
