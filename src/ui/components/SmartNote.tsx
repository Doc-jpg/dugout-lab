import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Observation, Player } from '../../engine/types';
import { CATEGORIES, CATEGORY_LABEL } from '../../engine/types';
import { parseNote, confidenceWord } from '../../engine/notes';
import { addObservation, playerName } from '../../db/db';
import { Sheet } from './Sheet';

export const READ_LABEL: Record<Observation['read'], string> = {
  got_it: 'Got it', working: 'Working on it', struggled: 'Struggled', hesitated: 'Hesitated', confident: 'Confident', frustrated: 'Frustrated', reset_worked: 'Reset worked',
  hustle: 'Hustled', teammate: 'Good teammate', coachable: 'Took the cue', coasting: 'Went through the motions', note: 'Just a note'
};
const READS = Object.keys(READ_LABEL) as Observation['read'][];

type Recognition = { start(): void; stop(): void; abort(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
function recognitionClass(): (new () => Recognition) | undefined {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

/**
 * Tap-to-talk on top of a text box. Uses the browser's speech recognition where it exists
 * (Safari and Chrome; it sends audio to Apple or Google to transcribe, so it needs a signal).
 * Without it, the keyboard's own mic key still dictates into the box.
 */
export function useSpeech(onText: (finalText: string, interim: string) => void, opts: { keepAlive?: boolean } = {}) {
  const supported = useMemo(() => Boolean(recognitionClass()), []);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const want = useRef(false);
  const acc = useRef('');
  const stop = () => { want.current = false; try { rec.current?.stop(); } catch { /* already stopped */ } setListening(false); };
  const launch = () => {
    const Cls = recognitionClass();
    if (!Cls) return;
    const r = new Cls();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) acc.current += (acc.current ? ' ' : '') + chunk.trim();
        else interim += chunk;
      }
      onText(acc.current, interim);
    };
    r.onerror = (e: any) => {
      // A pause is not an error when the coach is narrating a drill; the recognizer is restarted below.
      if (opts.keepAlive && (e?.error === 'no-speech' || e?.error === 'aborted')) return;
      want.current = false;
      setError(e?.error === 'not-allowed' ? 'Microphone is off for this app. Allow it in Settings, Safari (or Chrome), Microphone.' : e?.error === 'network' ? 'No signal for speech right now. Type it, or use the mic on the keyboard.' : 'Could not hear that. Try again or type it.');
      setListening(false);
    };
    // Phones end recognition after a few quiet seconds. In keep-alive mode pick straight back up until the coach taps stop.
    r.onend = () => { if (want.current && opts.keepAlive) { try { launch(); return; } catch { /* fall through */ } } want.current = false; setListening(false); };
    rec.current = r;
    r.start();
  };
  const start = () => {
    if (!recognitionClass()) return;
    setError(null);
    acc.current = '';
    want.current = true;
    try { launch(); setListening(true); } catch { want.current = false; setError('Could not start the microphone.'); }
  };
  useEffect(() => () => { want.current = false; try { rec.current?.abort(); } catch { /* fine */ } }, []);
  return { supported, listening, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** Text box with a tap-to-talk button. The parent owns the text. */
export function TalkBox({ value, onChange, placeholder, autoFocus, rows = 2, keepAlive }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; rows?: number; keepAlive?: boolean }) {
  const base = useRef(value);
  const speech = useSpeech((finalText, interim) => {
    const b = base.current.trim();
    onChange([b, finalText, interim].filter(Boolean).join(' '));
  }, { keepAlive });
  const begin = () => { base.current = value; speech.start(); };
  return (
    <div>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <textarea className="input grow" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
        {speech.supported && (
          <button type="button" className={`btn talk ${speech.listening ? 'on' : ''}`} onClick={() => (speech.listening ? speech.stop() : begin())} aria-pressed={speech.listening} aria-label={speech.listening ? 'Stop listening' : 'Tap to talk'}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></svg>
            <span>{speech.listening ? (keepAlive ? 'Tap to stop' : 'Listening') : 'Talk'}</span>
          </button>
        )}
      </div>
      {speech.error && <div className="small" style={{ color: 'var(--danger)', marginTop: 4 }}>{speech.error}</div>}
      {!speech.supported && <div className="muted small" style={{ marginTop: 4 }}>To talk instead of type, tap the mic key on your keyboard.</div>}
    </div>
  );
}

/**
 * One note, any way the coach likes: say it, type it, or tap it.
 * The app guesses who, what you saw and the area from the words; the coach confirms with one tap or changes any piece.
 */
export function SmartNoteSheet({ players, title, onClose, onSaved, source = 'quick', practiceId, fixedPlayerId, hint }: {
  /** The kids this note could be about: the ones at practice, or the active roster. */
  players: Player[];
  title?: string;
  onClose: () => void;
  onSaved: (playerId: string) => void;
  source?: Observation['source'];
  practiceId?: string;
  /** From a player's own page: no guessing needed. */
  fixedPlayerId?: string;
  /** A line under the box, like the kid's objective at this station. */
  hint?: string;
}) {
  const [text, setText] = useState('');
  const [playerId, setPlayerId] = useState<string>(fixedPlayerId ?? '');
  const [read, setRead] = useState<Observation['read']>('note');
  const [category, setCategory] = useState<Category | ''>('');
  const [manual, setManual] = useState<{ player: boolean; read: boolean; category: boolean }>({ player: Boolean(fixedPlayerId), read: false, category: false });
  const [pickWho, setPickWho] = useState(false);
  const [src, setSrc] = useState<Observation['source']>(source);
  const active = players.filter((p) => p.status === 'active');
  const parsed = useMemo(() => parseNote(text, active), [text, active]);

  // Guesses fill in whatever the coach has not set by hand.
  useEffect(() => {
    if (!manual.player) setPlayerId(parsed.player && parsed.player.confidence >= 0.5 ? parsed.player.playerId : '');
    if (!manual.read) setRead(parsed.read);
    if (!manual.category) setCategory(parsed.category ?? '');
  }, [parsed, manual.player, manual.read, manual.category]);

  const who = active.find((p) => p.id === playerId);
  const guessWord = parsed.player && !manual.player ? confidenceWord(parsed.player.confidence) : null;
  const canSave = Boolean(playerId) && (read !== 'note' || text.trim().length > 0);
  const save = async () => {
    if (!playerId) return;
    await addObservation({ playerId, read, category: category || undefined, text: text.trim() || undefined, source: src, practiceId });
    onSaved(playerId);
  };

  return (
    <Sheet title={title ?? (fixedPlayerId ? `Note on ${playerName(who, 'first')}` : src === 'game' ? 'Game note' : 'Quick note')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} onClick={save}>Save{who ? ` for ${playerName(who, 'first')}` : ''}</button></>}>
      {hint && <div className="small muted" style={{ marginBottom: 6 }}>{hint}</div>}
      <TalkBox value={text} onChange={(v) => setText(v)} autoFocus={!fixedPlayerId} placeholder={fixedPlayerId ? 'Say or type what you saw' : 'Say or type it: "Jonah hesitated on the cutoff"'} />

      {!fixedPlayerId && (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Who</label>
          {who && !pickWho ? (
            <div className="row wrap">
              <button className="chip on" onClick={() => setPickWho(true)}>{guessWord ? `${guessWord} ` : ''}{playerName(who, 'short')}{parsed.player?.reason === 'number' ? ` (#${who.number})` : ''}</button>
              {!manual.player && parsed.alternatives.slice(0, 2).map((g) => { const alt = active.find((p) => p.id === g.playerId); return alt ? <button key={g.playerId} className="chip" onClick={() => { setPlayerId(g.playerId); setManual({ ...manual, player: true }); }}>or {playerName(alt, 'short')}</button> : null; })}
              <button className="btn ghost sm" onClick={() => setPickWho(true)}>Someone else</button>
            </div>
          ) : (
            <div className="chips">
              {active.map((p) => <button key={p.id} className={`chip sm ${playerId === p.id ? 'on' : ''}`} onClick={() => { setPlayerId(p.id); setManual({ ...manual, player: true }); setPickWho(false); }}>{playerName(p, 'short')}</button>)}
              {active.length === 0 && <span className="muted small">No players on the roster yet.</span>}
            </div>
          )}
          {!who && parsed.player && parsed.player.confidence < 0.5 && <div className="muted small" style={{ marginTop: 4 }}>Could be {playerName(active.find((p) => p.id === parsed.player!.playerId), 'short')}; tap a name to be sure.</div>}
        </div>
      )}

      <div className="field"><label>What you saw{!manual.read && parsed.readConfidence > 0 ? <span className="muted"> (from your words)</span> : null}</label>
        <div className="chips read-chips">{READS.map((r) => <button key={r} className={`chip ${read === r ? 'on' : ''}`} onClick={() => { setRead(r); setManual({ ...manual, read: true }); }}>{READ_LABEL[r]}</button>)}</div>
      </div>
      <details open={Boolean(category) || manual.category}>
        <summary className="muted small">Area{category ? `: ${CATEGORY_LABEL[category]}` : ' (optional)'}{!manual.category && parsed.category ? ' (from your words)' : ''}</summary>
        <div className="chips" style={{ marginTop: 6 }}>{CATEGORIES.map((c) => <button key={c} className={`chip sm ${category === c ? 'on' : ''}`} onClick={() => { setCategory(category === c ? '' : c); setManual({ ...manual, category: true }); }}>{CATEGORY_LABEL[c]}</button>)}</div>
      </details>
      {fixedPlayerId && (
        <div className="field" style={{ marginTop: 8 }}><label>Where</label><div className="chips"><button className={`chip sm ${src !== 'game' ? 'on' : ''}`} onClick={() => setSrc('quick')}>Practice or anytime</button><button className={`chip sm ${src === 'game' ? 'on' : ''}`} onClick={() => setSrc('game')}>Game</button></div></div>
      )}
    </Sheet>
  );
}
