// Typen für den Teil, den `pipeline/check-episodentitel.ts` nutzt.
export declare function regeln(wurzel?: string): {
  erweitert: boolean
  vertrauen: Record<string, unknown>
  ausblenden: string[]
  stichprobe: Set<string>
}
