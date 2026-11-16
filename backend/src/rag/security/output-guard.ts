// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

/**
 * OWASP LLM02/LLM06 streaming output guard.
 *
 * Holds back a small tail of the stream so a secret or the system-prompt
 * canary can be detected before any part of it reaches the client, redacts
 * credential-shaped strings, and strips terminal control characters.
 */
export class StreamOutputGuard {
  private pending = '';
  private tripped = false;
  private readonly holdBack: number;

  constructor(private readonly canary: string) {
    this.holdBack = Math.max(canary.length, 64);
  }

  get compromised(): boolean {
    return this.tripped;
  }

  push(delta: string): string {
    if (this.tripped) return '';
    this.pending += delta;
    if (this.pending.includes(this.canary)) {
      this.tripped = true;
      this.pending = '';
      return '';
    }
    if (this.pending.length <= this.holdBack) return '';

    // Only release up to the last whitespace so redaction never splits a token.
    const releasable = this.pending.length - this.holdBack;
    const space = this.pending.lastIndexOf(' ', releasable);
    const cut =
      space > 0
        ? space
        : this.pending.length > this.holdBack * 4
          ? releasable
          : 0;
    if (cut <= 0) return '';
    const safe = this.pending.slice(0, cut);
    this.pending = this.pending.slice(cut);
    return sanitizeOutput(safe);
  }

  flush(): string {
    if (this.tripped) return '';
    const rest = this.pending;
    this.pending = '';
    if (rest.includes(this.canary)) {
      this.tripped = true;
      return '';
    }
    return sanitizeOutput(rest);
  }
}

export function sanitizeOutput(text: string): string {
  let out = text.replace(CONTROL_CHARS, '');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}
