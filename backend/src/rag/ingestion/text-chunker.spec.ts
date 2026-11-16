import { chunkPages } from './text-chunker';

describe('chunkPages', () => {
  const sentence =
    'Employees accrue one and a half vacation days per month of service. ';
  const longPage = sentence.repeat(40);

  it('produces ~600 character chunks with overlap and page metadata', () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: longPage },
      { pageNumber: 2, text: 'Short second page about sick leave.' },
    ]);

    const pageOne = chunks.filter((c) => c.pageNumber === 1);
    expect(pageOne.length).toBeGreaterThan(3);
    for (const chunk of pageOne)
      expect(chunk.content.length).toBeLessThanOrEqual(600);

    // Consecutive chunks overlap.
    const tailOfFirst = pageOne[0].content.slice(-60);
    expect(pageOne[1].content.includes(tailOfFirst.slice(-30).trim())).toBe(
      true,
    );

    expect(chunks.at(-1)).toMatchObject({
      pageNumber: 2,
      content: 'Short second page about sick leave.',
    });
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });

  it('skips empty pages', () => {
    expect(chunkPages([{ pageNumber: 1, text: '   \n ' }])).toEqual([]);
  });

  it('joins words hyphenated across line breaks', () => {
    const [chunk] = chunkPages([
      { pageNumber: 1, text: 'The reimburse-\nment policy applies to travel.' },
    ]);
    expect(chunk.content).toContain('reimbursement');
  });
});
