import { getAttachmentUrl } from '../api/ticketApi';

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ ticketId, attachments = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-lg font-semibold text-slate-900">Attachments</h4>
      <div className="mt-4 space-y-3">
        {attachments.length ? (
          attachments.map((file) => (
            <a
              key={file.id}
              href={getAttachmentUrl(ticketId, file.id)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white p-3 text-sm shadow-sm"
            >
              <p className="font-semibold text-slate-900">{file.original_name}</p>
              <p className="mt-1 text-slate-600">{file.mime_type}</p>
              <p className="mt-1 text-xs text-slate-500">{formatSize(file.file_size)}</p>
            </a>
          ))
        ) : (
          <p className="text-sm text-slate-500">No attachments uploaded.</p>
        )}
      </div>
    </div>
  );
}
