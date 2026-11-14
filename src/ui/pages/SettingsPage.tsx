import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings, useTeams, useCurrentTeam, usePlayers } from '../hooks';
import { saveSettings, createTeam, updateTeam, storageHealth, requestPersistence, db, playerName, type StorageHealth } from '../../db/db';
import { buildBackup, buildCoachPack, readBackup, restoreBackup, readDugoutDadArchive, planRosterImport, commitRosterImport, shareOrDownload, type BackupContents, type RestoreReport, type DugoutDadRoster, type RosterImportPlan } from '../../io/backup';
import { loadDemoData, removeDemoData, DEMO_TEAM_ID } from '../../data/demo';
import { AGE_GROUPS, CATEGORIES, CATEGORY_LABEL, EQUIPMENT_LABEL, SPACE_LABEL, nowIso, teamAgeGroup, ageGroupForClass, seasonYearFor, type AgeGroup, type Category, type Equipment, type Space, type Helper, type Team } from '../../engine/types';
import { APP_VERSION } from '../version';
import { Sheet, Confirm, useToast } from '../components/Sheet';
import { BrandSheet } from '../components/BrandSheet';
import { SyncCard } from '../components/SyncCard';
import { pinHashFor } from '../components/LockScreen';

export function SettingsPage() {
  const settings = useSettings();
  const teams = useTeams();
  const team = useCurrentTeam();
  const players = usePlayers(team?.id);
  const nav = useNavigate();
  const toast = useToast();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [teamSheet, setTeamSheet] = useState<'new' | 'edit' | null>(null);
  const [brandSheet, setBrandSheet] = useState(false);
  const [restore, setRestore] = useState<{ contents: BackupContents; report?: RestoreReport } | null>(null);
  const [dad, setDad] = useState<{ roster: DugoutDadRoster; plan?: RosterImportPlan; dadTeamId?: string; labTeamId?: string } | null>(null);
  const [removeDemo, setRemoveDemo] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [packSheet, setPackSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    storageHealth().then(setHealth);
  }, []);
  useEffect(() => {
    if (window.location.hash.includes('#backup') || window.location.hash.includes('#dugout-dad')) {
      const id = window.location.hash.includes('backup') ? 'backup' : 'dugout-dad';
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const [ready, setReady] = useState<{ bytes: Uint8Array; fileName: string; records: number; kind: 'backup' | 'pack'; forName?: string } | null>(null);
  // Build first, then share on a fresh tap (iOS needs the share to start from a tap), and only stamp "last backup" when it went somewhere.
  const exportBackup = async () => {
    setBusy(true);
    try {
      const { bytes, fileName, manifest } = await buildBackup(APP_VERSION);
      setReady({ bytes, fileName, records: Object.values(manifest.files).reduce((s, f) => s + f.records, 0), kind: 'backup' });
    } catch (e: any) {
      toast.show(`Backup failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };
  const shareReady = async () => {
    if (!ready) return;
    const how = await shareOrDownload(ready.bytes, ready.fileName);
    if (how === 'cancelled') return toast.show('Cancelled; nothing was saved');
    if (ready.kind === 'backup') await saveSettings({ lastBackupAt: nowIso() });
    toast.show(`${how === 'shared' ? 'Shared' : 'Downloaded'} ${ready.fileName}`);
    setReady(null);
  };
  const pickFile = (accept: string, onFile: (bytes: Uint8Array, name: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      onFile(new Uint8Array(await f.arrayBuffer()), f.name);
    };
    input.click();
  };
  const sendPack = async (h: Helper) => {
    if (!team) return;
    setBusy(true);
    try {
      const { bytes, fileName } = await buildCoachPack(APP_VERSION, team.id, { helperId: h.id, name: h.name });
      const helpers = (team.helpers ?? []).some((x) => x.id === h.id) ? team.helpers!.map((x) => (x.id === h.id ? { ...x, lastSentAt: nowIso() } : x)) : [...(team.helpers ?? []), { ...h, lastSentAt: nowIso() }];
      await updateTeam(team.id, { helpers });
      setReady({ bytes, fileName, records: 0, kind: 'pack', forName: h.name });
    } finally { setBusy(false); }
  };
  const openBackup = () => pickFile('.zip,application/zip', async (bytes) => {
    try {
      setRestore({ contents: await readBackup(bytes) });
    } catch (e: any) {
      toast.show(e?.message ?? String(e));
    }
  });
  const openDad = () => pickFile('.zip,application/zip', async (bytes) => {
    try {
      const roster = await readDugoutDadArchive(bytes);
      const mine = roster.teams.find((t) => t.isMine) ?? roster.teams[0];
      setDad({ roster, dadTeamId: mine?.id, labTeamId: team?.id });
    } catch (e: any) {
      toast.show(e?.message ?? String(e));
    }
  });

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Link to="/today" className="btn ghost sm">‹ Today</Link>
        <Link to="/help" className="btn ghost sm">How it works</Link>
      </div>
      <h1>Settings</h1>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Team</h3><button className="btn sm" onClick={() => setTeamSheet('new')}>+ New team</button></div>
        {teams.length > 0 && (
          <div className="chips" style={{ marginBottom: 8 }}>
            {teams.map((t) => <button key={t.id} className={`chip sm ${team?.id === t.id ? 'on' : ''}`} onClick={() => saveSettings({ teamId: t.id })}>{t.shortName ?? t.name}</button>)}
          </div>
        )}
        {team ? (
          <>
            <div><strong>{team.name}</strong> · {teamAgeGroup(team)}{team.gradYear ? ` (Class of ${team.gradYear})` : ''}{team.season ? ` · ${team.season}` : ''} · {players.filter((p) => p.status === 'active').length} active players</div>
            <div className="small muted">Priorities: {team.priorities.length ? team.priorities.map((c) => CATEGORY_LABEL[c]).join(', ') : 'none set'}</div>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setTeamSheet('edit')}>Edit team and priorities</button>
              <button className="btn sm" onClick={() => setBrandSheet(true)}>Branding: name, logo, colors, coaches</button>
            </div>
            {team.brand?.programName && <div className="small muted" style={{ marginTop: 6 }}>Shows as "{team.brand.programName}"{team.brand.coaches?.length ? ` · ${team.brand.coaches.length} coach${team.brand.coaches.length > 1 ? 'es' : ''} listed` : ''}</div>}
          </>
        ) : <div className="muted small">No team yet.</div>}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Practice defaults</h3></div>
        <div className="field"><label>Usual length</label><div className="chips">{[60, 75, 90, 120].map((m) => <button key={m} className={`chip sm ${settings.defaultDurationMin === m ? 'on' : ''}`} onClick={() => saveSettings({ defaultDurationMin: m })}>{m} min</button>)}</div></div>
        <div className="field"><label>Usual coaches</label><div className="chips">{[1, 2, 3, 4].map((n) => <button key={n} className={`chip sm ${settings.defaultCoaches === n ? 'on' : ''}`} onClick={() => saveSettings({ defaultCoaches: n })}>{n}</button>)}</div></div>
        <div className="field"><label>Usual space</label><div className="chips">{(['tight', 'half', 'full'] as Space[]).map((s) => <button key={s} className={`chip sm ${settings.defaultSpace === s ? 'on' : ''}`} onClick={() => saveSettings({ defaultSpace: s })}>{SPACE_LABEL[s]}</button>)}</div></div>
        <div className="field"><label>Equipment you usually have</label><div className="chips">{(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => <button key={e} className={`chip sm ${settings.defaultEquipment.includes(e) ? 'on' : ''}`} onClick={() => saveSettings({ defaultEquipment: settings.defaultEquipment.includes(e) ? settings.defaultEquipment.filter((x) => x !== e) : [...settings.defaultEquipment, e] })}>{EQUIPMENT_LABEL[e]}</button>)}</div></div>
        {settings.packIdentity ? (
          <div className="field"><label>Your name on notes</label><div className="small"><strong>{settings.packIdentity.name}</strong>, set by {settings.packIdentity.from ? `${settings.packIdentity.from}'s` : 'the'} coach pack. Every note you take goes back tagged with it; nothing to type.</div></div>
        ) : (
          <div className="field"><label>Your name on notes and parent drafts ("Coach ...")</label><TextSetting value={settings.coachName ?? ''} placeholder="Deren" onSave={(v) => saveSettings({ coachName: v || undefined })} /></div>
        )}
        <div className="field"><label>Suggest a parent update after</label><div className="chips">{[2, 3, 4, 6].map((n) => <button key={n} className={`chip sm ${settings.parentUpdateEveryPractices === n ? 'on' : ''}`} onClick={() => saveSettings({ parentUpdateEveryPractices: n })}>{n} practices</button>)}</div></div>
        <div className="field"><label>App name when a team has no program name</label><TextSetting value={settings.appName} placeholder="Dugout Lab" onSave={(v) => saveSettings({ appName: v || 'Dugout Lab' })} /><div className="muted small">The home-screen icon's name is set when it is added and does not change with this.</div></div>
      </div>

      <div className="card" id="backup">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Backup</h3><span className="muted small">{settings.lastBackupAt ? `last ${new Date(settings.lastBackupAt).toLocaleDateString()}` : 'never'}</span></div>
        <p className="muted small" style={{ marginTop: 0 }}>One file with everything: roster, profiles, notes, drills, versions, practices. Keep it in Files or iCloud. Restoring merges by default and never throws away a newer note on this phone.</p>
        <div className="row wrap">
          <button className="btn primary" data-tour="backup" onClick={exportBackup} disabled={busy}>{busy ? 'Working…' : 'Back up now'}</button>
          <button className="btn" onClick={openBackup}>Restore from a backup</button>
        </div>
        {health && <div className={`banner ${health.verdict === 'install' ? 'warn' : 'info'} small`} style={{ marginTop: 10 }}>{health.message}{health.usageBytes != null ? ` Using ${(health.usageBytes / 1024 / 1024).toFixed(1)} MB.` : ''}</div>}
        {health?.verdict === 'install' && <button className="btn sm" onClick={async () => { await requestPersistence(); setHealth(await storageHealth()); }}>Ask the browser to keep this data</button>}
      </div>

      <SyncCard team={team} fallback={<>
        <p className="muted small" style={{ marginTop: 0 }}>Each coach runs the app on his own phone. Pick who you are sending to; the pack carries his name, his phone is set up as his in one tap, and every note he sends back is tagged with it. He never types anything. The pack has the roster, drills, player versions and the plan; no family contacts, no private notes.</p>
        {team?.helpers?.length ? (
          <div className="list" style={{ marginBottom: 8 }}>
            {team.helpers.map((h) => (
              <div key={h.id} className="item small">
                <div className="grow"><div className="title">{h.name}{h.role ? <span className="muted"> · {h.role}</span> : null}</div><div className="sub">{h.lastSentAt ? `Pack sent ${new Date(h.lastSentAt).toLocaleDateString()}` : 'No pack sent yet'}{h.lastReceivedAt ? ` · notes back ${new Date(h.lastReceivedAt).toLocaleDateString()}` : ''}</div></div>
                <button className="btn sm" disabled={busy} onClick={() => sendPack(h)}>Send a pack</button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="row wrap">
          <button className="btn primary" disabled={!team || busy} onClick={() => setPackSheet(true)}>{team?.helpers?.length ? '+ New person' : 'Send a coach pack'}</button>
          <button className="btn" onClick={openBackup}>Merge a coach's backup</button>
        </div>
      </>} />

      <div className="card" id="dugout-dad">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Roster from Dugout Dad</h3></div>
        <p className="muted small" style={{ marginTop: 0 }}>Optional. In Dugout Dad, Transfer, "Export the weekend", save the file, then open it here. Only names, numbers and throwing/batting hands are copied, into the team you choose. Nothing in Dugout Dad changes.</p>
        <button className="btn" onClick={openDad} disabled={!team}>Open a Dugout Dad archive</button>
        {!team && <div className="muted small" style={{ marginTop: 6 }}>Create a team first so the roster has somewhere to go.</div>}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>Demo team</h3></div>
        <p className="muted small" style={{ marginTop: 0 }}>Twelve fictional players, a finished practice and one planned for today. Marked DEMO everywhere; removed in one tap.</p>
        <div className="row wrap">
          <button className="btn" onClick={async () => { setBusy(true); try { const r = await loadDemoData(); toast.show('Demo loaded'); nav(`/practices/${r.practiceId}`); } finally { setBusy(false); } }} disabled={busy}>Load demo team</button>
          {teams.some((t) => t.id === DEMO_TEAM_ID) && <button className="btn" onClick={() => setRemoveDemo(true)}>Remove demo data</button>}
        </div>
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>App lock</h3><span className="muted small">{settings.pinHash ? 'on' : 'off'}</span></div>
        <p className="muted small" style={{ marginTop: 0 }}>A PIN the app asks for when it opens and after ten minutes in the background. Keeps a borrowed phone out of the kids' notes. It is a lock on the door, not a safe: keep a backup file somewhere else.</p>
        <PinControls hasPin={!!settings.pinHash} onSet={async (pin) => { const salt = Math.random().toString(36).slice(2, 12); await saveSettings({ pinSalt: salt, pinHash: await pinHashFor(pin, salt) }); toast.show('PIN set'); }} onClear={async () => { await saveSettings({ pinHash: undefined, pinSalt: undefined }); toast.show('PIN removed'); }} />
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}><h3>About</h3></div>
        <p className="small muted">Dugout Lab {APP_VERSION}. No account, no server, no tracking. Everything stays on this device until you back it up. Notes about players are private to you. <Link to="/help">How it works</Link>.</p>
        <button className="btn sm" style={{ color: 'var(--danger)' }} onClick={() => setWipe(true)}>Erase everything on this device</button>
      </div>

      {packSheet && team && <HelperSheet team={team} onClose={() => setPackSheet(false)} onPick={(h) => { setPackSheet(false); sendPack(h); }} />}
      {brandSheet && team && <BrandSheet team={team} onClose={() => setBrandSheet(false)} onSaved={() => { setBrandSheet(false); toast.show('Branding saved'); }} />}
      {ready && (
        <Sheet title={ready.kind === 'backup' ? 'Backup ready' : ready.forName ? `Pack for ${ready.forName} is ready` : 'Coach pack ready'} onClose={() => setReady(null)} footer={<><button className="btn" onClick={() => setReady(null)}>Cancel</button><button className="btn primary" onClick={shareReady}>{ready.kind === 'backup' ? 'Save or share it' : 'Share it'}</button></>}>
          <div className="small">{ready.fileName} · {(ready.bytes.length / 1024).toFixed(0)} KB{ready.records ? ` · ${ready.records} records` : ''}</div>
          {ready.forName && <p className="small">Text or AirDrop it to {ready.forName}. He opens it in Dugout Lab (Settings, Restore from a backup) and taps one button; his phone is set up as his and every note comes back tagged {ready.forName}.</p>}
          <p className="muted small">On a phone this opens the share sheet: Save to Files, AirDrop, Mail, Messages. On a computer it downloads.</p>
        </Sheet>
      )}
      {teamSheet && <TeamSheet mode={teamSheet} team={teamSheet === 'edit' ? team : undefined} onClose={() => setTeamSheet(null)} onSaved={() => { setTeamSheet(null); toast.show('Saved'); }} />}
      {restore && (
        <Sheet title="Restore from backup" onClose={() => setRestore(null)}>
          <div className="small">{restore.contents.manifest.recipient && restore.contents.manifest.kind !== 'coach-pack' ? `From ${restore.contents.manifest.recipient.name} (the pack you sent), ` : restore.contents.manifest.coachName ? `From ${restore.contents.manifest.coachName}, ` : 'Backup from '}{new Date(restore.contents.manifest.createdAt).toLocaleString()} (app {restore.contents.manifest.appVersion}). {Object.entries(restore.contents.manifest.files).filter(([n]) => n !== 'settings.json' && n !== 'manifest.json').map(([n, f]) => `${f.records} ${n.replace('.json', '').replace('parentUpdates', 'parent updates')}`).join(', ')}.</div>
          {!restore.report && restore.contents.manifest.kind === 'coach-pack' && restore.contents.manifest.recipient ? (
            <div className="col" style={{ marginTop: 12 }}>
              <div className="banner info small">Coach pack{restore.contents.manifest.recipient.from ? ` from ${restore.contents.manifest.recipient.from}` : ''}, made for <strong>{restore.contents.manifest.recipient.name}</strong>. This phone will be set up as {restore.contents.manifest.recipient.name}'s: same team, same plan, and every note tagged with that name.</div>
              <button className="btn primary big-btn block" onClick={async () => { const mode = teams.some((t) => t.id === restore.contents.manifest.recipient!.teamId) ? 'merge' : 'replace'; const report = await restoreBackup(restore.contents, mode); setRestore({ ...restore, report }); }}>Set up this phone as {restore.contents.manifest.recipient.name}</button>
              {settings.packIdentity && settings.packIdentity.helperId !== restore.contents.manifest.recipient.helperId && <div className="small muted">This phone is currently set up as {settings.packIdentity.name}. Setting it up as {restore.contents.manifest.recipient.name} changes who the notes are tagged with from now on.</div>}
            </div>
          ) : !restore.report ? (
            <div className="col" style={{ marginTop: 12 }}>
              <button className="btn primary block" onClick={async () => { const report = await restoreBackup(restore.contents, 'merge'); setRestore({ ...restore, report }); }}>Merge into this device (safe)</button>
              <button className="btn block" onClick={async () => { if (!confirm('Replace everything on this device with the backup?')) return; const report = await restoreBackup(restore.contents, 'replace'); setRestore({ ...restore, report }); }}>Replace everything with the backup</button>
              <p className="muted small">Merge adds what is missing and updates records where the backup is newer. Anything newer on this device is kept and listed.</p>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="banner info small">Done ({restore.report.mode}). Added: {Object.entries(restore.report.added).filter(([, n]) => n).map(([t, n]) => `${n} ${t}`).join(', ') || 'nothing'}. Updated: {Object.entries(restore.report.updated).filter(([, n]) => n).map(([t, n]) => `${n} ${t}`).join(', ') || 'nothing'}.</div>
              {restore.report.keptNewerHere.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>{restore.report.keptNewerHere.length} record{restore.report.keptNewerHere.length > 1 ? 's were' : ' was'} newer on this device; lists like goals and cues were combined, nothing was thrown away.</div>}
              {!settings.coachName && !settings.packIdentity && (
                <div className="field" style={{ marginTop: 10 }}><label>Your first name, so your notes carry it</label><TextSetting value="" placeholder="Aaron" onSave={(v) => saveSettings({ coachName: v || undefined })} /></div>
              )}
              <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => { setRestore(null); nav('/today'); }}>Done</button>
            </div>
          )}
        </Sheet>
      )}
      {dad && (
        <Sheet title="Import roster from Dugout Dad" onClose={() => setDad(null)}>
          {!dad.plan ? (
            <>
              <div className="field"><label>Team in the archive</label><div className="chips">{dad.roster.teams.map((t) => <button key={t.id} className={`chip sm ${dad.dadTeamId === t.id ? 'on' : ''}`} onClick={() => setDad({ ...dad, dadTeamId: t.id })}>{t.name}{t.isMine ? ' (mine)' : ''}</button>)}</div></div>
              <div className="field"><label>Into this Dugout Lab team</label><div className="chips">{teams.map((t) => <button key={t.id} className={`chip sm ${dad.labTeamId === t.id ? 'on' : ''}`} onClick={() => setDad({ ...dad, labTeamId: t.id })}>{t.shortName ?? t.name}</button>)}</div></div>
              <button className="btn primary block" disabled={!dad.dadTeamId || !dad.labTeamId} onClick={async () => setDad({ ...dad, plan: await planRosterImport(dad.roster, dad.dadTeamId!) })}>Preview</button>
            </>
          ) : (
            <>
              <div className="small"><strong>{dad.plan.create.length}</strong> to add: {dad.plan.create.map((p) => `${p.number ? '#' + p.number + ' ' : ''}${p.firstName} ${p.lastName}`).join(', ') || 'none'}</div>
              <div className="small" style={{ marginTop: 4 }}><strong>{dad.plan.update.length}</strong> already here (names and numbers refreshed): {dad.plan.update.map((u) => playerName(u.existing, 'short')).join(', ') || 'none'}</div>
              <div className="small muted" style={{ marginTop: 4 }}>Skipped: {dad.plan.skipped.map((s) => `${s.player.firstName} ${s.player.lastName} (${s.why})`).join(', ') || 'none'}</div>
              <button className="btn primary block" style={{ marginTop: 10 }} onClick={async () => { const r = await commitRosterImport(dad.plan!, dad.labTeamId!); toast.show(`${r.created} added, ${r.updated} updated`); setDad(null); nav('/players'); }}>Import {dad.plan.create.length + dad.plan.update.length} players</button>
            </>
          )}
        </Sheet>
      )}
      {removeDemo && <Confirm title="Remove the demo team?" text="The fictional players, their notes and practices are deleted. Your own teams are untouched." danger yesLabel="Remove" onNo={() => setRemoveDemo(false)} onYes={async () => { const n = await removeDemoData(); setRemoveDemo(false); toast.show(`Removed ${n} demo records`); }} />}
      {wipe && <Confirm title="Erase everything?" text="All teams, players, notes, custom drills and practices on this device are deleted. Make a backup first if you want any of it back." danger yesLabel="Erase" onNo={() => setWipe(false)} onYes={async () => { await db.delete(); window.location.reload(); }} />}
      {toast.el}
    </div>
  );
}

function TeamSheet({ mode, team, onClose, onSaved }: { mode: 'new' | 'edit'; team?: import('../../engine/types').Team; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(team?.name ?? '');
  const [shortName, setShortName] = useState(team?.shortName ?? '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(team?.ageGroup ?? '12U');
  const [gradYear, setGradYear] = useState<number | undefined>(team?.gradYear);
  const seasonYear = seasonYearFor();
  const classYears = Array.from({ length: 13 }, (_, i) => seasonYear + i); // 18U this season down to 6U
  const [season, setSeason] = useState(team?.season ?? '');
  const [priorities, setPriorities] = useState<Category[]>(team?.priorities ?? []);
  const toggle = (c: Category) => setPriorities(priorities.includes(c) ? priorities.filter((x) => x !== c) : [...priorities, c].slice(0, 4));
  return (
    <Sheet title={mode === 'new' ? 'New team' : 'Edit team'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={async () => { const ag = gradYear ? ageGroupForClass(gradYear) : ageGroup; if (mode === 'new') { const t = await createTeam({ name: name.trim(), shortName: shortName || undefined, ageGroup: ag, gradYear, season: season || undefined, priorities }); await saveSettings({ teamId: t.id }); } else if (team) await updateTeam(team.id, { name: name.trim(), shortName: shortName || undefined, ageGroup: ag, gradYear, season: season || undefined, priorities }); onSaved(); }}>Save</button></>}>
      <div className="field"><label>Team name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Warriors 13U" /></div>
      <div className="inline-fields">
        <div className="field"><label>Short name</label><input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} /></div>
        <div className="field"><label>Season</label><input className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Spring 2027" /></div>
      </div>
      <div className="field"><label>Graduation year (the age group then follows the calendar)</label>
        <div className="chips">{classYears.map((y) => <button key={y} className={`chip sm ${gradYear === y ? 'on' : ''}`} onClick={() => setGradYear(gradYear === y ? undefined : y)}>Class of {y}<span className="muted"> · {ageGroupForClass(y)}</span></button>)}</div>
        {gradYear ? <div className="muted small">Plays as {ageGroupForClass(gradYear)} for the {seasonYear} season; fall ball counts toward the coming spring. Next year it moves up on its own.</div> : <div className="muted small">Or pick a fixed age group below (school team, one-off tournament team).</div>}
      </div>
      {!gradYear && <div className="field"><label>Fixed age group</label><div className="chips">{AGE_GROUPS.map((a) => <button key={a} className={`chip sm ${ageGroup === a ? 'on' : ''}`} onClick={() => setAgeGroup(a)}>{a}</button>)}</div></div>}
      <div className="field"><label>Team priorities, in order (up to four)</label><div className="chips">{CATEGORIES.map((c) => { const i = priorities.indexOf(c); return <button key={c} className={`chip sm ${i >= 0 ? 'on' : ''}`} onClick={() => toggle(c)}>{i >= 0 ? `${i + 1}. ` : ''}{CATEGORY_LABEL[c]}</button>; })}</div></div>
    </Sheet>
  );
}

function PinControls({ hasPin, onSet, onClear }: { hasPin: boolean; onSet: (pin: string) => void; onClear: () => void }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const ok = pin.length >= 4 && pin === again;
  return (
    <div>
      <div className="inline-fields">
        <div className="field"><label>{hasPin ? 'New PIN' : 'PIN (4 to 8 digits)'}</label><input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
        <div className="field"><label>Again</label><input className="input" type="password" inputMode="numeric" value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, '').slice(0, 8))} /></div>
      </div>
      <div className="row wrap">
        <button className="btn primary sm" disabled={!ok} onClick={() => { onSet(pin); setPin(''); setAgain(''); }}>{hasPin ? 'Change PIN' : 'Turn on'}</button>
        {hasPin && <button className="btn sm" onClick={onClear}>Turn off</button>}
      </div>
    </div>
  );
}

/** A text field that saves when you leave it, so typing on a phone is never fighting the database. */
function TextSetting({ value, placeholder, onSave }: { value: string; placeholder?: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="input" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v.trim()); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

/** Pick who a coach pack is for: someone used before, or a new person. The name travels with the pack. */
function HelperSheet({ team, onClose, onPick }: { team: Team; onClose: () => void; onPick: (h: Helper) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const existing = team.helpers ?? [];
  const brandNames = (team.brand?.coaches ?? []).map((c) => c.name).filter((n) => n && !existing.some((h) => h.name.toLowerCase() === n.toLowerCase()));
  return (
    <Sheet title="Who is this pack for?" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={() => onPick({ id: `h-${Date.now().toString(36)}`, name: name.trim(), role: role.trim() || undefined, createdAt: nowIso() })}>Make the pack</button></>}>
      {existing.length > 0 && <div className="field"><label>Used before</label><div className="chips">{existing.map((h) => <button key={h.id} className="chip" onClick={() => onPick(h)}>{h.name}</button>)}</div></div>}
      {brandNames.length > 0 && <div className="field"><label>From your coaches list</label><div className="chips">{brandNames.map((n) => <button key={n} className="chip sm" onClick={() => setName(n)}>{n}</button>)}</div></div>}
      <div className="field"><label>New person's first name (what the notes will say)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mark" autoFocus={existing.length === 0} /></div>
      <div className="field"><label>Role (optional)</label><div className="chips">{['Assistant', 'Parent coach', 'Guest coach'].map((r) => <button key={r} className={`chip sm ${role === r ? 'on' : ''}`} onClick={() => setRole(role === r ? '' : r)}>{r}</button>)}</div></div>
    </Sheet>
  );
}
