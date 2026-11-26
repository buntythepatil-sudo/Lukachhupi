import { User as FirebaseUser } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Crown,
  Loader2,
  LogIn,
  MapPin,
  Medal,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import {
  fetchGlobalLeaderboard,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardSnapshot,
} from '../game/leaderboardService';
import { TOTAL_LEVELS } from '../game/levels';
import { ProfileAvatar } from './ProfileAvatar';

interface LeaderboardPanelProps {
  firebaseUser: FirebaseUser | null;
  authBusy: boolean;
  playerUsername: string;
  playerAvatarId: string;
  refreshToken: number;
  onSignInGoogle: () => void;
}

const PERIOD_TABS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'all_time', label: 'All-Time' },
];

export function LeaderboardPanel({
  firebaseUser,
  authBusy,
  playerUsername,
  playerAvatarId,
  refreshToken,
  onSignInGoogle,
}: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlobalLeaderboard(period);
      setSnapshot(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load the leaderboard right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard, firebaseUser?.uid, refreshToken]);

  const entries = snapshot?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const currentUid = firebaseUser?.uid ?? null;
  const currentUserRank = snapshot?.currentUser ?? null;

  const podiumOrder: Array<{
    rank: 1 | 2 | 3;
    entry: LeaderboardEntry | undefined;
  }> = [
    { rank: 2, entry: top3[1] },
    { rank: 1, entry: top3[0] },
    { rank: 3, entry: top3[2] },
  ];

  return (
    <div className="mt-2.5 space-y-3 pb-2">
      {/* Segmented Period Selector: Daily / Weekly / All-Time */}
      <div
        role="tablist"
        aria-label="Leaderboard time period"
        className="grid grid-cols-3 gap-1 rounded-xl border border-amber-200/20 bg-[#140d09]/90 p-1"
      >
        {PERIOD_TABS.map((tab) => {
          const active = period === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(tab.id)}
              className={`min-h-[40px] rounded-lg px-2 py-1.5 text-xs font-bold tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                active
                  ? 'bg-[#d96b27] text-white shadow-sm'
                  : 'text-amber-100/75 hover:text-amber-50 hover:bg-[#231710]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Period Info & Refresh Strip */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-200/90">
            <ShieldCheck
              className="w-3.5 h-3.5 text-emerald-300 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">
              {snapshot?.resetLabel ?? 'Verified match wins'}
            </span>
          </div>
          <div className="text-[10.5px] text-amber-100/60 tabular-nums">
            Top 100 · {snapshot?.totalPlayers ?? 0}{' '}
            {(snapshot?.totalPlayers ?? 0) === 1 ? 'player' : 'players'} ranked
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadLeaderboard()}
          disabled={loading}
          aria-label="Refresh leaderboard"
          className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl border border-amber-100/20 bg-[#160e0a] hover:bg-[#2a1c13] text-amber-200 transition-colors cursor-pointer disabled:opacity-50 shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Current Player Highlighted Ranking Card */}
      {firebaseUser ? (
        <div className="rounded-xl border border-amber-300/45 bg-gradient-to-r from-amber-500/18 via-[#261910] to-[#1a110b] px-3 py-2.5 shadow-md">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex flex-col items-center justify-center min-w-[44px] h-[44px] rounded-lg border border-amber-300/40 bg-[#140d09]/90 px-1.5 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/75">
                  Rank
                </span>
                <span className="text-sm font-extrabold text-amber-300 leading-tight tabular-nums">
                  {currentUserRank?.rank ? `#${currentUserRank.rank}` : '—'}
                </span>
              </div>

              <ProfileAvatar
                avatarId={currentUserRank?.avatarId || playerAvatarId}
                sizeClass="w-10 h-10"
                className="ring-1 ring-amber-300/50 shrink-0"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-amber-50 truncate">
                    {currentUserRank?.username || playerUsername}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 shrink-0">
                    You
                  </span>
                </div>
                <div className="text-[11px] text-amber-100/70 tabular-nums">
                  {currentUserRank?.rank
                    ? `${currentUserRank.completedLevelsCount}/${TOTAL_LEVELS} levels completed`
                    : 'Win a match to enter the rankings'}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-base font-extrabold text-amber-300 leading-tight tabular-nums">
                {currentUserRank?.wins ?? 0}
              </div>
              <div className="text-[10px] font-semibold text-amber-100/65">
                {(currentUserRank?.wins ?? 0) === 1 ? 'win' : 'wins'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200/20 bg-[#150e0a]/90 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-100">
                Sign in to rank globally
              </div>
              <div className="text-[11px] text-amber-100/65">
                Verified Google accounts track daily, weekly &amp; all-time wins.
              </div>
            </div>
            <button
              type="button"
              onClick={onSignInGoogle}
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-[#d96b27] hover:bg-[#e87933] px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{authBusy ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !snapshot && (
        <div className="flex flex-col items-center justify-center py-10 text-amber-100/75">
          <Loader2
            className="w-6 h-6 animate-spin text-amber-300 mb-2"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold">
            Loading village rankings...
          </span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-950/35 px-3.5 py-4 text-center">
          <p className="text-xs font-semibold text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            className="mt-2.5 inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg border border-amber-200/25 bg-[#2a1c13] hover:bg-[#382519] px-3.5 py-1.5 text-xs font-bold text-amber-100 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && entries.length === 0 && (
        <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 px-4 py-8 text-center">
          <Trophy
            className="w-8 h-8 text-amber-300/70 mx-auto mb-2"
            aria-hidden="true"
          />
          <div className="text-sm font-bold text-amber-50">
            No verified wins yet
          </div>
          <p className="mt-1 text-xs text-amber-100/70">
            Finish a solo or multiplayer match while signed in to claim the #1
            spot on the{' '}
            {period === 'daily'
              ? 'daily'
              : period === 'weekly'
                ? 'weekly'
                : 'all-time'}{' '}
            board!
          </p>
        </div>
      )}

      {/* Top 3 Gold / Silver / Bronze Podium */}
      {!error && entries.length > 0 && (
        <>
          <div
            aria-label="Top 3 players"
            className="grid grid-cols-3 items-end gap-1.5 sm:gap-2 pt-1"
          >
            {podiumOrder.map(({ rank, entry }) => {
              const isGold = rank === 1;
              const isSilver = rank === 2;
              const isCurrent = Boolean(entry && currentUid && entry.uid === currentUid);

              const cardStyle = isGold
                ? 'border-amber-300/75 bg-gradient-to-b from-amber-500/26 via-[#2c1c0f] to-[#1a110b] shadow-lg'
                : isSilver
                  ? 'border-slate-300/55 bg-gradient-to-b from-slate-300/16 via-[#231912] to-[#17100b]'
                  : 'border-orange-400/55 bg-gradient-to-b from-orange-500/18 via-[#261810] to-[#17100b]';

              const medalColor = isGold
                ? 'text-amber-300'
                : isSilver
                  ? 'text-slate-200'
                  : 'text-orange-300';

              const rankLabel = isGold ? '1st · Gold' : isSilver ? '2nd · Silver' : '3rd · Bronze';

              if (!entry) {
                return (
                  <div
                    key={rank}
                    className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-100/15 bg-[#140d09]/60 px-2 text-center ${
                      isGold ? 'py-5' : 'py-3.5'
                    }`}
                  >
                    <span className={`text-[10px] font-bold ${medalColor}`}>
                      #{rank}
                    </span>
                    <span className="mt-1 text-[10px] text-amber-100/45">
                      Open spot
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={rank}
                  className={`relative flex flex-col items-center rounded-xl border px-1.5 text-center transition-colors ${cardStyle} ${
                    isGold ? 'py-3.5 -mt-1' : 'py-2.5'
                  } ${isCurrent ? 'ring-2 ring-amber-300/90' : ''}`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1.5">
                    {isGold ? (
                      <Crown
                        className="w-4 h-4 text-amber-300 fill-amber-300/30"
                        aria-hidden="true"
                      />
                    ) : isSilver ? (
                      <Medal
                        className="w-3.5 h-3.5 text-slate-200"
                        aria-hidden="true"
                      />
                    ) : (
                      <Award
                        className="w-3.5 h-3.5 text-orange-300"
                        aria-hidden="true"
                      />
                    )}
                    <span className={`text-[10px] font-extrabold ${medalColor}`}>
                      {rankLabel}
                    </span>
                  </div>

                  <ProfileAvatar
                    avatarId={entry.avatarId}
                    sizeClass={isGold ? 'w-12 h-12' : 'w-10 h-10'}
                    className={
                      isGold
                        ? 'ring-2 ring-amber-300 shadow-md'
                        : isSilver
                          ? 'ring-2 ring-slate-300/80'
                          : 'ring-2 ring-orange-400/80'
                    }
                  />

                  <div className="mt-1.5 w-full truncate text-[11px] sm:text-xs font-bold text-amber-50">
                    {entry.username}
                    {isCurrent && (
                      <span className="ml-1 text-[9.5px] font-extrabold text-amber-300">
                        (You)
                      </span>
                    )}
                  </div>

                  <div
                    className={`mt-0.5 text-sm sm:text-base font-extrabold tabular-nums ${medalColor}`}
                  >
                    {entry.wins}{' '}
                    <span className="text-[10px] font-semibold text-amber-100/75">
                      {entry.wins === 1 ? 'win' : 'wins'}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-amber-100/65 tabular-nums">
                    <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                    <span>
                      {entry.completedLevelsCount}/{TOTAL_LEVELS}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranks #4 through #100 */}
          {restEntries.length > 0 && (
            <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-100/10 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                <span>Player</span>
                <span>Wins · Maps</span>
              </div>

              <div className="divide-y divide-amber-100/10">
                {restEntries.map((entry) => {
                  const isCurrent = Boolean(
                    currentUid && entry.uid === currentUid,
                  );
                  return (
                    <div
                      key={entry.uid}
                      className={`flex items-center justify-between gap-2.5 px-3 py-2 ${
                        isCurrent
                          ? 'bg-amber-500/18 border-l-2 border-l-amber-300'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 text-center text-xs font-extrabold tabular-nums shrink-0 ${
                            isCurrent ? 'text-amber-300' : 'text-amber-100/65'
                          }`}
                        >
                          #{entry.rank}
                        </span>

                        <ProfileAvatar
                          avatarId={entry.avatarId}
                          sizeClass="w-8 h-8"
                          className="shrink-0"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-bold text-amber-50 truncate">
                              {entry.username}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold uppercase text-amber-300 shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-amber-100/60 tabular-nums">
                            {entry.completedLevelsCount}/{TOTAL_LEVELS} levels
                            completed
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-amber-200 tabular-nums">
                          {entry.wins}
                        </span>
                        <span className="ml-1 text-[10px] font-semibold text-amber-100/60">
                          {entry.wins === 1 ? 'win' : 'wins'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
