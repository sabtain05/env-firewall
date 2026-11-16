import { ValidationIssue } from './types';

const supportsColor = Boolean(
  process.stdout?.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb'
);

const ansi = {
  reset: supportsColor ? '\x1b[0m' : '',
  bold: supportsColor ? '\x1b[1m' : '',
  dim: supportsColor ? '\x1b[2m' : '',
  red: supportsColor ? '\x1b[31m' : '',
  green: supportsColor ? '\x1b[32m' : '',
  yellow: supportsColor ? '\x1b[33m' : '',
  cyan: supportsColor ? '\x1b[36m' : '',
  bgRed: supportsColor ? '\x1b[41m\x1b[37m' : '',
};

export class EnvFirewallError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(formatValidationIssues(issues));
    this.name = 'EnvFirewallError';
    this.issues = issues;
    Object.setPrototypeOf(this, EnvFirewallError.prototype);
  }
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  const header = `\n${ansi.bgRed}${ansi.bold} ENV FIREWALL BLOCKED BOOT ${ansi.reset} ${ansi.red}${ansi.bold}${issues.length} environment configuration ${issues.length === 1 ? 'issue' : 'issues'} detected:${ansi.reset}\n`;

  const body = issues
    .map((issue, idx) => {
      const badge =
        issue.reason === 'MISSING'
          ? `${ansi.red}[MISSING]${ansi.reset}`
          : issue.reason === 'OUT_OF_SYNC'
          ? `${ansi.yellow}[OUT OF SYNC]${ansi.reset}`
          : `${ansi.yellow}[${issue.reason}]${ansi.reset}`;

      const receivedDisplay =
        issue.received === undefined
          ? `${ansi.dim}<undefined>${ansi.reset}`
          : `${ansi.red}"${issue.received}"${ansi.reset}`;

      return [
        `  ${ansi.bold}${idx + 1}. ${ansi.cyan}${issue.key}${ansi.reset} ${badge}`,
        `     ${ansi.dim}Expected:${ansi.reset} ${ansi.green}${issue.expected}${ansi.reset}`,
        `     ${ansi.dim}Received:${ansi.reset} ${receivedDisplay}`,
        `     ${ansi.bold}How to fix:${ansi.reset} ${issue.fixHint}`,
      ].join('\n');
    })
    .join('\n\n');

  const footer = `\n${ansi.dim}────────────────────────────────────────────────────────────${ansi.reset}\n`;

  return `${header}\n${body}\n${footer}`;
}