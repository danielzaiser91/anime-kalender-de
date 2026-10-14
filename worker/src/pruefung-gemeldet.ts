/**
 * **Welche Folgen einer Adresse im Briefkasten stehen** — Antwort von `?gemeldet=<Adresse>`.
 *
 * Aus `pruefung-lesen.ts` ausgelagert (12.10.2026), unverändert.
 */
import { type Env } from './env.ts'
import { gemeldetAusTitelzeile } from './titelzeile-lesen.ts'

export async function leseGemeldet(env: Env, fuer: string) {
  /*
    **Nummer und Staffel gehören zusammen.**

    Der erste Anlauf gab nur die Folgennummern zurück. Bei Beyblade X waren
    S1E1-15 gemeldet — und weil jede Staffel bei Disney+ ab 1 zählt, hielt
    die Erweiterung damit auch S2E1-15 für erledigt und übersprang sie.
    Im Briefkasten landete Staffel 1 vollständig und Staffel 2 erst ab Folge
    16.

    `nummern` bleibt für die Netflix-Seite, die eine durchlaufende Zählung
    hat; `paare` ist die genauere Auskunft.
  */
  /*
    **Mit Datum der letzten Meldung**. Die Erweiterung zeigt je Folge genau einen Zustand, und
    „gemeldet" trägt sein Datum — auch für Folgen, die eine Stichprobe
    abgeleitet hat: Sie gehen als eigene Meldung ein und gelten wie gemessene.
  */
  /*
    `folge` ist bei Netflix die Kennung aus `/watch/<id>` — Player und
    Durchlauf schicken beide sie. Damit trifft die Erweiterung eine Folge
    exakt, ohne die Staffel zu kennen, und lernt nebenbei, welche Staffel
    auf der Titelseite geladen ist. `staffelBekannt` trennt eine gemeldete
    Staffel vom Ersatzwert 1, den `staffel` seit jeher trägt.
  */
  /* Eine Adresse mit Titelzeile (Migration 055) antwortet aus dieser einen Zeile; ihre Altzeilen in `pruefung` zählen nicht mehr. */
  const ausTitelzeile = await gemeldetAusTitelzeile(env, fuer)
  if (ausTitelzeile) return ausTitelzeile
  const { results } = await env.DB.prepare(
    `SELECT folge_nr, staffel, folge, MAX(gemeldet_am) AS am FROM pruefung
     WHERE url = ? AND folge_nr IS NOT NULL GROUP BY folge_nr, staffel, folge`,
  )
    .bind(fuer)
    .all<{ folge_nr: number; staffel: number | null; folge: string | null; am: string | null }>()
  const nummern = [...new Set((results ?? []).map((r) => r.folge_nr))]
  const paare = (results ?? []).map((r) => ({
    nummer: r.folge_nr,
    staffel: r.staffel ?? 1,
    staffelBekannt: r.staffel != null,
    folge: r.folge,
    am: r.am,
  }))
  return { nummern, paare }
}
