import { test, expect } from 'claude-code/testing'

import { extrahiereLinks, loeseZiel, kurz, schalte, schneide, sortiere, sortiereJetzt, teile, zaehle, zaehleLive, zaehlePipeline, zaehleVonDir, zuLang } from './zaehlen'

const PIPE = `## In Pipeline

- [2026-10-10 14:00] **Spätere Zeile** — Ort: worker (Auslieferung offen)
- [2026-10-09 08:30] **Älteste Zeile, sehr alt** — Ort: Pipeline (Bestandsbau läuft)
- [2026-10-10 09:15] [klein] **Ohne Ort angegeben, lang genug** — irgendwas
- [2026-10-10 10:00] **Falscher Ort** — Ort: mars (x)
- [2026-10-10 11:00] **Nur Ort** — Ort: warteliste
- kein Zeitstempel **Weg** — Ort: deploy

## Anderes

- [2026-10-10 15:00] **Nicht hier** — Ort: deploy
`

test('In Pipeline: Parsen, Ort-Marke, Details; unbekannter/fehlender Ort = „?“; älteste zuerst; kein Ablauf nach Zeit', () => {
  const v = zaehlePipeline(PIPE)
  expect(v.map(e => [e.titel, e.ort, e.rest])).toEqual([
    ['Älteste Zeile, sehr alt', 'pipeline', 'Bestandsbau läuft'],
    ["Ohne Ort angegeben, lang genug", "?", ""],
    ['Falscher Ort', '?', 'x'],
    ['Nur Ort', 'warteliste', ''],
    ['Spätere Zeile', 'worker', 'Auslieferung offen'],
  ])
  expect(v[1]!.groesse).toBe('klein')
  expect(v[0]!.zeit).toBe(new Date(2026, 9, 9, 8, 30).getTime())
})

test('In Pipeline: leer oder ohne Abschnitt', () => {
  expect(zaehlePipeline('## In Pipeline\n\n## Feature\n')).toEqual([])
  expect(zaehlePipeline('# Stand\n')).toEqual([])
})

test('Daniel-Todo: nur „- “-Zeilen unter „## Daniel-Todo“, keine Nummern; ohne Unterabschnitt und Marke = Jetzt, heute', () => {
  const text = '## Daniel-Todo\n- **Mockup ansehen** ([Navigator](x)) — Vorher und Nachher\n\nKommt bald\n- Post-Center\n1. alte Nummer zählt nicht\n## Als Nächstes (Todo)\n- nicht\n'
  const v = zaehleVonDir(text)
  expect(v.jetzt.map(e => [e.titel, e.dringlichkeit])).toEqual([['Mockup ansehen (Navigator)', 'heute'], ['Post-Center', 'heute']])
  expect(v.spaeter).toEqual([])
})

test('Dringlichkeit: 🔴 dringend, 🟠 heute, 🔵 bald (ohne Marke heute); Marke vor Größenmarke; in Später keine Dringlichkeit', () => {
  const v = zaehleVonDir('## Daniel-Todo\n### Jetzt\n- 🔴 **Live falsch**\n- 🟠 **Heute dran**\n- 🔵 [klein] **Wenn Zeit ist**\n- **Ohne Marke**\n### Später\n- ⏳ **Warten**\n- **Ohne Icon**\n')
  expect(v.jetzt.map(e => [e.titel, e.dringlichkeit, e.groesse])).toEqual([
    ['Live falsch', 'dringend', 'normal'], ['Heute dran', 'heute', 'normal'], ['Wenn Zeit ist', 'bald', 'klein'], ['Ohne Marke', 'heute', 'normal'],
  ])
  expect(v.spaeter.map(e => [e.titel, e.icon, e.dringlichkeit])).toEqual([['Warten', 'wartet', undefined], ['Ohne Icon', undefined, undefined]])
})

test('sortiereJetzt: dringend vor heute vor bald, darin groß vor klein, sonst Dateireihenfolge', () => {
  const e = (titel: string, dringlichkeit: 'dringend' | 'heute' | 'bald', groesse: 'gross' | 'normal' | 'klein' = 'normal') => ({ titel, rest: '', groesse, links: [], dringlichkeit })
  const sortiert = sortiereJetzt([e('a', 'bald', 'gross'), e('b', 'heute', 'klein'), e('c', 'dringend', 'klein'), e('d', 'heute'), e('e', 'heute', 'gross'), e('f', 'dringend')])
  expect(sortiert.map(x => x.titel)).toEqual(['f', 'c', 'e', 'd', 'b', 'a'])
})

