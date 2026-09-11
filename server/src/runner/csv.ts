const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export const today = () => new Date().toISOString().slice(0, 10);

/** "Billing share › statements-{date}.csv" gives the file name; otherwise named after the workflow. */
export function fileNameFor(destination: string, workflowName = 'statements'): string {
  const parts = destination.split('›');
  const slug = workflowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'statements';
  const pattern = parts.length > 1 ? parts.pop()!.trim() : `${slug}-{date}.csv`;
  const name = pattern.includes('.') ? pattern : `${pattern}-{date}.csv`;
  return name.replace('{date}', today()).replace(/\s+/g, '-').toLowerCase();
}
