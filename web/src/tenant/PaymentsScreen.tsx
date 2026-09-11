import { money } from '../domain/houseRules';
import { ERAS } from '../domain/seed';
import type { EraRow } from '../domain/types';
import { PsButton, PsHeader, PsInput, PsTable, type Col } from './parts';
import type { ScreenProps } from './TenantFrame';

const era: Col<EraRow> = { label: 'ERA', cell: (r) => r.era };
const payer: Col<EraRow> = { label: 'Payer', cell: (r) => r.payer };
const check: Col<EraRow> = { label: 'Check #', cell: (r) => r.check };
const paymentRef: Col<EraRow> = { ...check, label: 'Payment Ref' };
const claims: Col<EraRow> = { label: 'Claims', cell: (r) => r.claims, align: 'right' };
const amount: Col<EraRow> = { label: 'Amount', cell: (r) => money(r.amount), align: 'right' };
const status: Col<EraRow> = {
  label: 'Status',
  cell: (r) => (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'Balanced' ? 'bg-mint text-teal' : 'bg-red-bg text-red'}`}>{r.status}</span>
  ),
};

export function PaymentsScreen({ mutated, rowMarks, rowNotes, onAction }: ScreenProps) {
  const cols = mutated ? [era, payer, status, paymentRef, claims, amount] : [era, payer, check, claims, amount, status];
  return (
    <div>
      <PsHeader
        title="Payments"
        description="Electronic remittance batches waiting to post."
        actions={
          <>
            <PsButton label="Reconcile" onAction={onAction} />
            <PsButton label="Export" primary onAction={onAction} />
          </>
        }
      />
      <div className="flex items-center gap-2 px-5 py-3">
        <div className="w-48">
          <PsInput label="Deposit date" placeholder="YYYY-MM-DD" />
        </div>
        <PsInput label="Payer" placeholder="Payer" />
        <PsInput label="ERA number" placeholder="ERA number" />
      </div>
      <PsTable label="ERA list" cols={cols} rows={ERAS} marks={rowMarks} notes={rowNotes} />
    </div>
  );
}
