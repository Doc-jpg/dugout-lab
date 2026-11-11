import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrentTeam, usePractices, useSettings } from '../hooks';
import { saveSettings } from '../../db/db';
import { nowIso } from '../../engine/types';

/**
 * A one-minute guided tour: nine stops, each on the real screen with the real button lit up.
 * Started from Today (first time), Setup, or Help any time. Finishing or skipping stamps
 * settings.tourSeenAt so it stops offering itself.
 */
interface Stop {
  route: (practiceId?: string) => string;
  anchor?: string;
  title: string;
  text: string;
}

const STOPS: Stop[] = [
  { route: () => '/today', anchor: 'today-next', title: 'Today is home base', text: 'Your next practice, arms that need rest, and reminders about kids. On practice day the big button starts it.' },
  { route: () => '/today', anchor: 'note', title: 'Notes the way you like', text: 'Tap + Note, then say it or type it: "Jonah hesitated on the cutoff." The app guesses who and what; you confirm with one tap. Or skip the words and tap the kid and a button. Both take about five seconds.' },
  { route: () => '/practices/new', anchor: 'quickstart', title: 'Build a practice in one tap', text: 'Quick start uses your usual length, coaches and gear. Tap anyone who is out, then Generate. Kids resting an arm are already on the no-throwing list.' },
  { route: (id) => (id ? `/practices/${id}` : '/practices'), anchor: 'station', title: 'Stations, groups, and every kid\'s job', text: 'Each block shows who is in which group and what each station runs. Open a station to see every kid\'s own objective and why he has it. Regenerate one station if you do not like it; Adjust handles rain, a missing coach, or a kid who left.' },
  { route: (id) => (id ? `/practices/${id}` : '/practices'), anchor: 'start', title: 'Run it from your phone', text: 'Start practice runs the timer and moves the groups. Tap a kid\'s name for a note, + Note to say one, or Narrate to talk through a whole drill and sort it per kid after. Finish takes you to the recap: wins, what to work on, and suggestions, always labeled as suggestions.' },
  { route: () => '/players', anchor: 'roster', title: 'Every kid has a chart', text: 'Tap a name: what he needs today, his goals and cues, your private notes, your read on his progress, and his family\'s contact for updates. Add nicknames under Edit so spoken notes find him.' },
  { route: () => '/drills', title: 'Drills with coach notes', text: 'One hundred ten drills, each with steps, cues, what "got it" looks like, common mistakes and the fix, and a way to make it a game. Make your own version of any drill, or a version for one kid.' },
  { route: () => '/progress', title: 'Progress is your read, not a ranking', text: 'Your level and status for each kid by area, who is due for a check, and who has gone quiet. Nothing here compares kids to each other.' },
  { route: () => '/settings', anchor: 'backup', title: 'Back up, brand it, share it', text: 'Back up every few practices. Branding, assistant coaches, parent update settings and a PIN lock live here too. Help has the questions people ask and this tour, any time.' }
];

interface TourApi { start: () => void; active: boolean }
const TourCtx = createContext<TourApi>({ start: () => undefined, active: false });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const api = useMemo(() => ({ start: () => setStep(0), active: step !== null }), [step]);
  return (
    <TourCtx.Provider value={api}>
      {children}
      {step !== null && <TourOverlay step={step} setStep={setStep} />}
    </TourCtx.Provider>
  );
}

function TourOverlay({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const team = useCurrentTeam();
  const practices = usePractices(team?.id);
  const practiceId = useMemo(() => practices.filter((p) => p.status !== 'done').sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? practices[0]?.id, [practices]);
  const stop = STOPS[step];
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Go to the stop's screen, then find and light the anchor once it has rendered.
  useEffect(() => {
    const target = stop.route(practiceId);
    if (loc.pathname !== target) nav(target);
  }, [step]);
  useLayoutEffect(() => {
    let tries = 0;
    let timer: number | undefined;
    const measure = () => {
      const el = stop.anchor ? (document.querySelector(`[data-tour="${stop.anchor}"]`) as HTMLElement | null) : null;
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
        if (stop.anchor && tries++ < 8) timer = window.setTimeout(measure, 120);
      }
    };
    timer = window.setTimeout(measure, 80);
    const onMove = () => { const el = stop.anchor ? (document.querySelector(`[data-tour="${stop.anchor}"]`) as HTMLElement | null) : null; if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [step, loc.pathname, practiceId]);

  const finish = async () => { setStep(null); await saveSettings({ tourSeenAt: nowIso() }); nav('/today'); };
  const pad = 6;
  const cardOnTop = rect ? rect.top + rect.height / 2 > window.innerHeight * 0.55 : false;
  return (
    <>
      {rect ? <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="tour-mask" style={{ background: 'rgba(20,24,22,0.45)' }} />}
      <div className={`tour-card ${cardOnTop ? 'top' : ''}`} role="dialog" aria-label="Guided tour">
        <div className="step">Tour · {step + 1} of {STOPS.length}</div>
        <h3>{stop.title}</h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>{stop.text}</p>
        <div className="row between">
          <button className="btn ghost sm" onClick={finish}>{step + 1 < STOPS.length ? 'Skip the rest' : 'Done'}</button>
          <div className="row">
            {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>Back</button>}
            {step + 1 < STOPS.length ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next ›</button> : <button className="btn primary" onClick={finish}>Done, let's go</button>}
          </div>
        </div>
      </div>
    </>
  );
}

/** The card Today shows until the tour has been taken or dismissed. */
export function TourOffer() {
  const settings = useSettings();
  const team = useCurrentTeam();
  const tour = useTour();
  if (!team || settings.tourSeenAt || tour.active) return null;
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent)', marginBottom: 12 }}>
      <div className="row between">
        <div className="grow"><strong>New here?</strong><div className="small muted">A one-minute tour of the five screens, on the real screens.</div></div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => saveSettings({ tourSeenAt: nowIso() })}>Not now</button>
          <button className="btn primary sm" onClick={tour.start}>Take the tour</button>
        </div>
      </div>
    </div>
  );
}