const DT = `## Daniel-Todo
### Jetzt
- 🔴 **rtk-Hook aus settings.json entfernen** — zweiter Block
### Später
- 📅 **16:15 Marronniers Folge 2 prüfen** — alle 30 Min
- ⏳ [klein] **Antwort des Impressum-Supports** — wartet
- 🚫 **Rechtsfrage Handlung** — blockiert
- 📅 **11.10. 09:00 Wiedervorlage Support** — Datum
- 📅 **08:00 Frühes Ding heute** — x
## In Arbeit
- a
`

test('Daniel-Todo: Jetzt/Später, Icon als Typ, Uhrzeit und Datum bei 📅, Größenmarke bleibt', () => {
  const v = zaehleVonDir(DT)
  expect(v.jetzt.map(e => e.titel)).toEqual(['rtk-Hook aus settings.json entfernen'])
  expect(v.spaeter.map(e => [e.titel, e.icon])).toEqual([
    ['16:15 Marronniers Folge 2 prüfen', 'kalender'],
    ['Antwort des Impressum-Supports', 'wartet'],
    ['Rechtsfrage Handlung', 'blockiert'],
    ['11.10. 09:00 Wiedervorlage Support', 'kalender'],
    ['08:00 Frühes Ding heute', 'kalender'],
  ])
  expect(v.spaeter[0]!.zeit).toEqual({ std: 16, min: 15 })
  expect(v.spaeter[3]!.zeit).toEqual({ tag: { tag: 11, monat: 10 }, std: 9, min: 0 })
  expect(v.spaeter[1]!.groesse).toBe('klein')
  expect(v.spaeter[1]!.zeit).toBeUndefined()
})

test('teile: Fälligkeit mit fester Uhrzeit, Später nach Zeit sortiert, ⏳/🚫 danach', () => {
  const v = zaehleVonDir(DT)
  const vor = teile(v, new Date(2026, 9, 10, 15, 48))
  // 08:00 ist überschritten → Jetzt; 16:15 und 11.10. bleiben, nach Zeit sortiert
  expect(vor.jetzt.map(e => [e.titel, !!e.faellig])).toEqual([['rtk-Hook aus settings.json entfernen', false], ['08:00 Frühes Ding heute', true]])
  expect(vor.jetzt.map(e => e.dringlichkeit)).toEqual(['dringend', 'heute'])
  expect(vor.spaeter.map(e => e.titel.split(' ')[0])).toEqual(['16:15', '11.10.', 'Antwort', 'Rechtsfrage'])

  const genau = teile(v, new Date(2026, 9, 10, 16, 15))
  expect(genau.jetzt.map(e => e.titel.split(' ')[0])).toEqual(['rtk-Hook', '08:00', '16:15'])
  expect(genau.jetzt[2]!.faellig).toBe(true)

  const morgen = teile(v, new Date(2026, 9, 11, 9, 0))
  expect(morgen.spaeter.map(e => e.titel.split(' ')[0])).toEqual(['16:15', 'Antwort', 'Rechtsfrage'])
  expect(morgen.jetzt.map(e => e.titel.split(' ')[0])).toEqual(['rtk-Hook', '08:00', '11.10.'])
})

const TEXT = `# Stand
## In Arbeit (2)
- eins
- zwei
  - eingerückt zählt nicht
- **Autonomer Modus** — aus
Fließtext
## Erledigt
- alt
## Als Nächstes (Todo)
- a
- b
- c
## Offen
- x
`

test('zählt nur die beiden Abschnitte, ohne den autonomen Modus', () => {
  const l = zaehle(TEXT)
  expect(l.inArbeit.map(e => e.titel)).toEqual(['eins', 'zwei'])
  expect(l.todo.length).toBe(3)
})

test('leere Datei ergibt null', () => {
  const l = zaehle('')
  expect(l.inArbeit.length + l.todo.length).toBe(0)
})

