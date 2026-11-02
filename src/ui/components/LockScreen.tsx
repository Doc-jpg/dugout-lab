import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks';
import { sha256Hex } from '../../io/hash';

const RELOCK_AFTER_MS = 10 * 60 * 1000;

export async function pinHashFor(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`);
}

/**
 * Optional PIN. A deterrent for a phone handed to a kid or left on the bench, not encryption:
 * the data is still on the device. Locks on open and after ten minutes in the background.
 */
export function LockScreen({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const [locked, setLocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const hasPin = !!settings.pinHash;

  useEffect(() => {
    if (locked === null && settings.id) setLocked(hasPin);
  }, [hasPin, settings.id, locked]);
  useEffect(() => {
    if (!hasPin) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [hasPin]);

  if (!hasPin || locked === false || locked === null) return <>{children}</>;
  const tryPin = async (value: string) => {
    if (value.length < 4) return;
    const h = await pinHashFor(value, settings.pinSalt ?? '');
    if (h === settings.pinHash) {
      setLocked(false);
      setPin('');
      setWrong(false);
    } else {
      setWrong(true);
      setPin('');
    }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <h1 style={{ marginBottom: 6 }}>{settings.appName}</h1>
      <div className="muted small" style={{ marginBottom: 16 }}>Enter your PIN</div>
      <input
        className="input"
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => { if (e.key === 'Enter') tryPin(pin); }}
        style={{ fontSize: 28, textAlign: 'center', letterSpacing: 8, width: 200 }}
        aria-label="PIN"
      />
      <button className="btn primary" style={{ marginTop: 12 }} onClick={() => tryPin(pin)} disabled={pin.length < 4}>Unlock</button>
      {wrong && <div className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>That is not it. Try again.</div>}
      <p className="muted small" style={{ marginTop: 24, textAlign: 'center' }}>Forgot it? There is no reset without erasing the app's data (Settings is behind the lock). Keep a backup file; restoring it to a fresh install brings everything back.</p>
    </div>
  );
}
