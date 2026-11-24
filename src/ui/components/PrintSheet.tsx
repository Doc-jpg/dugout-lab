import React, { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { shareOrDownload } from '../../io/backup';

/** An app opened from the iPhone home screen gets no print dialog from the system, so Print would do nothing. */
const cannotPrint = () => typeof navigator !== 'undefined' && (navigator as any).standalone === true;

/**
 * Shows a generated page (scorecard, home plan, tryout report) inside the app, where it works in
 * standalone mode too, with Share (AirDrop, Messages, Mail, Files) and a print button where the
 * phone can print.
 *
 * With `pdf`, the main button shares a real PDF instead of the page file. The PDF is made as soon
 * as the sheet opens, so the tap on Share goes straight to the phone's share sheet (an iPhone only
 * opens it in direct answer to a tap, not after a wait).
 */
export function PrintSheet({ title, html, fileName, onClose, onShared, pdf, children, shareText, hint }: { title: string; html: string; fileName: string; onClose: () => void; onShared?: (how: 'shared' | 'downloaded') => void; pdf?: { make: () => Promise<Uint8Array>; fileName: string }; /** Controls shown above the preview. */ children?: React.ReactNode; /** Words to put in the message next to the file. */ shareText?: string; /** Replaces the line under the preview. */ hint?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    setPdfBytes(null); setPdfFailed(false);
    pdf.make().then((b) => { if (alive) setPdfBytes(b); }).catch(() => { if (alive) setPdfFailed(true); });
    return () => { alive = false; };
    // The page text changes exactly when the report does, so it stands in for the PDF's inputs.
  }, [html]);
  const done = (how: 'shared' | 'downloaded' | 'cancelled') => {
    if (how === 'cancelled') return setMsg('Share cancelled');
    setMsg(how === 'shared' ? 'Shared' : 'Downloaded');
    onShared?.(how);
  };
  const share = async () => done(await shareOrDownload(new TextEncoder().encode(html), fileName, 'text/html', shareText));
  const sharePdf = async () => { if (pdf && pdfBytes) done(await shareOrDownload(pdfBytes, pdf.fileName, 'application/pdf', shareText)); };
  const print = () => {
    const w = frame.current?.contentWindow;
    if (w) {
      w.focus();
      w.print();
    }
  };
  const usePdf = pdf && !pdfFailed;
  return (
    <Sheet title={title} onClose={onClose} footer={<>
      {!cannotPrint() && <button className="btn" onClick={print}>Print</button>}
      {usePdf
        ? <button className="btn primary" data-share-pdf disabled={!pdfBytes} onClick={sharePdf}>{pdfBytes ? 'Share as PDF' : 'Making the PDF…'}</button>
        : <button className="btn primary" onClick={share}>Share</button>}
    </>}>
      {children}
      <iframe ref={frame} srcDoc={html} title={title} style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
      {msg && <div className="small muted" style={{ marginTop: 6 }}>{msg}</div>}
      {usePdf
        ? <p className="muted small" style={{ marginTop: 6 }}>{hint ?? 'Share as PDF sends a PDF of this report (Messages, Mail, AirDrop, or Save to Files to keep a copy).'}</p>
        : <p className="muted small" style={{ marginTop: 6 }}>{pdfFailed ? 'The PDF could not be made on this phone, so Share sends the page as a file instead. ' : ''}Share sends the page as a file (Messages, Mail, AirDrop, or Save to Files).</p>}
    </Sheet>
  );
}
