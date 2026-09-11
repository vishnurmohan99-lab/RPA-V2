import { MedicalCross } from '../shell/Rail';
import { PsButton } from './parts';
import type { ScreenProps } from './TenantFrame';

export function SignInScreen({ onAction }: ScreenProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-80 rounded-modal border border-line bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <MedicalCross size={24} />
          <span className="text-lg font-bold text-ink">PracticeSuite</span>
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-ink">User</span>
          <input data-label="User" data-kind="field" readOnly value="" className="w-full rounded-input border border-line bg-canvas px-3 py-2 text-sm" />
        </label>
        <label className="mb-5 block">
          <span className="mb-1 block text-xs font-medium text-ink">Password</span>
          <input data-label="Password" data-kind="field" type="password" readOnly value="" className="w-full rounded-input border border-line bg-canvas px-3 py-2 text-sm" />
        </label>
        <div className="[&>button]:w-full">
          <PsButton label="Sign in" primary onAction={onAction} />
        </div>
        <p className="mt-4 text-center text-xs text-muted">The runner fills these from its environment file.</p>
      </div>
    </div>
  );
}
