"""Erzeugt web/src/fonts/unbounded-700-de.woff2: Unbounded 700, nur die Zeichen der Anzeigeschrift (Monats-/Wochentage, Zahlen, Logo, Überschriften).

Aufruf: python tools/schriften-teilmenge.py   (braucht fonttools + brotli; Quelle: node_modules/@fontsource/unbounded)
Die Zeichenliste steht auch als unicode-range in web/src/fonts.css; das Skript prüft nach, dass die Ausgabedatei genau diese Zeichen enthält.
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(WURZEL, 'node_modules/@fontsource/unbounded/files/unbounded-latin-700-normal.woff2')
ZIEL = os.path.join(WURZEL, 'web/src/fonts/unbounded-700-de.woff2')
# ASCII, geschütztes Leerzeichen, Ä Ö Ü ä ö ü ß, Gedankenstrich, Halbgeviertstrich, Apostroph, Auslassung, Mittelpunkt, Aufzählungspunkt
ZEICHEN = list(range(0x20, 0x7F)) + [0xA0, 0xC4, 0xD6, 0xDC, 0xDF, 0xE4, 0xF6, 0xFC, 0xB7, 0x2013, 0x2014, 0x2019, 0x2022, 0x2026]

optionen = subset.Options()
optionen.flavor = 'woff2'
optionen.layout_features = ['kern', 'liga', 'ccmp', 'locl']
optionen.name_IDs = [1, 2]
optionen.hinting = False
font = TTFont(QUELLE)
teiler = subset.Subsetter(optionen)
teiler.populate(unicodes=ZEICHEN)
teiler.subset(font)
font.flavor = 'woff2'
font.save(ZIEL)

vorhanden = sorted(TTFont(ZIEL).getBestCmap())
if vorhanden != sorted(ZEICHEN):
    fehlt = [hex(z) for z in sorted(set(ZEICHEN) - set(vorhanden))]
    print(f'Zeichen fehlen in der Quelle: {fehlt}', file=sys.stderr)
    sys.exit(1)
print(f'{ZIEL}: {os.path.getsize(ZIEL)} Bytes, {len(vorhanden)} Zeichen')
