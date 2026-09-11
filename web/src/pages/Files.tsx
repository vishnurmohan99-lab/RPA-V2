import { CloudOff, Download, FileText, FolderOpen, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DESTINATIONS } from '../domain/seed';
import type { KeptFile } from '../domain/types';
import { useStore } from '../state/store';
import { useToast } from '../shell/Toast';
import { Button, EmptyState, Modal, PageHeader } from '../shell/ui';

const size = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function Files() {
  const { state } = useStore();
  const toast = useToast();
  const [files, setFiles] = useState<KeptFile[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [deleting, setDeleting] = useState<KeptFile | null>(null);

  const load = () =>
    api
      .files()
      .then((f) => {
        setFiles(f);
        setOffline(false);
      })
      .catch(() => {
        setFiles([]);
        setOffline(true);
      });

  useEffect(() => {
    load();
  }, [state.history.length]);

  const nameOf = (id: string | null) => state.automations.find((a) => a.id === id)?.name ?? '—';

  const send = async (f: KeptFile, dest: string) => {
    try {
      await api.sendFile(f.id, dest);
      toast.show(`Sent to ${dest}`);
      load();
    } catch {
      toast.show('The runner is not reachable right now');
    }
  };

  return (
    <div>
      <PageHeader title="Files" description="Files your automations caught. They stay on this computer until you delete them." />
      <div className="px-8 py-6">
        {offline ? (
          <EmptyState icon={<CloudOff size={22} />} title="Can't reach the runner" body="Kept files live with the runner on this computer. Start it and they will show up here." />
        ) : files && files.length === 0 ? (
          <EmptyState icon={<FolderOpen size={22} />} title="No files yet" body="When you approve a run, the file it catches is kept here, and a copy goes wherever the automation sends it." />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-xs font-semibold text-body">
                  <th className="px-6 py-3">File</th>
                  <th className="px-4 py-3">Workflow</th>
                  <th className="px-4 py-3">Caught</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Sent to</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(files ?? []).map((f) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 font-medium text-ink">
                        <FileText size={16} className="text-teal" />
                        {f.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink">{nameOf(f.automationId)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-ink">{when(f.created)}</td>
                    <td className="px-4 py-4 text-body">{size(f.size)}</td>
                    <td className="px-4 py-4">
                      {f.sentTo.length ? (
                        <div className="flex flex-wrap gap-1">
                          {f.sentTo.map((d) => (
                            <span key={d} className="rounded-full bg-mint px-2 py-0.5 text-xs font-medium text-teal">
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">Kept here only</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <a href={api.fileUrl(f.id)} className="inline-flex items-center gap-1.5 rounded-card border border-line px-2.5 py-1.5 text-[13px] font-semibold text-ink hover:bg-canvas">
                          <Download size={14} /> Save a copy
                        </a>
                        <label className="relative inline-flex items-center gap-1.5 rounded-card border border-line px-2.5 py-1.5 text-[13px] font-semibold text-ink hover:bg-canvas">
                          <Send size={14} /> Send to…
                          <select
                            aria-label={`Send ${f.name} to`}
                            value=""
                            onChange={(e) => e.target.value && send(f, e.target.value)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          >
                            <option value="">Send to…</option>
                            {DESTINATIONS.filter((d) => d.kind === 'folder').map((d) => (
                              <option key={d.id}>{d.label}</option>
                            ))}
                          </select>
                        </label>
                        <button aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)} className="rounded-card p-2 text-muted hover:bg-red-bg hover:text-red">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        subtitle="It will be removed from this computer. Copies already sent on stay where they are."
        width={480}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleting(null)}>Keep it</Button>
          <Button
            variant="primary"
            className="!bg-red hover:!brightness-95"
            onClick={async () => {
              const f = deleting;
              setDeleting(null);
              if (!f) return;
              await api.deleteFile(f.id).catch(() => toast.show('The runner is not reachable right now'));
              load();
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
