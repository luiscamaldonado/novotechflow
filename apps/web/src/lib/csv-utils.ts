/**
 * Shared CSV utilities for encoding detection and character fixing.
 *
 * CSVs exported from Excel on Windows typically use Latin-1/Windows-1252
 * encoding. When read as UTF-8, accented characters (á, é, í, ó, ú, ñ)
 * appear as mojibake. These utilities detect and correct this automatically.
 */

/**
 * Maps common mojibake sequences (Latin-1 read as UTF-8) back to the
 * correct Spanish characters.
 */
const ENCODING_REPLACEMENTS: readonly [string, string][] = [
  ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã\u00AD', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
  ['Ã±', 'ñ'], ['Ã\u0091', 'Ñ'],
  ['Ã\u0081', 'Á'], ['Ã\u0089', 'É'], ['Ã\u008D', 'Í'], ['Ã\u0093', 'Ó'], ['Ã\u009A', 'Ú'],
  ['Ã¼', 'ü'], ['Ã\u009C', 'Ü'],
];

/**
 * Fixes residual mojibake characters that may remain after encoding detection.
 * Replaces known broken sequences with their correct Unicode counterparts.
 */
export function fixBrokenEncoding(text: string): string {
  let result = text;
  for (const [broken, fixed] of ENCODING_REPLACEMENTS) {
    result = result.replaceAll(broken, fixed);
  }
  return result;
}

/**
 * Reads a file as raw bytes and decodes with the correct encoding.
 * Uses `TextDecoder('utf-8', { fatal: true })` which throws on invalid
 * byte sequences — if it fails, the file is decoded as Windows-1252
 * (the encoding Excel uses on Windows).
 * Applies `fixBrokenEncoding` as a final safety net.
 */
export function readFileWithEncoding(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(buffer);

      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      try {
        const utf8Text = utf8Decoder.decode(bytes);
        resolve(fixBrokenEncoding(utf8Text));
      } catch {
        const latin1Decoder = new TextDecoder('windows-1252');
        const latin1Text = latin1Decoder.decode(bytes);
        resolve(fixBrokenEncoding(latin1Text));
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
