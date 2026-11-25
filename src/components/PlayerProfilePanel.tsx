import { User as FirebaseUser } from 'firebase/auth';
import {
  Award,
  Check,
  Cloud,
  CloudOff,
  Flame,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LEVEL_CONFIGS, TOTAL_LEVELS } from '../game/levels';
import {
  clampUsername,
  getTotalEarnedStars,
  PlayerStatsProfile,
  PROFILE_USERNAME_MAX_LENGTH,
} from '../game/playerProfile';
import { PROFILE_AVATAR_OPTIONS, ProfileAvatar } from './ProfileAvatar';

export type ProfileSyncState = 'offline' | 'syncing' | 'synced' | 'error';

interface PlayerProfilePanelProps {
  profile: PlayerStatsProfile;
  firebaseUser: FirebaseUser | null;
  syncState: ProfileSyncState;
  syncError: string | null;
  authBusy: boolean;
  onUpdateIdentity: (username: string, avatarId: string) => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onManualSync: () => void;
}

export function PlayerProfilePanel({
  profile,
  firebaseUser,
  syncState,
  syncError,
  authBusy,
  onUpdateIdentity,
  onSignInGoogle,
  onSignOutGoogle,
  onManualSync,
}: PlayerProfilePanelProps) {
  const [draftName, setDraftName] = useState(profile.username);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setDraftName(profile.username);
  }, [profile.username]);

  const totalEarnedStars = getTotalEarnedStars(profile);
  const maxStars = TOTAL_LEVELS * 3;
  const completedCount = profile.completedLevels.length;
  const winRate =
    profile.matchesPlayed > 0
      ? Math.round((profile.matchesWon / profile.matchesPlayed) * 100)
      : 0;

  const handleSaveUsername = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = clampUsername(draftName, profile.username);
    setDraftName(cleaned);
    onUpdateIdentity(cleaned, profile.avatarId);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1600);
  };

  const handlePickAvatar = (avatarId: string) => {
    const cleaned = clampUsername(draftName, profile.username);
    onUpdateIdentity(cleaned, avatarId);
  };

  return (
    <div className="mt-2 sm:mt-3 space-y-2.5 text-xs">
      {/* 1. Profile Identity Card: Picture, Username & Online Sync Status */}
      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 sm:p-3">
        <div className="flex items-center gap-2.5">
          <ProfileAvatar
            avatarId={profile.avatarId}
            sizeClass="w-12 h-12 sm:w-14 sm:h-14"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
                Player Profile
              </span>
              {firebaseUser ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                    syncState === 'syncing'
                      ? 'text-amber-300'
                      : syncState === 'error'
                        ? 'text-rose-300'
                        : 'text-emerald-300'
                  }`}
                >
                  <Cloud className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {syncState === 'syncing'
                    ? 'Syncing...'
                    : syncState === 'error'
                      ? 'Sync Issue'
                      : 'Cloud Synced'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-100/60">
                  <CloudOff className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Local Save
                </span>
              )}
            </div>

            <form
              onSubmit={handleSaveUsername}
              className="mt-1 flex items-center gap-1.5"
            >
              <input
                type="text"
                aria-label="Player username"
                value={draftName}
                onChange={(e) =>
                  setDraftName(e.target.value.slice(0, PROFILE_USERNAME_MAX_LENGTH))
                }
                maxLength={PROFILE_USERNAME_MAX_LENGTH}
                placeholder="Enter username"
                className="flex-1 min-w-0 min-h-[32px] rounded-lg border border-amber-100/20 bg-[#0f0906] px-2.5 py-1 text-xs font-bold text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 min-h-[32px] rounded-lg bg-[#d96b27] hover:bg-[#e57731] px-2.5 py-1 text-[11px] font-bold text-white transition-colors shrink-0 cursor-pointer"
              >
                {savedToast ? (
                  <>
                    <Check className="w-3 h-3" aria-hidden="true" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Profile Picture Selector */}
        <div className="mt-2.5 pt-2 border-t border-amber-100/10">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-semibold text-amber-200/90">
              Choose Profile Picture
            </span>
            <span className="text-[10px] text-amber-100/55">
              12 Village Portraits
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {PROFILE_AVATAR_OPTIONS.map((av) => {
              const selected = profile.avatarId === av.id;
              return (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => handlePickAvatar(av.id)}
                  aria-label={`Choose ${av.label} avatar`}
                  aria-pressed={selected}
                  title={av.label}
                  className={`flex flex-col items-center justify-center rounded-lg border py-1 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    selected
                      ? 'bg-amber-500/25 border-amber-300 scale-[1.03]'
                      : 'bg-[#100a07]/85 border-amber-100/12 hover:border-amber-200/35'
                  }`}
                >
                  <ProfileAvatar avatarId={av.id} sizeClass="w-7 h-7" />
                  <span className="mt-0.5 text-[8.5px] font-semibold text-amber-100/85 truncate max-w-full px-0.5">
                    {av.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Online Cross-Device Cloud Sync (Google Account) */}
      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck
              className="w-4 h-4 text-amber-300 shrink-0"
              aria-hidden="true"
            />
            <span className="text-[11px] font-bold text-amber-50 truncate">
              Cross-Device Account Sync
            </span>
          </div>
          {firebaseUser && (
            <span className="text-[10px] font-semibold text-emerald-300 shrink-0">
              Online Active
            </span>
          )}
        </div>

        {syncError && (
          <div className="mt-1.5 rounded-lg border border-rose-400/40 bg-rose-950/75 px-2.5 py-1.5 text-[10.5px] text-rose-100">
            {syncError}
          </div>
        )}

        {firebaseUser ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#0f0906] border border-amber-100/10 px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-amber-50 truncate">
                  {firebaseUser.displayName || profile.username}
                </div>
                <div className="text-[10px] text-amber-100/60 truncate">
                  {firebaseUser.email || 'Google Account Connected'}
                </div>
              </div>
              <button
                type="button"
                onClick={onManualSync}
                disabled={syncState === 'syncing'}
                aria-label="Sync statistics now"
                className="inline-flex items-center gap-1 min-h-[28px] rounded-lg border border-amber-200/25 bg-[#231710] hover:bg-[#2f1f16] px-2 py-1 text-[10.5px] font-semibold text-amber-200 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3 h-3 ${syncState === 'syncing' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>Sync</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSignOutGoogle}
              disabled={authBusy}
              className="w-full inline-flex items-center justify-center gap-1.5 min-h-[34px] rounded-lg border border-amber-100/15 bg-[#1e140e] hover:bg-[#2d1812] px-3 py-1 text-[11px] font-semibold text-amber-100/85 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="mt-1.5">
            <p className="text-[10.5px] text-amber-100/70 leading-snug">
              Progress saves automatically on this device. Sign in with Google to sync your profile, stats, unlocked maps, and stars across devices.
            </p>
            <button
              type="button"
              onClick={onSignInGoogle}
              disabled={authBusy}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 min-h-[38px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3 py-1.5 text-xs font-bold text-[#1d140e] transition-colors cursor-pointer disabled:opacity-60"
            >
              <Cloud className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {authBusy ? 'Connecting Google Account...' : 'Sign in with Google to Sync'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Player Statistics Summary */}
      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 sm:p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span className="text-[11px] font-bold text-amber-50">
              Match Statistics
            </span>
          </div>
          <span className="text-[10px] font-mono tabular-nums font-semibold text-amber-300">
            {winRate}% Win Rate
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-amber-100/10 bg-[#0f0906] px-2 py-1.5 text-center">
            <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-amber-50">
              {profile.matchesPlayed}
            </div>
            <div className="text-[9.5px] text-amber-100/65 leading-tight">
              Matches Played
            </div>
          </div>

          <div className="rounded-lg border border-emerald-400/20 bg-emerald-950/35 px-2 py-1.5 text-center">
            <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-emerald-300">
              {profile.matchesWon}
            </div>
            <div className="text-[9.5px] text-emerald-200/80 leading-tight">
              Total Wins
            </div>
          </div>

          <div className="rounded-lg border border-rose-400/20 bg-rose-950/30 px-2 py-1.5 text-center">
            <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-rose-300">
              {profile.matchesLost}
            </div>
            <div className="text-[9.5px] text-rose-200/75 leading-tight">
              Losses
            </div>
          </div>

          <div className="rounded-lg border border-amber-300/25 bg-amber-950/30 px-2 py-1.5 text-center">
            <div className="inline-flex items-center justify-center gap-1 font-mono text-sm sm:text-base font-bold tabular-nums text-amber-300">
              <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{profile.currentWinStreak}</span>
            </div>
            <div className="text-[9.5px] text-amber-100/70 leading-tight">
              Win Streak
            </div>
            <div className="text-[8.5px] text-amber-200/55 tabular-nums">
              Best: {profile.bestWinStreak}
            </div>
          </div>

          <div className="rounded-lg border border-amber-100/10 bg-[#0f0906] px-2 py-1.5 text-center">
            <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-orange-300">
              {profile.timesAsSeeker}
            </div>
            <div className="text-[9.5px] text-amber-100/65 leading-tight">
              Times Seeker
            </div>
          </div>

          <div className="rounded-lg border border-amber-100/10 bg-[#0f0906] px-2 py-1.5 text-center">
            <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-sky-300">
              {profile.successfulHidingRounds}
            </div>
            <div className="text-[9.5px] text-amber-100/65 leading-tight">
              Hides Won
            </div>
          </div>
        </div>
      </div>

      {/* 4. Unlocked Maps, Completed Levels & Earned Stars */}
      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-300" aria-hidden="true" />
            <span className="text-[11px] font-bold text-amber-50">
              Maps &amp; Earned Stars
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
            <span className="text-amber-200/90">
              Maps {profile.unlockedLevel}/{TOTAL_LEVELS}
            </span>
            <span className="text-emerald-300">
              Done {completedCount}/{TOTAL_LEVELS}
            </span>
            <span className="inline-flex items-center gap-0.5 text-amber-300 font-bold">
              <Star className="w-3 h-3 fill-amber-300" aria-hidden="true" />
              {totalEarnedStars}/{maxStars}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {LEVEL_CONFIGS.map((lvl) => {
            const isUnlocked = lvl.id <= profile.unlockedLevel;
            const isCompleted = profile.completedLevels.includes(lvl.id);
            const stars = profile.levelStars[String(lvl.id)] ?? 0;

            return (
              <div
                key={lvl.id}
                className={`rounded-lg border px-2 py-1.5 ${
                  isCompleted
                    ? 'border-emerald-400/30 bg-emerald-950/25'
                    : isUnlocked
                      ? 'border-amber-100/15 bg-[#0f0906]'
                      : 'border-amber-100/8 bg-[#0b0705]/70 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold text-amber-300">
                    L{lvl.id}
                  </span>
                  {isUnlocked ? (
                    <div
                      className="flex items-center gap-0.5"
                      aria-label={`${stars} of 3 stars`}
                    >
                      {[1, 2, 3].map((idx) => (
                        <Star
                          key={idx}
                          className={`w-3 h-3 ${
                            idx <= stars
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-amber-100/20'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  ) : (
                    <Lock
                      className="w-3 h-3 text-amber-100/45"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-bold text-amber-50 truncate">
                  {lvl.name}
                </div>
                <div className="text-[9.5px] text-amber-100/60">
                  {isCompleted
                    ? 'Completed'
                    : isUnlocked
                      ? 'Unlocked'
                      : `Locked (Win L${lvl.id - 1})`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
