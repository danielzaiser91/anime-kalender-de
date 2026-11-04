import { schreibeEmpfehlung } from './13-10-empfehlung.ts'
import { schreibeCoverLuecken } from './13-11-cover-luecken.ts'

/** Alles, was aus den fertig geschriebenen Dateien in `public/data` folgt und danach entsteht (von `build.ts` nach dem Datensatz aufgerufen). */
export function schreibeAbgeleitete(): void {
  schreibeEmpfehlung()
  schreibeCoverLuecken()
}
