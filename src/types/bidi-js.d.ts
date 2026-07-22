declare module 'bidi-js' {
  export interface EmbeddingLevelsResult {
    levels: Uint8Array
    paragraphs: Array<{ start: number; end: number; level: number }>
  }

  export interface BidiApi {
    getEmbeddingLevels(text: string, baseDirection?: 'ltr' | 'rtl' | 'auto'): EmbeddingLevelsResult
    /** Note: takes the raw `levels` array, not the `getEmbeddingLevels` result object. */
    getMirroredCharactersMap(
      text: string,
      levels: Uint8Array,
      start?: number,
      end?: number,
    ): Map<number, string>
  }

  export default function bidiFactory(): BidiApi
}
