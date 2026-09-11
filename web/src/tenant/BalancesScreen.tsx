import { money } from '../domain/houseRules';
import { BALANCES } from '../domain/seed';
import type { BalanceRow } from '../domain/types';
import { MoreFilterButton, PsButton, PsHeader, PsInput, PsTable, type Col } from './parts';
import type { ScreenProps } from './TenantFrame';

const account: Col<BalanceRow> = { label: 'Account', cell: (r) => r.account };
const patient: Col<BalanceRow> = { label: 'Patient', cell: (r) => r.patient };
const payer: Col<BalanceRow> = { label: 'Payer', cell: (r) => r.payer };
const balance: Col<BalanceRow> = { label: 'Balance', cell: (r) => money(r.balance), align: 'right' };
const amountDue: Col<BalanceRow> = { ...balance, label: 'Amount Due' };
const age: Col<BalanceRow> = { label: 'Age (days)', cell: (r) => r.age, align: 'right' };
const plan: Col<BalanceRow> = { label: 'Payment plan', cell: (r) => r.plan };

/** The statements screen. "Change the screen" simulates a PracticeSuite UI update. */
export function BalancesScreen({ mutated, rowMarks, rowNotes, onAction }: ScreenProps) {
  const cols = mutated ? [account, patient, payer, age, amountDue, plan] : [account, patient, payer, balance, age, plan];
  return (
    <div>
      <PsHeader
        title="Balances"
        description="Patient balances ready for statements."
        actions={
          mutated ? (
            <PsButton label="Print" onAction={onAction} />
          ) : (
            <>
              <PsButton label="Print" onAction={onAction} />
              <PsButton label="Export" primary onAction={onAction} />
            </>
          )
        }
      />
      <div className="flex items-center gap-2 px-5 py-3">
        {mutated && <PsButton label="Export" primary onAction={onAction} />}
        <PsInput label="Patient name" placeholder="Patient name" />
        <PsInput label="Account" placeholder="Account number" />
        <PsInput label="Payer" placeholder="Payer" />
        <MoreFilterButton />
      </div>
      <PsTable label="Balance list" cols={cols} rows={BALANCES} marks={rowMarks} notes={rowNotes} />
    </div>
  );
}
