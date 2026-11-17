/** Termine, deren Titel weder im Hauptbestand noch bei den Cartoons (`cartoons.json`, negative IDs) steht. */
export function zaehleVerwaisteTermine(events: { titleId?: number }[], titelIds: Iterable<number>, cartoonIds: Iterable<number>): number {
  const bekannt = new Set([...titelIds, ...cartoonIds])
  return events.filter((e) => e.titleId && e.titleId !== -1 && !bekannt.has(e.titleId)).length
}
