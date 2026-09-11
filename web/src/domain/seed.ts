import { makeStep } from './actions';
import { DEFAULT_RULES } from './houseRules';
import type { Automation, BalanceRow, Destination, EraRow, HouseRuleState, RunRecord, SignIn } from './types';

export const BALANCES: BalanceRow[] = [
  { id: 'A-10442', account: 'A-10442', patient: 'Marta Reyes', payer: 'Aetna', balance: 240.0, age: 45, plan: 'No' },
  { id: 'A-10517', account: 'A-10517', patient: 'Dale Whitcomb', payer: '99999', balance: 118.5, age: 62, plan: 'No' },
  { id: 'A-10588', account: 'A-10588', patient: 'June Park', payer: 'BCBS', balance: 3.75, age: 38, plan: 'No' },
  { id: 'A-10603', account: 'A-10603', patient: 'Otis Nunn', payer: 'Cigna', balance: 1240.0, age: 91, plan: 'No' },
  { id: 'A-10644', account: 'A-10644', patient: 'Priya Raman', payer: 'Aetna', balance: 86.2, age: 33, plan: 'Active' },
  { id: 'A-10709', account: 'A-10709', patient: 'Hal Berger', payer: 'Medicare', balance: 512.0, age: 47, plan: 'No' },
  { id: 'A-10755', account: 'A-10755', patient: 'Sana Iqbal', payer: 'UHC', balance: 74.0, age: 12, plan: 'No' },
  { id: 'A-10801', account: 'A-10801', patient: 'Ray Colton', payer: 'BCBS', balance: 6800.0, age: 120, plan: 'No' },
  { id: 'A-10866', account: 'A-10866', patient: 'Fern Adeyemi', payer: 'Cigna', balance: 195.4, age: 58, plan: 'No' },
  { id: 'A-10912', account: 'A-10912', patient: 'Wes Tanaka', payer: '99999', balance: 402.0, age: 77, plan: 'No' },
  { id: 'A-10977', account: 'A-10977', patient: 'Ida Brennan', payer: 'Medicare', balance: 4.2, age: 41, plan: 'No' },
  { id: 'A-11033', account: 'A-11033', patient: 'Cal Whitfield', payer: 'UHC', balance: 328.75, age: 36, plan: 'No' },
];

export const ERAS: EraRow[] = [
  { id: 'ERA-7781', era: 'ERA-7781', payer: 'Aetna', check: 'CHK-448120', claims: 14, amount: 2380.5, status: 'Balanced' },
  { id: 'ERA-7782', era: 'ERA-7782', payer: '99999', check: 'CHK-448133', claims: 3, amount: 412.0, status: 'Balanced' },
  { id: 'ERA-7783', era: 'ERA-7783', payer: 'BCBS', check: 'CHK-448151', claims: 22, amount: 5940.25, status: 'Balanced' },
  { id: 'ERA-7784', era: 'ERA-7784', payer: 'Cigna', check: 'CHK-448167', claims: 9, amount: 1105.8, status: 'Unbalanced' },
  { id: 'ERA-7785', era: 'ERA-7785', payer: 'Medicare', check: 'EFT-902211', claims: 31, amount: 3217.4, status: 'Balanced' },
  { id: 'ERA-7786', era: 'ERA-7786', payer: 'UHC', check: 'CHK-448190', claims: 6, amount: 688.0, status: 'Balanced' },
  { id: 'ERA-7787', era: 'ERA-7787', payer: '99999', check: 'CHK-448204', claims: 2, amount: 150.0, status: 'Balanced' },
  { id: 'ERA-7788', era: 'ERA-7788', payer: 'Aetna', check: 'CHK-448219', claims: 11, amount: 1472.35, status: 'Balanced' },
  { id: 'ERA-7789', era: 'ERA-7789', payer: 'Medicaid', check: 'EFT-902248', claims: 18, amount: 2009.1, status: 'Balanced' },
  { id: 'ERA-7790', era: 'ERA-7790', payer: 'Cigna', check: 'CHK-448233', claims: 7, amount: 934.6, status: 'Balanced' },
];

export const PATIENTS = BALANCES.map((b, i) => {
  const [first, last] = b.patient.split(' ');
  return {
    id: b.id,
    last,
    first,
    dob: `0${(i % 9) + 1}-1${i % 9}-19${60 + i * 3}`,
    gender: i % 2 ? 'Male' : 'Female',
    mrn: String(5400 + i * 7),
    ins: b.payer,
    phone: `(555) 01${String(10 + i)}`,
  };
});

