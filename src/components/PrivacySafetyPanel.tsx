import { User as FirebaseUser } from 'firebase/auth';
import {
  AlertTriangle,
  Ban,
  Check,
  Cloud,
  EyeOff,
  Flag,
  Lock,
  LogOut,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { DirectoryPlayer, FriendRecord, BlockedRecord } from '../game/friendsService';
import { PROFILE_USERNAME_MAX_LENGTH } from '../game/playerProfile';
import {
  MAX_PLAYER_REPORT_DETAILS_LENGTH,
  PLAYER_REPORT_REASONS,
  PlayerReportReason,
  PlayerReportRecord,
  PrivacySafetySettings,
} from '../game/privacyService';
import { ProfileAvatar } from './ProfileAvatar';

type PrivacyTab = 'privacy' | 'safety' | 'account';

interface PrivacySafetyPanelProps {
  firebaseUser: FirebaseUser | null;
  authBusy: boolean;
  privacySettings: PrivacySafetySettings;
  privacyNotice: string | null;
  friends: FriendRecord[];
  blockedUsers: BlockedRecord[];
  submittedReports: PlayerReportRecord[];
  roomPlayers: Array<{ id: string; name: string }>;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onUpdatePrivacySettings: (
    partial: Partial<PrivacySafetySettings>,
  ) => Promise<void>;
  onSearchPlayers: (queryText: string) => Promise<DirectoryPlayer[]>;
  onBlockPlayer: (target: {
    uid: string;
    username: string;
    avatarId: string;
  }) => Promise<void>;
  onUnblockPlayer: (targetUid: string) => Promise<void>;
  onSubmitReport: (params: {
    targetUid?: string;
    targetUsername: string;
    reason: PlayerReportReason;
    details: string;
    alsoBlock?: { uid: string; username: string; avatarId: string };
  }) => Promise<void>;
}

export function PrivacySafetyPanel({
  firebaseUser,
  authBusy,
  privacySettings,
  privacyNotice,
  friends,
  blockedUsers,
  submittedReports,
  roomPlayers,
  onSignInGoogle,
  onSignOutGoogle,
  onDeleteAccount,
  onUpdatePrivacySettings,
  onSearchPlayers,
  onBlockPlayer,
  onUnblockPlayer,
  onSubmitReport,
}: PrivacySafetyPanelProps) {
  const [activeTab, setActiveTab] = useState<PrivacyTab>('privacy');
  const [savingSetting, setSavingSetting] = useState(false);

  // Report a Player state
  const [reportTargetName, setReportTargetName] = useState('');
  const [reportTargetUid, setReportTargetUid] = useState('');
  const [reportTargetAvatarId, setReportTargetAvatarId] = useState('raju');
  const [reportReason, setReportReason] =
    useState<PlayerReportReason>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(false);
  const [reportLookupResults, setReportLookupResults] = useState<
    DirectoryPlayer[]
  >([]);
  const [lookingUpReportTarget, setLookingUpReportTarget] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Block Management search state
  const [blockSearchInput, setBlockSearchInput] = useState('');
  const [blockSearchResults, setBlockSearchResults] = useState<
    DirectoryPlayer[]
  >([]);
  const [searchingToBlock, setSearchingToBlock] = useState(false);
  const [blockBusyUid, setBlockBusyUid] = useState<string | null>(null);

  // Account Deletion Confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAckChecked, setDeleteAckChecked] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const blockedIds = new Set(blockedUsers.map((b) => b.uid));

  const handleToggleSetting = async (
    partial: Partial<PrivacySafetySettings>,
  ) => {
    setSavingSetting(true);
    try {
      await onUpdatePrivacySettings(partial);
    } finally {
      setSavingSetting(false);
    }
  };

  const handleLookupReportPlayer = async () => {
    const q = reportTargetName.trim();
    if (!q || !firebaseUser) {
      setReportLookupResults([]);
      return;
    }
    setLookingUpReportTarget(true);
    try {
      const results = await onSearchPlayers(q);
      setReportLookupResults(results);
    } finally {
      setLookingUpReportTarget(false);
    }
  };

  const handleSearchToBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = blockSearchInput.trim();
    if (!q || !firebaseUser) {
      setBlockSearchResults([]);
      return;
    }
    setSearchingToBlock(true);
    try {
      const results = await onSearchPlayers(q);
      setBlockSearchResults(results);
    } finally {
      setSearchingToBlock(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = reportTargetName.trim();
    if (!trimmedName || !firebaseUser) return;
    setSubmittingReport(true);
    try {
      await onSubmitReport({
        targetUid: reportTargetUid || undefined,
        targetUsername: trimmedName,
        reason: reportReason,
        details: reportDetails,
        alsoBlock:
          alsoBlockOnReport && reportTargetUid
            ? {
                uid: reportTargetUid,
                username: trimmedName,
                avatarId: reportTargetAvatarId,
              }
            : undefined,
      });
      setReportTargetName('');
      setReportTargetUid('');
      setReportDetails('');
      setAlsoBlockOnReport(false);
      setReportLookupResults([]);
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleConfirmAccountDeletion = async () => {
    if (
      !firebaseUser ||
      !deleteAckChecked ||
      deleteConfirmText.trim().toUpperCase() !== 'DELETE'
    ) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
      setShowDeleteConfirm(false);
      setDeleteAckChecked(false);
      setDeleteConfirmText('');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        setDeleteError(
          'Google verification popup was closed. Please verify your account to confirm deletion.',
        );
      } else {
        setDeleteError(
          err instanceof Error
            ? err.message
            : 'Could not delete account right now. Please sign in again and retry.',
        );
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const canConfirmDelete =
    deleteAckChecked &&
    deleteConfirmText.trim().toUpperCase() === 'DELETE' &&
    !deleteBusy;

  return (
    <div className="mt-2 sm:mt-2.5 space-y-2.5 text-xs">
      {/* Status Feedback Banner */}
      {privacyNotice && (
        <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/55 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100">
          {privacyNotice}
        </div>
      )}

      {/* Compact 3-Tab Switcher for 9:16 Portrait */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-amber-100/15 bg-[#120b08] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          aria-pressed={activeTab === 'privacy'}
          className={`flex items-center justify-center gap-1 min-h-[34px] rounded-lg px-1.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
            activeTab === 'privacy'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Privacy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          aria-pressed={activeTab === 'safety'}
          className={`flex items-center justify-center gap-1 min-h-[34px] rounded-lg px-1.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
            activeTab === 'safety'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Safety{blockedUsers.length > 0 ? ` (${blockedUsers.length})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          aria-pressed={activeTab === 'account'}
          className={`flex items-center justify-center gap-1 min-h-[34px] rounded-lg px-1.5 py-1 text-[10.5px] font-bold transition-colors cursor-pointer ${
            activeTab === 'account'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>Account</span>
        </button>
      </div>

      {/* Sign-In Notice when Offline/Guest */}
      {!firebaseUser && (
        <div className="rounded-xl border border-amber-300/25 bg-[#150e0a]/90 p-2.5">
          <div className="flex items-start gap-2">
            <Cloud className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-amber-50">
                Sign in with Google for Cloud Privacy &amp; Reports
              </div>
              <p className="mt-0.5 text-[10px] text-amber-100/70 leading-snug">
                Privacy preferences save locally right away, and sync with Firestore rules, blocked lists, player reports, and account controls once signed in.
              </p>
              <button
                type="button"
                onClick={onSignInGoogle}
                disabled={authBusy}
                className="mt-2 inline-flex items-center gap-1.5 min-h-[32px] rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 text-[11px] font-bold text-[#1d140e] cursor-pointer disabled:opacity-60"
              >
                <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{authBusy ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: PRIVACY PREFERENCES */}
      {activeTab === 'privacy' && (
        <div className="space-y-2.5">
          {/* 1. Who Can Send Friend Requests */}
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-200">
                Who Can Send Friend Requests
              </span>
              <span className="text-[9.5px] font-semibold text-amber-100/60">
                {privacySettings.friendRequestPolicy === 'everyone'
                  ? 'Everyone'
                  : 'No One'}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-amber-100/65 leading-snug">
              Enforced on your account so unwanted requests are rejected automatically.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={privacySettings.friendRequestPolicy === 'everyone'}
                onClick={() =>
                  void handleToggleSetting({ friendRequestPolicy: 'everyone' })
                }
                className={`min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.friendRequestPolicy === 'everyone'
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                Everyone
              </button>
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={privacySettings.friendRequestPolicy === 'nobody'}
                onClick={() =>
                  void handleToggleSetting({ friendRequestPolicy: 'nobody' })
                }
                className={`min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.friendRequestPolicy === 'nobody'
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                No One
              </button>
            </div>
          </div>

          {/* 2. Online Status Visibility (Appear Online vs Offline) */}
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-200">
                Online Status Visibility
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                  privacySettings.appearOffline
                    ? 'text-stone-300'
                    : 'text-emerald-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    privacySettings.appearOffline
                      ? 'bg-stone-500'
                      : 'bg-emerald-400'
                  }`}
                />
                {privacySettings.appearOffline ? 'Appearing Offline' : 'Online'}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-amber-100/65 leading-snug">
              Choose whether friends see you as online while you play.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={!privacySettings.appearOffline}
                onClick={() =>
                  void handleToggleSetting({ appearOffline: false })
                }
                className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  !privacySettings.appearOffline
                    ? 'bg-emerald-600 text-white border-emerald-300'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Appear Online</span>
              </button>
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={privacySettings.appearOffline}
                onClick={() => void handleToggleSetting({ appearOffline: true })}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.appearOffline
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Appear Offline</span>
              </button>
            </div>
          </div>

          {/* 3. Who Can Invite to Multiplayer Rooms */}
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-200">
                Who Can Invite to Multiplayer Rooms
              </span>
              <span className="text-[9.5px] font-semibold text-amber-100/60">
                {privacySettings.roomInvitePolicy === 'friends'
                  ? 'Friends Only'
                  : 'No One'}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-amber-100/65 leading-snug">
              Strangers can never send room invites. Turn off invites anytime when playing solo.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={privacySettings.roomInvitePolicy === 'friends'}
                onClick={() =>
                  void handleToggleSetting({ roomInvitePolicy: 'friends' })
                }
                className={`min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.roomInvitePolicy === 'friends'
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                Friends Only
              </button>
              <button
                type="button"
                disabled={savingSetting}
                aria-pressed={privacySettings.roomInvitePolicy === 'nobody'}
                onClick={() =>
                  void handleToggleSetting({ roomInvitePolicy: 'nobody' })
                }
                className={`min-h-[34px] rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.roomInvitePolicy === 'nobody'
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/80 border-amber-100/15 hover:border-amber-200/40'
                }`}
              >
                No One
              </button>
            </div>
          </div>

          {/* 4. Hide Player Profile Details from Strangers */}
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-amber-200">
                  Hide Profile Details from Strangers
                </div>
                <p className="mt-0.5 text-[10px] text-amber-100/65 leading-snug">
                  Hides your avatar portrait and live online status from non-friends in player search. Your stats remain private to you.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                disabled={savingSetting}
                aria-checked={privacySettings.hideProfileFromStrangers}
                aria-label="Hide profile details from strangers"
                onClick={() =>
                  void handleToggleSetting({
                    hideProfileFromStrangers:
                      !privacySettings.hideProfileFromStrangers,
                  })
                }
                className={`min-w-[54px] min-h-[32px] shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                  privacySettings.hideProfileFromStrangers
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#100a07] text-amber-100/75 border-amber-100/20'
                }`}
              >
                {privacySettings.hideProfileFromStrangers ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SAFETY (REPORT PLAYER + BLOCKED USERS MANAGEMENT) */}
      {activeTab === 'safety' && (
        <div className="space-y-2.5">
          {/* Section A: Report a Player */}
          <form
            onSubmit={(e) => void handleReportSubmit(e)}
            className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-200">
                <Flag className="w-3.5 h-3.5 text-rose-300 shrink-0" aria-hidden="true" />
                <span>Report a Player</span>
              </span>
              {submittedReports.length > 0 && (
                <span className="text-[9.5px] font-mono text-amber-100/60">
                  {submittedReports.length} sent
                </span>
              )}
            </div>

            {!firebaseUser ? (
              <p className="text-[10.5px] text-amber-100/65">
                Sign in with Google above to submit safety reports and manage your block list.
              </p>
            ) : (
              <>
                {/* Quick select from Friends or Current Room Players */}
                {(friends.length > 0 || roomPlayers.length > 0) && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {roomPlayers.map((rp) => (
                      <button
                        key={`room-${rp.id}`}
                        type="button"
                        onClick={() => {
                          setReportTargetName(rp.name);
                          setReportTargetUid('');
                        }}
                        className="shrink-0 rounded-md border border-amber-100/15 bg-[#1f140d] hover:border-rose-300/45 px-2 py-0.5 text-[10px] font-semibold text-amber-100 cursor-pointer"
                      >
                        Room: {rp.name}
                      </button>
                    ))}
                    {friends.slice(0, 6).map((f) => (
                      <button
                        key={`fr-${f.uid}`}
                        type="button"
                        onClick={() => {
                          setReportTargetName(f.username);
                          setReportTargetUid(f.uid);
                          setReportTargetAvatarId(f.avatarId);
                          setReportLookupResults([]);
                        }}
                        className="shrink-0 rounded-md border border-amber-100/15 bg-[#1f140d] hover:border-rose-300/45 px-2 py-0.5 text-[10px] font-semibold text-amber-100 cursor-pointer"
                      >
                        {f.username}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Username of player to report"
                    value={reportTargetName}
                    onChange={(e) => {
                      setReportTargetName(
                        e.target.value.slice(0, PROFILE_USERNAME_MAX_LENGTH),
                      );
                      setReportTargetUid('');
                    }}
                    placeholder="Player username..."
                    maxLength={PROFILE_USERNAME_MAX_LENGTH}
                    className="flex-1 min-w-0 min-h-[34px] rounded-lg border border-amber-100/20 bg-[#0f0906] px-2.5 py-1 text-xs text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                  />
                  <button
                    type="button"
                    disabled={lookingUpReportTarget || !reportTargetName.trim()}
                    onClick={() => void handleLookupReportPlayer()}
                    title="Find matching player"
                    className="inline-flex items-center gap-1 min-h-[34px] rounded-lg border border-amber-100/20 bg-[#231710] hover:bg-[#312016] px-2.5 py-1 text-[10.5px] font-semibold text-amber-100 cursor-pointer disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" aria-hidden="true" />
                    <span>{lookingUpReportTarget ? '...' : 'Match'}</span>
                  </button>
                </div>

                {reportLookupResults.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-amber-100/12 bg-[#0f0906] p-1.5">
                    {reportLookupResults.slice(0, 4).map((p) => (
                      <button
                        key={p.uid}
                        type="button"
                        onClick={() => {
                          setReportTargetName(p.username);
                          setReportTargetUid(p.uid);
                          setReportTargetAvatarId(p.avatarId);
                          setReportLookupResults([]);
                        }}
                        className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] hover:bg-[#22160f] text-amber-50 cursor-pointer"
                      >
                        <span className="truncate font-semibold">{p.username}</span>
                        <span className="text-[9.5px] text-amber-300 shrink-0">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1">
                  {PLAYER_REPORT_REASONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReportReason(opt.id)}
                      aria-pressed={reportReason === opt.id}
                      className={`min-h-[30px] rounded-lg border px-2 py-1 text-left text-[10px] font-semibold leading-tight transition-colors cursor-pointer ${
                        reportReason === opt.id
                          ? 'bg-rose-900/55 border-rose-300 text-rose-50'
                          : 'bg-[#0f0906] border-amber-100/12 text-amber-100/75 hover:border-amber-200/35'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  aria-label="Optional report details"
                  value={reportDetails}
                  onChange={(e) =>
                    setReportDetails(
                      e.target.value.slice(0, MAX_PLAYER_REPORT_DETAILS_LENGTH),
                    )
                  }
                  placeholder="Optional details (what happened)..."
                  maxLength={MAX_PLAYER_REPORT_DETAILS_LENGTH}
                  className="w-full min-h-[34px] rounded-lg border border-amber-100/20 bg-[#0f0906] px-2.5 py-1 text-[11px] text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                />

                {reportTargetUid && !blockedIds.has(reportTargetUid) && (
                  <label className="flex items-center gap-2 text-[10.5px] text-amber-100/85 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoBlockOnReport}
                      onChange={(e) => setAlsoBlockOnReport(e.target.checked)}
                      className="accent-rose-500"
                    />
                    <span>Also block {reportTargetName}</span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={submittingReport || !reportTargetName.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {submittingReport ? 'Submitting...' : 'Submit Safety Report'}
                  </span>
                </button>
              </>
            )}
          </form>

          {/* Section B: Review & Manage Blocked Users */}
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                <Ban className="w-3.5 h-3.5 text-rose-300 shrink-0" aria-hidden="true" />
                <span>Blocked Users</span>
              </span>
              <span className="text-[10px] font-mono tabular-nums text-amber-100/65">
                {blockedUsers.length} blocked
              </span>
            </div>

            {firebaseUser && (
              <form
                onSubmit={(e) => void handleSearchToBlock(e)}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  aria-label="Search username to block"
                  value={blockSearchInput}
                  onChange={(e) =>
                    setBlockSearchInput(
                      e.target.value.slice(0, PROFILE_USERNAME_MAX_LENGTH),
                    )
                  }
                  placeholder="Find username to block..."
                  maxLength={PROFILE_USERNAME_MAX_LENGTH}
                  className="flex-1 min-w-0 min-h-[32px] rounded-lg border border-amber-100/20 bg-[#0f0906] px-2.5 py-1 text-[11px] text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                />
                <button
                  type="submit"
                  disabled={searchingToBlock || !blockSearchInput.trim()}
                  className="inline-flex items-center gap-1 min-h-[32px] rounded-lg border border-amber-100/20 bg-[#231710] hover:bg-[#312016] px-2.5 py-1 text-[10.5px] font-semibold text-amber-100 cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-3 h-3" aria-hidden="true" />
                  <span>{searchingToBlock ? '...' : 'Find'}</span>
                </button>
              </form>
            )}

            {blockSearchResults.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-100/12 bg-[#0f0906] p-1.5">
                {blockSearchResults.map((p) => {
                  const alreadyBlocked = blockedIds.has(p.uid);
                  return (
                    <div
                      key={p.uid}
                      className="flex items-center justify-between gap-2 rounded px-1.5 py-1"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ProfileAvatar
                          avatarId={
                            p.hideProfileFromStrangers ? 'private' : p.avatarId
                          }
                          sizeClass="w-6 h-6"
                        />
                        <span className="text-[11px] font-semibold text-amber-50 truncate">
                          {p.username}
                        </span>
                      </div>
                      {alreadyBlocked ? (
                        <span className="text-[10px] font-semibold text-rose-300">
                          Blocked
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={blockBusyUid === p.uid}
                          onClick={async () => {
                            setBlockBusyUid(p.uid);
                            try {
                              await onBlockPlayer(p);
                            } finally {
                              setBlockBusyUid(null);
                            }
                          }}
                          className="rounded bg-rose-700 hover:bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                        >
                          Block
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {blockedUsers.length === 0 ? (
              <p className="py-2 text-center text-[10.5px] text-amber-100/55">
                You have not blocked any players.
              </p>
            ) : (
              <div className="space-y-1.5">
                {blockedUsers.map((b) => (
                  <div
                    key={b.uid}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-100/12 bg-[#0f0906] px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProfileAvatar avatarId={b.avatarId} sizeClass="w-7 h-7" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-amber-50 truncate">
                          {b.username}
                        </div>
                        <div className="text-[9.5px] text-rose-300/75">
                          Blocked · Cannot send requests or invites
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={blockBusyUid === b.uid}
                      onClick={async () => {
                        setBlockBusyUid(b.uid);
                        try {
                          await onUnblockPlayer(b.uid);
                        } finally {
                          setBlockBusyUid(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 min-h-[28px] shrink-0 rounded-lg border border-amber-100/20 bg-[#1e140e] hover:bg-[#2c1d14] px-2 py-0.5 text-[10.5px] font-semibold text-amber-100 cursor-pointer"
                    >
                      <ShieldOff className="w-3 h-3" aria-hidden="true" />
                      <span>Unblock</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACCOUNT LOGOUT & VERIFIED ACCOUNT DELETION */}
      {activeTab === 'account' && (
        <div className="space-y-2.5">
          {!firebaseUser ? (
            <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-3 text-center">
              <Shield className="w-6 h-6 text-amber-300 mx-auto" aria-hidden="true" />
              <div className="mt-1.5 text-xs font-bold text-amber-50">
                Playing as Guest (Local Save)
              </div>
              <p className="mt-1 text-[10.5px] text-amber-100/70 leading-relaxed">
                Sign in with a verified Google account to manage cloud logout or permanent account deletion.
              </p>
              <button
                type="button"
                onClick={onSignInGoogle}
                disabled={authBusy}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-2 min-h-[38px] rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-[#1d140e] cursor-pointer disabled:opacity-60"
              >
                <Cloud className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{authBusy ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Account Summary + Logout */}
              <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-amber-50 truncate">
                      {firebaseUser.displayName || 'Player Account'}
                    </div>
                    <div className="text-[10px] text-amber-100/65 truncate">
                      {firebaseUser.email || 'Google Account'}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-950/50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-200 shrink-0">
                    <Check className="w-2.5 h-2.5" aria-hidden="true" />
                    Verified
                  </span>
                </div>

                <button
                  type="button"
                  disabled={authBusy || deleteBusy}
                  onClick={() => void onSignOutGoogle()}
                  className="w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-xl border border-amber-100/20 bg-[#231710] hover:bg-[#312016] px-3 py-1.5 text-xs font-bold text-amber-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Log Out of Account</span>
                </button>
              </div>

              {/* Danger Zone: Account Deletion with Explicit Multi-Step Confirmation */}
              <div className="rounded-xl border border-rose-400/35 bg-rose-950/25 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <UserX className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
                  <span className="text-[11px] font-bold text-rose-200">
                    Delete Account
                  </span>
                </div>
                <p className="text-[10px] text-rose-100/80 leading-snug">
                  Permanently removes your online account, cloud profile, match statistics, friends list, blocked list, pending requests, and privacy settings.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeleteAckChecked(false);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl border border-rose-400/45 bg-rose-950/60 hover:bg-rose-900/75 px-3 py-1.5 text-[11px] font-bold text-rose-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Delete Account...</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-rose-400/45 bg-[#160b0b]/95 p-2.5 space-y-2">
                    <div className="flex items-start gap-1.5 text-[10.5px] font-semibold text-rose-200">
                      <AlertTriangle
                        className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>
                        Confirm permanent account deletion. You may be asked to verify your Google sign-in.
                      </span>
                    </div>

                    <label className="flex items-start gap-2 text-[10.5px] text-rose-100/90 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deleteAckChecked}
                        onChange={(e) => setDeleteAckChecked(e.target.checked)}
                        className="mt-0.5 accent-rose-500"
                      />
                      <span>
                        I understand this permanently deletes my account and all cloud progress.
                      </span>
                    </label>

                    <div>
                      <label
                        htmlFor="delete-account-confirm-input"
                        className="block text-[10px] font-semibold text-rose-200/90 mb-1"
                      >
                        Type <span className="font-mono font-bold">DELETE</span> to confirm
                      </label>
                      <input
                        id="delete-account-confirm-input"
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value.slice(0, 12))}
                        placeholder="DELETE"
                        autoComplete="off"
                        className="w-full min-h-[34px] rounded-lg border border-rose-400/40 bg-[#0d0606] px-2.5 py-1 font-mono text-xs font-bold uppercase text-rose-50 placeholder:text-rose-200/30 focus:border-rose-300 focus:outline-none select-text"
                      />
                    </div>

                    {deleteError && (
                      <div className="rounded border border-rose-400/45 bg-rose-950/80 px-2 py-1 text-[10px] text-rose-100">
                        {deleteError}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteAckChecked(false);
                          setDeleteConfirmText('');
                          setDeleteError(null);
                        }}
                        className="flex-1 min-h-[34px] rounded-lg border border-amber-100/20 bg-[#231710] hover:bg-[#312016] px-2.5 py-1 text-[11px] font-semibold text-amber-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!canConfirmDelete}
                        onClick={() => void handleConfirmAccountDeletion()}
                        className="flex-1 min-h-[34px] rounded-lg bg-rose-700 hover:bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        {deleteBusy ? 'Deleting...' : 'Delete Forever'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