test('kurz: Markdown weg, am Gedankenstrich getrennt', () => {
  const e = kurz('**Prüfliste Rooster Fighter (Netflix)** — erst nach dem Bestandsbau möglich.')
  expect(e.titel).toBe('Prüfliste Rooster Fighter (Netflix)')
  expect(e.rest).toBe('erst nach dem Bestandsbau möglich.')
})

test('kurz: kurzer Vorsatz vor dem Doppelpunkt bleibt, Punkt am Ende fällt', () => {
  expect(kurz('Fahrplan 1: Wecker-Wache ausliefern und prüfen, Monatswache.').titel)
    .toBe('Fahrplan 1: Wecker-Wache ausliefern und prüfen, Monatswache')
})

test('kurz: Datum mit Punkt ist kein Satzende, Link wird zu seinem Text', () => {
  expect(kurz('**Impressum-Anschrift eintragen (Daniel, 10.10. 12:27)** — fertig.').titel)
    .toBe('Impressum-Anschrift eintragen (Daniel, 10.10. 12:27)')
  expect(kurz('Live-Messungen in [stand.md](stand.md).').titel).toBe('Live-Messungen in stand.md')
})

test('kurz: langer Titel bleibt ganz', () => {
  const t = kurz('Fahrplan 6 bis 9: Sammelartikel abbauen, Crunchyroll-Lineup lesen, Doppelbau verengen, Wiedervorlage nach Alter.').titel
  expect(t).toBe('Fahrplan 6 bis 9: Sammelartikel abbauen, Crunchyroll-Lineup lesen, Doppelbau verengen, Wiedervorlage nach Alter')
  expect(t).not.toContain('…')
})

test('zuLang: zählt Titel über 36 Zeichen', () => {
  const eintrag = (n: number) => ({ titel: 'x'.repeat(n), rest: '', groesse: 'normal' as const })
  const l = { inArbeit: [eintrag(37), eintrag(80)], todo: [eintrag(20)] }
  expect(zuLang(l, [])).toBe(2)
  expect(zuLang({ inArbeit: [], todo: [] }, [{ titel: 'x'.repeat(36), rest: '', groesse: 'normal' as const }])).toBe(0)
  expect(zuLang({ inArbeit: [], todo: [] }, [{ titel: 'x'.repeat(37), rest: '', groesse: 'normal' as const }])).toBe(1)
})

test('Größenmarken: [groß]/[klein] werden erkannt und aus dem Titel entfernt', () => {
  const l = zaehle('## In Arbeit\n- [groß] **Autonomer Plan für den Umbau** — x\n- [klein] **Label-Fix im Detail-Panel** — y\n- **Normaler Eintrag ohne Marke** — z\n')
  expect(l.inArbeit.map(e => [e.titel, e.groesse])).toEqual([
    ['Autonomer Plan für den Umbau', 'gross'], ['Label-Fix im Detail-Panel', 'klein'], ['Normaler Eintrag ohne Marke', 'normal'],
  ])
  const v = zaehleVonDir('## Daniel-Todo\n- [klein] **Nachfragen beim Support jetzt** — a\n')
  expect(v.jetzt[0]!.titel).toBe('Nachfragen beim Support jetzt')
  expect(v.jetzt[0]!.groesse).toBe('klein')
})

test('sortiere: groß, normal, klein; Dateireihenfolge innerhalb der Gruppe', () => {
  const e = (titel: string, groesse: 'gross' | 'normal' | 'klein') => ({ titel, rest: '', groesse, links: [] })
  const s = sortiere([e('k1', 'klein'), e('n1', 'normal'), e('g1', 'gross'), e('n2', 'normal'), e('g2', 'gross')])
  expect(s.map(x => x.titel)).toEqual(['g1', 'g2', 'n1', 'n2', 'k1'])
})

