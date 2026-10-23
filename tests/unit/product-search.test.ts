import { buildSearchCondition } from '../../src/modules/catalog/product.repository';

const termClause = (term: string) => ({
  OR: [
    { title: { contains: term, mode: 'insensitive' } },
    { brand: { contains: term, mode: 'insensitive' } },
  ],
});

describe('buildSearchCondition', () => {
  it('returns null for a missing or blank query, so no filter is applied', () => {
    expect(buildSearchCondition(undefined)).toBeNull();
    expect(buildSearchCondition('')).toBeNull();
    expect(buildSearchCondition('   ')).toBeNull();
  });

  it('matches a single word against title or brand, case-insensitively', () => {
    expect(buildSearchCondition('keyboard')).toEqual({ AND: [termClause('keyboard')] });
  });

  it('requires every word to match (AND), so extra words narrow the results', () => {
    expect(buildSearchCondition('  wireless   keyboard ')).toEqual({
      AND: [termClause('wireless'), termClause('keyboard')],
    });
  });

  it('ignores words beyond the first five', () => {
    const condition = buildSearchCondition('a b c d e f g');
    expect(condition?.AND).toHaveLength(5);
    expect(condition).toEqual({ AND: ['a', 'b', 'c', 'd', 'e'].map(termClause) });
  });
});
