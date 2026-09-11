import { X } from 'lucide-react';
import { useState } from 'react';
import { PATIENTS } from '../domain/seed';
import { PsButton, PsHeader, PsInput, PsTable, type Col } from './parts';
import type { ScreenProps } from './TenantFrame';

type P = (typeof PATIENTS)[number];

const cols: Col<P>[] = [
  { label: 'Last Name', cell: (r) => <span className="font-semibold">{r.last}</span> },
  { label: 'First Name', cell: (r) => <span className="font-semibold">{r.first}</span> },
  { label: 'DoB', cell: (r) => r.dob },
  { label: 'Gender', cell: (r) => r.gender },
  { label: 'MRN', cell: (r) => r.mrn },
  { label: 'INS', cell: (r) => r.ins },
  { label: 'Phone', cell: (r) => r.phone },
];

export function PatientsScreen({ rowMarks, rowNotes, onAction }: ScreenProps) {
  const [more, setMore] = useState(false);
  return (
    <div className="relative">
      <PsHeader title="Patients" description="Browse and view patient demographic information." />
      <div className="flex items-center gap-2 px-5 py-3">
        <PsInput label="Last name" />
        <PsInput label="First name" />
        <PsInput label="MRN" />
        <PsInput label="PC Ref Number" />
        <button
          type="button"
          data-label="More Filter"
          data-kind="button"
          onClick={() => setMore((m) => !m)}
          className="shrink-0 rounded-input border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"
        >
          More Filter
        </button>
      </div>
      {more && (
        <div className="absolute right-5 top-[118px] z-10 w-72 rounded-modal border border-line bg-white shadow-drag">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold text-ink">Filter</span>
            <button onClick={() => setMore(false)} aria-label="Close filter" className="text-muted">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 px-4 py-3">
            {[
              ['Date of Birth', 'YYYY-MM-DD'],
              ['INS', 'Enter INS number'],
              ['Phone', 'Enter phone number'],
            ].map(([l, p]) => (
              <div key={l}>
                <div className="mb-1 text-xs font-medium text-ink">{l}</div>
                <PsInput label={l} placeholder={p} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <PsButton label="Reset" onAction={onAction} />
            <PsButton label="Apply Filters" primary onAction={onAction} />
          </div>
        </div>
      )}
      <PsTable label="Patient list" cols={cols} rows={PATIENTS} marks={rowMarks} notes={rowNotes} />
    </div>
  );
}