test('loeseZiel: relativ gegen daniel-zum-abarbeiten, file-URL, C:/, C:\\, https, Anker', () => {
  const B = 'C:\\code\\ai\\anime-kalender-de\\daniel-zum-abarbeiten\\'
  expect(loeseZiel('berichte/x.md')).toEqual({ href: 'file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/x.md', pfad: B + 'berichte\\x.md' })
  expect(loeseZiel('file:///C:/a%20b/c.md')).toEqual({ href: 'file:///C:/a%20b/c.md', pfad: 'C:\\a b\\c.md' })
  expect(loeseZiel('C:/a b/c.md')).toEqual({ href: 'file:///C:/a%20b/c.md', pfad: 'C:\\a b\\c.md' })
  expect(loeseZiel('C:\\a\\c.md')?.href).toBe('file:///C:/a/c.md')
  expect(loeseZiel('https://x.de/p?q=1')).toEqual({ href: 'https://x.de/p?q=1', pfad: 'https://x.de/p?q=1' })
  expect(loeseZiel('https://x.de/#/datenbank?q=a')?.href).toBe('https://x.de/#/datenbank?q=a')
  expect(loeseZiel('berichte/x.md#kopf')?.pfad).toBe(B + 'berichte\\x.md')
  expect(loeseZiel('#anker')).toBeNull()
})

test('extrahiereLinks: Markdown, nackte URL und Pfad, ohne Doppelte und ohne Satzzeichen am Ende', () => {
  const v = extrahiereLinks('Siehe [Bericht](berichte/x.md), https://example.org/a. und C:/code/ai/y.md; nochmal [Bericht 2](berichte/x.md)')
  expect(v.map(x => x.href)).toEqual([
    'file:///C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/berichte/x.md',
    'https://example.org/a',
    'file:///C:/code/ai/y.md',
  ])
  expect(v[0]!.label).toBe('Bericht')
})

const LIVE = `## Neu und live testbar
- [2026-10-10 12:00] Wochenstart statt „Alle Folgen“ — [Seite](https://anime-kalender.de/)
- [2026-10-09 09:00] Neuere Zeile von gestern — [Link](https://anime-kalender.de/x)
- [2026-10-08 11:59] Älter als 2 Tage
- ohne Zeitstempel
- [2026-13-45 99:99] ungültig
## Feature
- [2026-10-10 13:00] steht im falschen Abschnitt
`

test('Live: Filter auf 2 Tage, neueste zuerst, ohne gültigen Zeitstempel nicht anzeigen, Link bleibt', () => {
  const v = zaehleLive(LIVE, new Date(2026, 9, 10, 12, 0))
  expect(v.map(e => e.titel)).toEqual(['Wochenstart statt „Alle Folgen“', 'Neuere Zeile von gestern'])
  expect(v[0]!.links[0]!.href).toBe('https://anime-kalender.de/')
  // genau 2 Tage alt bleibt, eine Minute mehr nicht
  expect(zaehleLive(LIVE, new Date(2026, 9, 10, 12, 0)).length).toBe(2)
  expect(zaehleLive(LIVE, new Date(2026, 9, 11, 9, 0)).map(e => e.titel)).toEqual(['Wochenstart statt „Alle Folgen“', 'Neuere Zeile von gestern'])
  expect(zaehleLive(LIVE, new Date(2026, 9, 11, 9, 1)).map(e => e.titel)).toEqual(['Wochenstart statt „Alle Folgen“'])
})

test('Live: leerer oder fehlender Abschnitt ergibt nichts', () => {
  expect(zaehleLive('## Neu und live testbar\n\n## Feature\n', new Date())).toEqual([])
  expect(zaehleLive('# Stand\n', new Date())).toEqual([])
})

test('schneide: bis 5 alles, darüber 5 und Rest versteckt; aufgeklappt alles; max 0 = zu', () => {
  const sieben = [1, 2, 3, 4, 5, 6, 7]
  expect(schneide([1, 2, 3, 4, 5], 'x', [])).toEqual({ sichtbar: [1, 2, 3, 4, 5], versteckt: 0, kuerzbar: false, offen: false })
  expect(schneide(sieben, 'x', [])).toEqual({ sichtbar: [1, 2, 3, 4, 5], versteckt: 2, kuerzbar: true, offen: false })
  expect(schneide(sieben, 'x', ['x']).sichtbar).toEqual(sieben)
  expect(schneide(sieben, 'x', ['y']).sichtbar).toHaveLength(5)
  expect(schneide([1, 2], 'k', [], 0)).toMatchObject({ sichtbar: [], versteckt: 2, kuerzbar: true })
  expect(schneide([], 'k', [], 0).kuerzbar).toBe(false)
})

test('schalte: schaltet eine Kennung ein und aus, andere bleiben', () => {
  expect(schalte(['a'], 'b')).toEqual(['a', 'b'])
  expect(schalte(['a', 'b'], 'a')).toEqual(['b'])
})
