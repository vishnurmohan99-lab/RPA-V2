const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

/** Hand the viewer a real file. */
export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const today = () => new Date().toISOString().slice(0, 10);

export function fileNameFor(destination: string): string {
  const pattern = destination.split('›').pop()?.trim() || 'automation-{date}.csv';
  const name = pattern.includes('.') ? pattern : `${pattern}-{date}.csv`;
  return name.replace('{date}', today()).replace(/\s+/g, '-').toLowerCase();
}
