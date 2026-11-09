// Typ für `pipeline/*.ts`, die den Helfer nutzen.
export declare function sperreNetz(seiteOderKontext: { route: (muster: string, antwort: (r: any) => unknown) => Promise<unknown> }): Promise<string[]>
