/** Der Satz im Folgenbereich, wo die Synchro für die Serie belegt ist, aber keine Folge eine Flagge trägt. */
export const SERIENBELEG_HINWEIS = 'Die Synchro ist für die Serie belegt, nicht je Folge.'

/** Serienbeleg (`synchroBelegt`) ohne Folgenbeleg: keine einzige Folge ist deutsch geflaggt. Panel und Bestandswächter fragen hier. */
export function serienbelegOhneFolgenbeleg(belegt: boolean, folgen: number[], deutsch: (nr: number) => boolean): boolean {
  return belegt && folgen.length > 0 && !folgen.some(deutsch)
}
