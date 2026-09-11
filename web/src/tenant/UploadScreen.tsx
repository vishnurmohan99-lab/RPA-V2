import { FileCheck2, UploadCloud } from 'lucide-react';
import { PsButton } from './parts';
import type { ScreenProps } from './TenantFrame';

/** A synthetic third-party site: the print vendor's statement upload page. */
export function UploadScreen({ uploaded, onAction }: ScreenProps) {
  return (
    <div className="min-h-full bg-[#F4F6FB] p-6">
      <div className="mx-auto max-w-md rounded-lg border border-[#D9DEEA] bg-white p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#4F5BD5]">Print vendor</div>
        <h1 data-label="Upload statements" data-kind="screen" className="text-lg font-bold text-ink">
          Upload statements
        </h1>
        <p className="mb-4 mt-1 text-[13px] text-body">Send a statement file and we will print and mail it the next business day.</p>
        <label
          data-label="Statement file"
          data-kind="upload"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[#C7CDE0] px-4 py-8 text-center"
        >
          <input type="file" accept=".csv" className="sr-only" />
          {uploaded ? (
            <>
              <FileCheck2 className="text-[#4F5BD5]" />
              <span className="text-sm font-semibold text-ink">{uploaded.name}</span>
              <span className="text-xs text-muted">{uploaded.detail}</span>
            </>
          ) : (
            <>
              <UploadCloud className="text-muted" />
              <span className="text-sm text-body">Drop a statement file here</span>
              <span className="text-xs text-muted">CSV, up to 10 MB</span>
            </>
          )}
        </label>
        <div className="mt-4 flex justify-end">
          <PsButton label="Send to print" primary onAction={onAction} />
        </div>
      </div>
    </div>
  );
}
