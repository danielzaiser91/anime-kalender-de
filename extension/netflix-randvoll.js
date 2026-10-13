/* global randMelden:readonly */
/*
  **Uneinheitliche Randprobe: im Sammeldurchgang misst die Erweiterung alle Folgen** (4.30.0, 12.10.2026) —
  eigene Datei, weil `melder.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor `melder.js`.

  Anlass (Daniel, 12.10.2026, Netflix 80174608): Folge 1 deutsch, Folge 9 nicht. Der Durchgang setzte
  `randOffen`, warnte und wartete auf eine Grenze im Feld; der Titel blieb ohne Meldung. Im Sammeldurchgang
  wartet niemand davor. Also bekommt der nächste Anlauf desselben Titels `vollLauf` und misst jede Folge
  (`durchlaufStarten` liest den Merker einmal und macht dann keine Randprobe). Gemeldet wird, was gemessen
  ist: eine Folge ohne Deutsch geht als „kein Deutsch" raus, nichts wird angenommen.

  **Gesendet wird gesammelt** (4.30.1): Ein Einzel-POST je Folge ließ den Worker bei jeder Meldung alle Zeilen
  der Adresse lesen (`ladeOffeneHashes`) — das Lesen wuchs quadratisch, und D1-Lesen ist der Engpass. Jetzt
  gehen die Ergebnisse nach (Deutsch, Tonspuren) gruppiert über `randMelden` raus, zehn je Stapel. Tageslimit
  und 5xx-Pause (`tageslimit.js`) setzen über `randMelden` `abbruch`; die weiteren Gruppen entfallen dann.

  Von Hand gestartet (kein Sammeldurchgang) bleibt es beim Hinweis und dem Grenzfeld.
*/
globalThis.akNetflixRandUneinheitlich = (D, reihe, sammeln, erste, letzte) => {
  const urteil = (r) => `Folge ${r.folge.nummer} ${r.deutsch ? 'deutsch' : 'nicht deutsch'}`
  if (sammeln) {
    D.randOffen = null
    D.vollLauf = String(reihe)
    console.info(`[Anime-Kalender] ${urteil(erste)}, ${urteil(letzte)} — alle ${D.randprobe.length} Folgen werden einzeln geprüft.`)
    return
  }
  D.randOffen = { folgen: D.randprobe, erste, letzte }
  console.warn(`[Anime-Kalender] ${urteil(erste)}, ${urteil(letzte)} — nichts gemeldet. Grenze im Feld unten eintragen.`)
}

/**
 * Der volle Lauf meldet, was er gemessen hat: je (Deutsch, Tonspuren) eine Gruppe, je Gruppe Stapel zu zehn
 * (`randMelden`). Nach einem Abbruch (Limit, Worker bestätigt nichts) folgt keine weitere Gruppe.
 */
globalThis.akNetflixVollMelden = async (D) => {
  const gruppen = new Map()
  for (const r of D.randErgebnis ?? []) {
    const schluessel = `${r.deutsch}|${r.echte.map((x) => x.code).sort().join(',')}`
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), r])
  }
  for (const gruppe of gruppen.values()) {
    const folgen = gruppe.map((r) => r.folge).sort((a, b) => a.nummer - b.nummer)
    akRandAusfall(D, await randMelden(folgen, gruppe[0], null, folgen.map((f) => f.nummer)))
    if (D.abbruch) break
  }
}

/**
 * Die Notiz einer Randprobe-Meldung. `bisNummer == null` heißt: Der volle Lauf hat alle Folgen gemessen.
 * Dort darf „ANGENOMMEN" nicht stehen — Worker und `fetch-urteile.ts` machen daraus sonst eine Annahme.
 */
globalThis.akNetflixRandNotiz = (folgen, bisNummer, f, staffelLabel, gemessen = false) => {
  const wo = (f.titel ? ` — Folge ${f.nummer}: ${f.titel}` : '') + (staffelLabel ? ` — Netflix: ${staffelLabel}` : '')
  if (bisNummer == null) return `Gemessen im vollen Lauf${wo}`
  const rand = `gemessen: Folge ${folgen[0].nummer} und ${bisNummer}, dazwischen nicht geprüft${wo}`
  /* Die zwei Randfolgen sind gemessen: ohne das Wort ANGENOMMEN, das Leser der Notiz zur Annahme machen. */
  return gemessen ? `Gemessen in der Randprobe — ${rand}` : `ANGENOMMEN aus Randprobe — ${rand}`
}
