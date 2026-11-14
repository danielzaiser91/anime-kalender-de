/**
 * Zusicherungen zu `lib/offiziell-html.ts` unterhalb von `lese('html', …)` (das prüft `check-offizielle-news.ts`): Baum aus
 * nachsichtigem HTML, Textstücke, Überschriftwahl und die Grenzen von `leseHtml` (Länge, Adressen). Läuft in `check:logic`.
 */
import { baum, leseHtml, texte, ueberschrift, type Knoten } from './lib/offiziell-html.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

/** Der Baum als kurze Zeichenkette: `name(kinder)`, Text in Anführungszeichen. */
const form = (k: Knoten | string): string => (typeof k === 'string' ? JSON.stringify(k) : `${k.name}(${k.kinder.map(form).join(',')})`)

pruefe('leere Eingabe', form(baum('')), '#()')
pruefe('verschachtelt', form(baum('<div><p>a</p>b</div>')), '#(div(p("a"),"b"))')
pruefe('li schließt das offene li', form(baum('<ul><li>a<li>b</ul>')), '#(ul(li("a"),li("b")))')
pruefe('leere Elemente und /> öffnen nichts', form(baum('<p>a<br>b<img src=x><span/>c</p>')), '#(p("a",br(),"b",img(),span(),"c"))')
pruefe('Schließen ohne Öffnen wird übergangen', form(baum('<p>a</div>b</p>c')), '#(p("a","b"),"c")')
pruefe('Schließen eines äußeren Elements schließt die inneren', form(baum('<div><span>a</div>b')), '#(div(span("a")),"b")')
pruefe('script, style, Kommentar und head fallen weg', form(baum('<head><title>2026.01.01</title></head><!-- 2026.02.02 --><script>x</script><style>y</style><p>z</p>')), '#(p("z"))')
pruefe('einzelnes „<“ bleibt Text', form(baum('a < b')), '#("a ","<"," b")')
pruefe('Attribute: Groß/klein, Anführungszeichen, ohne Wert, Entities', (baum(`<a HREF="/x?a=1&amp;b=2" data-k='v' hidden id=k1>`).kinder[0] as Knoten).attrs, {
  href: '/x?a=1&b=2',
  'data-k': 'v',
  hidden: '',
  id: 'k1',
})
{
  const w = baum('<p><b>x</b></p>')
  const p = w.kinder[0] as Knoten
  pruefe('Eltern zeigen nach oben', [p.eltern === w, (p.kinder[0] as Knoten).eltern === p, w.eltern], [true, true, undefined])
}

pruefe('texte: bereinigt Leerraum und &nbsp;, leere Stücke fallen weg', texte(baum('<p> a&nbsp;\n b <span>  </span>c</p>')), ['a b', 'c'])
pruefe('texte: <time> ohne sichtbares Datum liefert datetime', texte(baum('<time datetime="2026-08-15">8/15</time>')), ['2026-08-15', '8/15'])
pruefe('texte: <time> mit sichtbarem Datum nicht doppelt', texte(baum('<time datetime="2026-08-15">2026.08.15</time>')), ['2026.08.15'])

const link = (html: string) => baum(html).kinder[0] as Knoten
pruefe('Überschrift aus dem Link, ohne Datum und Rubrik', ueberschrift(link('<a href="/n">2026.10.12 <b>NEWS</b> Neue Staffel</a>'), []), 'Neue Staffel')
pruefe('Link zu kurz: längstes Stück des Umschlags', ueberschrift(link('<a href="/n">→</a>'), [link('<li>2026.10.12 <span>お知らせ</span><p>Kurz</p><p>Die längere Überschrift</p></li>')]), 'Die längere Überschrift')
pruefe('ohne Link und Umschlag leer', ueberschrift(undefined, []), '')

pruefe('leseHtml: leere Seite', leseHtml('', 'https://x.example/'), [])
pruefe('leseHtml: Überschrift unter 4 Zeichen entfällt', leseHtml('<li>2026.10.12 <a href="/a">Neu</a></li>', 'https://x.example/'), [])
pruefe('leseHtml: Überschrift auf 200 Zeichen gekürzt', leseHtml(`<li>2026.10.12 <a href="/a">${'x'.repeat(250)}</a></li>`, 'https://x.example/')[0]?.titel.length, 200)
pruefe('leseHtml: javascript:-Link ergibt die Adresse der Liste', leseHtml('<li>2026.10.12 <a href="javascript:void(0)">Neue Staffel</a></li>', 'https://x.example/news/')[0]?.url, 'https://x.example/news/')
pruefe('leseHtml: mailto ist kein Link', leseHtml('<li>2026.10.12 <a href="mailto:a@b.example">Neue Staffel</a></li>', 'https://x.example/'), [])
pruefe('leseHtml: relative Adresse und Entities im Titel', leseHtml('<li><span>2026.10.12</span><a href="../a?x=1">Tom &amp; Jerry kommen</a></li>', 'https://x.example/news/'), [
  { titel: 'Tom & Jerry kommen', datum: '2026-10-12', url: 'https://x.example/a?x=1' },
])
pruefe('leseHtml: zwei Daten in Geschwistern: das erste ohne eigenen Link entfällt', leseHtml('<li><span>2026.10.12</span><span>2026.10.13</span><a href="/a">Neue Staffel</a></li>', 'https://x.example/'), [{ titel: 'Neue Staffel', datum: '2026-10-13', url: 'https://x.example/a' }])

if (fehler) process.exit(1)
console.log('check-offiziell-html: ok')