export const SIGN_INS: SignIn[] = [
  { id: 'cred-billing-ro', label: 'Billing read-only', user: 'diane.k' },
  { id: 'cred-posting', label: 'Posting clerk', user: 'posting.frontdesk' },
];

export const DESTINATIONS: Destination[] = [
  { id: 'billing-share', label: 'Billing share', kind: 'folder' },
  { id: 'posting', label: 'Posting folder', kind: 'folder' },
  { id: 'vendor-portal', label: 'Statement vendor portal', kind: 'web' },
];

export function seedAutomations(): Automation[] {
  return [
    {
      id: 'auto-friday-statements',
      name: 'Friday patient statements',
      createdBy: 'Diane Keller',
      startUrl: 'https://demo.practicesuite.test/billing',
      credId: 'cred-billing-ro',
      destination: 'Billing share › statements-{date}.csv',
      screen: 'balances',
      status: 'ready',
      lastRun: 'Fri 5 Sep, 4:12 PM',
      cleanDryRun: true,
      steps: [
        makeStep('open', 'Balances', undefined, { screen: 'balances' }),
        makeStep('filter', 'Age (days)', 'is over 30', { screen: 'balances' }),
        makeStep('read', 'Balance', undefined, { screen: 'balances' }),
        makeStep('rules', null),
        makeStep('review', null),
        makeStep('click', 'Export', undefined, { screen: 'balances' }),
        makeStep('download', null),
        makeStep('saveTo', null, 'Billing share'),
      ],
    },
    {
      id: 'auto-era-posting',
      name: 'ERA posting prep',
      createdBy: 'Diane Keller',
      startUrl: 'https://demo.practicesuite.test/payments',
      credId: 'cred-posting',
      destination: 'Posting folder › eras-{date}.csv',
      screen: 'payments',
      status: 'attention',
      lastRun: 'Thu 4 Sep, 9:30 AM',
      steps: [
        makeStep('open', 'Payments', undefined, { screen: 'payments' }),
        makeStep('read', 'Check #', undefined, { screen: 'payments' }),
        makeStep('read', 'Amount', undefined, { screen: 'payments' }),
        makeStep('rules', null),
        makeStep('review', null),
        makeStep('click', 'Export', undefined, { screen: 'payments' }),
        makeStep('download', null),
        makeStep('saveTo', null, 'Posting folder'),
      ],
    },
    {
      id: 'auto-vendor-upload',
      name: 'Send statements to the print vendor',
      createdBy: 'Diane Keller',
      startUrl: 'https://demo.practicesuite.test/billing',
      credId: 'cred-billing-ro',
      destination: 'Statement vendor portal',
      screen: 'balances',
      status: 'never',
      lastRun: '—',
      steps: [
        makeStep('open', 'Balances', undefined, { screen: 'balances' }),
        makeStep('filter', 'Age (days)', 'is over 30', { screen: 'balances' }),
        makeStep('rules', null),
        makeStep('review', null),
        makeStep('click', 'Export', undefined, { screen: 'balances' }),
        makeStep('download', null),
        makeStep('upload', null, 'Statement vendor portal'),
      ],
    },
  ];
}

export function seedRules(): HouseRuleState[] {
  return DEFAULT_RULES.map((r) => ({ ...r }));
}

export function seedHistory(): RunRecord[] {
  return [
    {
      id: 'run-seed-2',
      automationId: 'auto-era-posting',
      automationName: 'ERA posting prep',
      when: 'Thu 4 Sep, 9:30 AM',
      outcome: 'attention',
      narrative:
        'Stopped at step 2. I was looking for the Check # column and could not find it with enough confidence, so I read nothing and saved nothing. It is waiting for you to take a look.',
      rowsRead: 0,
      rowsKept: 0,
      rowsSkipped: 0,
      rowsHeld: 0,
      fileProduced: null,
    },
    {
      id: 'run-seed-1',
      automationId: 'auto-friday-statements',
      automationName: 'Friday patient statements',
      when: 'Fri 5 Sep, 4:12 PM',
      outcome: 'clean',
      narrative:
        'Ran clean. Read 12 patients, kept 5, skipped 5 by house rule, held 1 for you. You approved it, so I caught the download and moved it on. I did not write anything back into PracticeSuite.',
      rowsRead: 12,
      rowsKept: 5,
      rowsSkipped: 5,
      rowsHeld: 1,
      fileProduced: 'statements-2026-09-05.csv',
    },
  ];
}
