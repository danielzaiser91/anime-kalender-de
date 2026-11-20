// Spaltenbreite des Panes je Oberfläche.
// Desktop setzt Proportionalschrift: dort passen gut 1,6 Zeichen je Spalte (Screenshot 11.10.2026); Terminal 1.
export const zeichenJeSpalte = (surface: string): number => (surface === 'terminal' ? 1 : 1.6)
