---
name: gleicher-effekt-weniger-aufwand
description: "Bei Code, der sucht, filtert, zählt oder vergleicht: bei gleichem Ergebnis die sparsamere Bauweise (Set statt Array-Suche, früher Abbruch, keine Liste vorab), mit Messzahlen."
---

# Gleicher Effekt, weniger Aufwand — das ist die Vorgabe, nicht die Kür

Daniel am 26.08.2026, nachdem eine Messung zwölffachen Unterschied gezeigt hatte: „solche
clean code / performance orientierte implementierung (selber effekt, viel besser aus
performance sicht) sollten immer die go-to lösung für alle implementierungen immer sein."

**Die Regel ist eng und deshalb tragfähig:** Wo zwei Bauweisen **dasselbe Ergebnis** liefern
und eine davon weniger Arbeit macht, wird die sparsame genommen — ohne Abwägung, ohne
Messung, ohne „erst mal einfach halten". Sie ist meist auch die kürzere und klarere.

Das ist **kein** Auftrag, alles zu optimieren. Wo das Ergebnis sich unterscheidet, wo die
sparsame Fassung schwerer zu lesen ist, oder wo es um zehn Einträge geht, gilt der Abschnitt
„Wo nicht" am Ende.

## Die drei Muster, mit gemessenen Zahlen

### 1. Kein Array bauen, bevor gefragt wird

Der teuerste Fehler sieht harmlos aus: erst sammeln, dann prüfen.

```js
// teuer: das Array ist fertig, bevor die erste Frage gestellt wird
const alle = []
for (const st of staffeln) for (let n = 0; n < st.folgen; n++) alle.push(kuerzel(st, n))
return alle.every((k) => erledigt.includes(k))

// sparsam: in der Schleife fragen, beim ersten Nein zurück
for (const st of staffeln) {
  for (let n = 0; n < st.folgen; n++) {
    if (!abgehakt.has(kuerzel(st, n))) return false
  }
}
```

`every` bricht selbst beim ersten `false` ab — das ist nicht der Punkt. Der Punkt ist das
Array davor: **bei 1.175 Folgen 1.175 Zeichenketten, bevor die Prüfung beginnt.**

### 2. Set statt Array, sobald mehr als einmal gesucht wird

```js
erledigt[id].includes(kuerzel)   // linear: bei 1.175 Einträgen 1.175 Vergleiche
abgehakt.has(kuerzel)            // konstant
```

Gemessen an 1.175 Folgen, alles gemeldet (der teure Fall, weil beide Fassungen durchlaufen):

| Fassung | 50 Aufrufe |
|---|---|
| Array bauen, `every` mit `includes` | **61 ms** |
| `Set`, in der Schleife fragen, Abbruch | **5 ms** |

Zwölffach, und der Gewinn steckt fast vollständig im `Set`: 1.175 × 1.175 sind über eine
Million Vergleiche für eine Frage, die in konstanter Zeit geht.

**Die Faustregel:** Wird eine Liste mehr als einmal durchsucht, wird sie einmal zu einem `Set`
oder einer `Map` — und zwar dort, wo sie entsteht, nicht bei jedem Zugriff neu.

### 3. Beim ersten Nein zurückkehren

`some`, `find`, `return` in der Schleife — alles besser als vollständig durchlaufen und am
Ende entscheiden. Das gilt auch dann, wenn die Liste heute kurz ist: Wer weiß, was in einem
Jahr darin steht.

## Die Prüffragen vor jeder Schleife

1. **Baue ich hier etwas auf, das ich nur einmal durchsuche?** Dann in der Schleife fragen.
2. **Suche ich mehr als einmal in derselben Liste?** Dann `Set` oder `Map`.
3. **Kann die Antwort vor dem Ende feststehen?** Dann dort zurückkehren.
4. **Wie groß wird das im schlechtesten Fall?** Nicht „wie groß ist es heute" — die
   Amazon-Erweiterung lief mit zwölf Folgen gut und mit 1.175 nicht mehr.

## Wo nicht

- **Wenn sich das Ergebnis unterscheidet.** Dann ist es keine Optimierung, sondern eine
  andere Funktion. Erst das Richtige, dann das Schnelle.
- **Wenn die sparsame Fassung schwerer zu lesen ist** und es um Größenordnungen geht, die
  niemand spürt. Ein `Set` für drei Einträge ist Ballast.
- **Bevor gemessen wurde, welcher Teil überhaupt kostet.** Die Reihenfolge bleibt: erst der
  Profiler, dann der Umbau — außer bei den drei Mustern oben, die kosten nichts an Klarheit
  und sind deshalb immer richtig.
- **In Prüfungen und Messskripten.** Dort zählt Lesbarkeit, nicht Tempo.

## Warum das gerade hier zählt

Diese Regel entstand an einer Browser-Erweiterung, die viermal je Sekunde läuft, auf Seiten
mit über tausend Folgen, in Daniels laufendem Browser. Was je Takt eine Liste aufbaut, um sie
einmal zu durchsuchen, **zahlt den Aufbau immer und den Nutzen selten** — und der Preis ist
nicht Rechenzeit auf einem Server, sondern eine ruckelnde Seite.

Derselbe Gedanke steht projektbezogen in `anime-kalender-de/extension/PERFORMANCE.md`, mit den
Stellen, die dort teuer aussehen und keine sind.
