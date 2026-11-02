import React, { useEffect } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { TodayPage } from './pages/TodayPage';
import { PracticesPage } from './pages/PracticesPage';
import { NewPracticePage } from './pages/NewPracticePage';
import { PracticePlanPage } from './pages/PracticePlanPage';
import { LivePracticePage } from './pages/LivePracticePage';
import { RecapPage } from './pages/RecapPage';
import { PlayersPage } from './pages/PlayersPage';
import { PlayerPage } from './pages/PlayerPage';
import { DrillsPage } from './pages/DrillsPage';
import { DrillPage } from './pages/DrillPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { ParentsPage } from './pages/ParentsPage';
import { SetupPage } from './pages/SetupPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LockScreen } from './components/LockScreen';
import { requestPersistence, seedLibrary } from '../db/db';
import { useCurrentTeam } from './hooks';
import { brandCss } from '../engine/brand';
import { TourProvider } from './components/Tour';

const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15.5" r="2" /></svg>,
  practices: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16" r="3" /><path d="M18 14.5v1.5l1 1" /></svg>,
  players: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3 3-5 6-5s6 2 6 5M15 18c0-2 2-3.5 4.5-3.5S22 16 22 18" /></svg>,
  drills: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20l6-6M14 4l6 6M8 10l6 6M10 8l6 6" /><circle cx="6" cy="6" r="2" /></svg>,
  progress: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19l5-6 4 3 7-9M4 21h16" /></svg>
};

export function App() {
  const team = useCurrentTeam();
  useEffect(() => {
    requestPersistence();
    seedLibrary().catch(() => undefined);
  }, []);
  // The current team's colors restyle the whole app; no brand means the default navy.
  useEffect(() => {
    const root = document.documentElement;
    const css = brandCss(team?.brand);
    for (const k of ['--accent', '--accent-ink', '--brand-accent']) {
      if (css[k]) root.style.setProperty(k, css[k]);
      else root.style.removeProperty(k);
    }
  }, [team?.brand?.primary, team?.brand?.accent]);
  return (
    <LockScreen>
    <TourProvider>
    <div className="app">
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/today">{Icon.today}<span>Today</span></NavLink>
        <NavLink to="/practices">{Icon.practices}<span>Practices</span></NavLink>
        <NavLink to="/players">{Icon.players}<span>Players</span></NavLink>
        <NavLink to="/drills">{Icon.drills}<span>Drills</span></NavLink>
        <NavLink to="/progress">{Icon.progress}<span>Progress</span></NavLink>
      </nav>
      <main className="app-main">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/practices" element={<PracticesPage />} />
          <Route path="/practices/new" element={<NewPracticePage />} />
          <Route path="/practices/:practiceId" element={<PracticePlanPage />} />
          <Route path="/practices/:practiceId/live" element={<LivePracticePage />} />
          <Route path="/practices/:practiceId/recap" element={<RecapPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerPage />} />
          <Route path="/drills" element={<DrillsPage />} />
          <Route path="/drills/:drillId" element={<DrillPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
    </TourProvider>
    </LockScreen>
  );
}
