export interface Destination {
  id: string;
  label: string;
  kind: 'folder' | 'web';
}

/** Where a file can go. Adding one is a line here. No credentials live in this list. */
export const DESTINATIONS: Destination[] = [
  { id: 'billing-share', label: 'Billing share', kind: 'folder' },
  { id: 'posting', label: 'Posting folder', kind: 'folder' },
  { id: 'vendor-portal', label: 'Statement vendor portal', kind: 'web' },
];

export const destinationByLabelOrId = (key: string) =>
  DESTINATIONS.find((d) => d.id === key || d.label.toLowerCase() === key.toLowerCase()) ?? null;
