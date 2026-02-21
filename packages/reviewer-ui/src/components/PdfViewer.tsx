import { useState } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import { cn } from '../lib/cn.ts';

interface PdfViewerProps {
  base64Content?: string;
  url?: string;
  fileName: string;
  onClose: () => void;
}

export default function PdfViewer({ base64Content, url, fileName, onClose }: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const pdfSrc = base64Content
    ? `data:application/pdf;base64,${base64Content}`
    : url ?? '';

  const downloadHref = pdfSrc;

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="shrink-0 text-red-500" />
            <span className="truncate text-sm font-semibold text-slate-900">{fileName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={downloadHref}
              download={fileName}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close PDF viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="relative flex-1 bg-slate-100">
          {/* Loading state */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-slate-100">
              <Loader2 size={28} className="animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading PDF...</p>
            </div>
          )}

          {/* Error / fallback */}
          {hasError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <FileText size={40} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                Unable to display PDF inline
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                Your browser may not support inline PDF rendering. You can download the file directly.
              </p>
              <a
                href={downloadHref}
                download={fileName}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors',
                  'bg-blue-600 text-white hover:bg-blue-700',
                )}
              >
                <Download size={14} />
                Download {fileName}
              </a>
            </div>
          ) : (
            pdfSrc && (
              <iframe
                src={pdfSrc}
                title={fileName}
                className="h-full w-full border-0"
                onLoad={handleLoad}
                onError={handleError}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
