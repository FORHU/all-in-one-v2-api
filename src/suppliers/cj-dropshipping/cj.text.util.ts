/**
 * CJ's older product titles sometimes carry text-escaping artifacts that
 * never got cleaned up on their end — a literal doubled `''` where a single
 * apostrophe was meant ("Women''s Dress"), or a stray straight double-quote
 * standing in for one ("Women"s Summer...", "Dress Women"S Chiffon...") —
 * confirmed against real imported titles from CJ's 2021-era catalog. Cleans
 * both without touching any other quoting in the title.
 *
 * Shared between ProductImportService's import/resync path and
 * CJDropshippingAdapter's preview normalizers so a product's title reads the
 * same whether you're previewing it before import or looking at it after.
 */
export function cleanCjText(text: string): string {
  return text.replace(/''/g, "'").replace(/(\w)"(s\b)/gi, "$1'$2");
}
