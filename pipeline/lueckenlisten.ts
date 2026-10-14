import { todayIso } from '../shared/time.ts'
import { schreibeLueckenListen } from './lib/luecken-schreiben.ts'

/** Schreibt die Lückenlisten je Feld nach `daniel-zum-abarbeiten/listen/luecken/` (lokal, nicht im Repo). Aufruf: `npm run data:lueckenlisten`, nach dem Bestandsbau. */
schreibeLueckenListen(todayIso())
