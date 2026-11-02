import React, { useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { shareOrDownload } from '../../io/backup';

/**
 * Shows a generated page (scorecard, home plan) inside the app, where it works in standalone
 * mode too, with Share (AirDrop, Messages, Mail, Print on iOS) and a print button.
 */
export function PrintSheet({ title, html, fileName, onClose, onShared }: { title: string; html: string; fileName: string; onClose: () => void; onShared?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const share = async () => {
    const how = await shareOrDownload(new TextEncoder().encode(html), fileName, 'text/html');
    if (how === 'cancelled') return setMsg('Share cancelled');
    setMsg(how === 'shared' ? 'Shared' : 'Downloaded');
    onShared?.();
  };
  const print = () => {
    const w = frame.current?.contentWindow;
    if (w) {
      w.focus();
      w.print();
    }
  };
  return (
    <Sheet title={title} onClose={onClose} footer={<><button className="btn" onClick={print}>Print</button><button className="btn primary" onClick={share}>Share</button></>}>
      <iframe ref={frame} srcDoc={html} title={title} style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }} />
      {msg && <div className="small muted" style={{ marginTop: 6 }}>{msg}</div>}
      <p className="muted small" style={{ marginTop: 6 }}>Share sends the page as a file (Messages, Mail, AirDrop, or Print to make a PDF).</p>
    </Sheet>
  );
}
