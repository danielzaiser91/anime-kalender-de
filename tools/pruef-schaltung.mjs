/**
 * Die eine Stelle, die entscheidet, ob die Prüfliste „erweitert“ (Cartoons zugeschaltet) ist:
 * `PRUEFLISTE_ERWEITERT=1` schaltet zu, `=0` ab, sonst entscheidet `erweitert` der Regeldatei.
 */
export function istErweitert(umgebung, regelDatei) {
  if (umgebung === '1') return true
  if (umgebung === '0') return false
  return regelDatei?.erweitert === true
}
