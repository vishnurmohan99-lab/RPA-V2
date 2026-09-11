import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import { seedAutomations, seedHistory, seedRules, SIGN_INS } from '../domain/seed';
import type { Automation, HouseRuleState, RunRecord, SignIn } from '../domain/types';

export type View =
  | { name: 'list' }
  | { name: 'setup'; id?: string; start?: 'describe' | 'record' | 'scratch' }
  | { name: 'builder'; id: string; start?: 'describe' | 'record' | 'scratch' }
  | { name: 'rules' }
  | { name: 'history'; runId?: string }
  | { name: 'files' }
  | { name: 'signins' };

export type SaveState = 'saved' | 'saving' | 'offline';

export interface State {
  view: View;
  automations: Automation[];
  rules: HouseRuleState[];
  signIns: SignIn[];
  history: RunRecord[];
  mutated: boolean;
  save: SaveState;
  /** Bumped each time the demo is reset, so persistence can replace what the runner has saved. */
  resets: number;
}

export type Action =
  | { type: 'go'; view: View }
  | { type: 'toggleMutated' }
  | { type: 'upsertAutomation'; automation: Automation }
  | { type: 'removeAutomation'; id: string }
  | { type: 'setRule'; id: string; on: boolean }
  | { type: 'addSignIn'; signIn: SignIn }
  | { type: 'addRun'; run: RunRecord }
  | { type: 'hydrate'; data: Partial<Pick<State, 'automations' | 'rules' | 'signIns' | 'history'>> }
  | { type: 'saveState'; save: SaveState }
  | { type: 'reset' };

export function initialState(): State {
  return {
    view: { name: 'list' },
    automations: seedAutomations(),
    rules: seedRules(),
    signIns: SIGN_INS.map((s) => ({ ...s })),
    history: seedHistory(),
    mutated: false,
    save: 'saved',
    resets: 0,
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return { ...state, view: action.view };
    case 'toggleMutated':
      return { ...state, mutated: !state.mutated };
    case 'upsertAutomation': {
      const exists = state.automations.some((a) => a.id === action.automation.id);
      return {
        ...state,
        automations: exists
          ? state.automations.map((a) => (a.id === action.automation.id ? action.automation : a))
          : [action.automation, ...state.automations],
      };
    }
    case 'removeAutomation':
      return { ...state, automations: state.automations.filter((a) => a.id !== action.id) };
    case 'setRule':
      return { ...state, rules: state.rules.map((r) => (r.id === action.id ? { ...r, on: action.on } : r)) };
    case 'addSignIn':
      return { ...state, signIns: [...state.signIns, { id: action.signIn.id, label: action.signIn.label, user: action.signIn.user, account: action.signIn.account }] };
    case 'addRun':
      return { ...state, history: [action.run, ...state.history] };
    case 'hydrate':
      return { ...state, ...action.data };
    case 'saveState':
      return { ...state, save: action.save };
    case 'reset':
      return { ...initialState(), save: state.save, resets: state.resets + 1 };
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
