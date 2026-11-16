import { sanitizeOutput, StreamOutputGuard } from './output-guard';

function run(guard: StreamOutputGuard, deltas: string[]): string {
  let out = '';
  for (const delta of deltas) out += guard.push(delta);
  return out + guard.flush();
}

describe('StreamOutputGuard', () => {
  const canary = 'DM-0123456789abcdef';

  it('passes normal text through unchanged', () => {
    const guard = new StreamOutputGuard(canary);
    const text =
      'The policy allows 20 vacation days per year [1]. Requests need manager approval [2].';
    expect(run(guard, text.match(/.{1,5}/g)!)).toBe(text);
    expect(guard.compromised).toBe(false);
  });

  it('withholds the canary even when split across tokens', () => {
    const guard = new StreamOutputGuard(canary);
    const out = run(guard, [
      'My internal reference is ',
      'DM-0123',
      '456789',
      'abcdef',
      ' ok',
    ]);
    expect(out).not.toContain('DM-0123456789abcdef');
    expect(guard.compromised).toBe(true);
  });

  it('redacts credential-shaped strings', () => {
    expect(
      sanitizeOutput('key: sk-proj-abcdefghijklmnopqrstuvwxyz123456'),
    ).toBe('key: [REDACTED]');
  });
});
