import { User as FirebaseUser } from 'firebase/auth';
import {
  Ban,
  Check,
  Cloud,
  Mail,
  Search,
  Send,
  ShieldOff,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BlockedRecord,
  DirectoryPlayer,
  FriendRecord,
  FriendRequestRecord,
  RoomInviteRecord,
} from '../game/friendsService';
import { getLevelConfig } from '../game/levels';
import { ProfileAvatar } from './ProfileAvatar';

export type FriendsTab = 'friends' | 'requests' | 'search' | 'blocked';

interface FriendsPanelProps {
  firebaseUser: FirebaseUser | null;
  authBusy: boolean;
  friends: FriendRecord[];
  blockedUsers: BlockedRecord[];
  incomingRequests: FriendRequestRecord[];
  outgoingRequests: FriendRequestRecord[];
  incomingInvites: RoomInviteRecord[];
  activeRoomCode: string | null;
  friendsNotice: string | null;
  onSignInGoogle: () => void;
  onSearchPlayers: (queryText: string) => Promise<DirectoryPlayer[]>;
  onSendRequest: (target: DirectoryPlayer) => Promise<void>;
  onCancelRequest: (targetUid: string) => Promise<void>;
  onAcceptRequest: (req: FriendRequestRecord) => Promise<void>;
  onDeclineRequest: (req: FriendRequestRecord) => Promise<void>;
  onRemoveFriend: (friendUid: string) => Promise<void>;
  onBlockPlayer: (target: {
    uid: string;
    username: string;
    avatarId: string;
  }) => Promise<void>;
  onUnblockPlayer: (targetUid: string) => Promise<void>;
  onInviteFriend: (friend: FriendRecord) => Promise<void>;
  onAcceptRoomInvite: (invite: RoomInviteRecord) => void;
  onDismissRoomInvite: (invite: RoomInviteRecord) => void;
}

export function FriendsPanel({
  firebaseUser,
  authBusy,
  friends,
  blockedUsers,
  incomingRequests,
  outgoingRequests,
  incomingInvites,
  activeRoomCode,
  friendsNotice,
  onSignInGoogle,
  onSearchPlayers,
  onSendRequest,
  onCancelRequest,
  onAcceptRequest,
  onDeclineRequest,
  onRemoveFriend,
  onBlockPlayer,
  onUnblockPlayer,
  onInviteFriend,
  onAcceptRoomInvite,
  onDismissRoomInvite,
}: FriendsPanelProps) {
  const [activeTab, setActiveTab] = useState<FriendsTab>(
    incomingRequests.length > 0 ? 'requests' : 'friends',
  );
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<DirectoryPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Record<string, boolean>>({});
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmBlockUid, setConfirmBlockUid] = useState<string | null>(null);

  useEffect(() => {
    setInvitedIds({});
  }, [activeRoomCode]);

  const runSearch = async (queryStr: string) => {
    const trimmed = queryStr.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    try {
      const list = await onSearchPlayers(trimmed);
      setSearchResults(list);
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="mt-3 space-y-3 text-xs">
        <div className="rounded-xl border border-amber-200/20 bg-[#150e0a]/90 p-4 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/15">
            <Users className="w-5 h-5 text-amber-300" aria-hidden="true" />
          </div>
          <h3 className="font-display mt-2.5 text-sm font-bold text-amber-50">
            Play with Village Friends
          </h3>
          <p className="mt-1.5 text-[11px] text-amber-100/75 leading-relaxed">
            Sign in with Google to search players by username, add friends, see who is online, and invite them directly into your multiplayer rooms.
          </p>
          <button
            type="button"
            onClick={onSignInGoogle}
            disabled={authBusy}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-4 py-2 text-xs font-bold text-[#1d140e] transition-colors cursor-pointer disabled:opacity-60"
          >
            <Cloud className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {authBusy ? 'Connecting...' : 'Sign in with Google'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  const onlineCount = friends.filter((f) => f.isOnline).length;
  const friendIds = new Set(friends.map((f) => f.uid));
  const blockedIds = new Set(blockedUsers.map((b) => b.uid));
  const incomingByFrom = new Map(incomingRequests.map((r) => [r.fromUid, r]));
  const outgoingToIds = new Set(outgoingRequests.map((r) => r.toUid));

  return (
    <div className="mt-2 sm:mt-2.5 space-y-2.5 text-xs">
      {/* Notice Banner */}
      {friendsNotice && (
        <div className="rounded-lg border border-amber-300/35 bg-amber-950/65 px-2.5 py-1.5 text-[11px] font-medium text-amber-100">
          {friendsNotice}
        </div>
      )}

      {/* Pending Multiplayer Room Invites */}
      {incomingInvites.length > 0 && (
        <div className="space-y-1.5">
          {incomingInvites.map((invite) => {
            const lvl = getLevelConfig(invite.levelId);
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/45 px-2.5 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ProfileAvatar
                    avatarId={invite.fromAvatarId}
                    sizeClass="w-8 h-8"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-emerald-100 truncate">
                      {invite.fromUsername} invited you!
                    </div>
                    <div className="text-[10px] text-emerald-200/80 truncate">
                      Room {invite.roomCode} · L{lvl.id} {lvl.shortName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAcceptRoomInvite(invite)}
                    className="min-h-[30px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10.5px] font-bold text-white cursor-pointer"
                  >
                    Join
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissRoomInvite(invite)}
                    aria-label="Dismiss room invite"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-emerald-200/20 text-emerald-100/75 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compact 4-Tab Bar */}
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-amber-100/15 bg-[#120b08] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          aria-pressed={activeTab === 'friends'}
          className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg px-1 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
            activeTab === 'friends'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <span>Friends</span>
          <span className="text-[9px] font-mono tabular-nums opacity-85">
            {onlineCount}/{friends.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          aria-pressed={activeTab === 'requests'}
          className={`relative flex flex-col items-center justify-center min-h-[36px] rounded-lg px-1 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <span>Requests</span>
          <span className="text-[9px] font-mono tabular-nums opacity-85">
            {incomingRequests.length} new
          </span>
          {incomingRequests.length > 0 && activeTab !== 'requests' && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          aria-pressed={activeTab === 'search'}
          className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg px-1 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
            activeTab === 'search'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <span>Find</span>
          <span className="text-[9px] opacity-85">Search</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blocked')}
          aria-pressed={activeTab === 'blocked'}
          className={`flex flex-col items-center justify-center min-h-[36px] rounded-lg px-1 py-1 text-[10px] font-bold transition-colors cursor-pointer ${
            activeTab === 'blocked'
              ? 'bg-amber-500 text-[#1d140e]'
              : 'text-amber-100/75 hover:bg-[#231710]'
          }`}
        >
          <span>Blocked</span>
          <span className="text-[9px] font-mono tabular-nums opacity-85">
            {blockedUsers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Friends List */}
      {activeTab === 'friends' && (
        <div className="space-y-1.5">
          {friends.length === 0 ? (
            <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-4 text-center">
              <p className="text-[11px] font-semibold text-amber-100/85">
                No friends added yet.
              </p>
              <p className="mt-1 text-[10px] text-amber-100/60">
                Search for friends by username to add them and invite them to rooms.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="mt-2.5 inline-flex items-center gap-1.5 min-h-[34px] rounded-lg bg-[#d96b27] hover:bg-[#e57731] px-3 py-1 text-[11px] font-bold text-white cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Find Friends</span>
              </button>
            </div>
          ) : (
            friends.map((friend) => {
              const isBusy = busyId === friend.uid;
              const isInvited = Boolean(invitedIds[friend.uid]);
              const removing = confirmRemoveUid === friend.uid;
              const blocking = confirmBlockUid === friend.uid;

              return (
                <div
                  key={friend.uid}
                  className="rounded-xl border border-amber-100/15 bg-[#150e0a]/88 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <ProfileAvatar
                          avatarId={friend.avatarId}
                          sizeClass="w-9 h-9"
                        />
                        <span
                          title={friend.isOnline ? 'Online' : 'Offline'}
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#150e0a] ${
                            friend.isOnline ? 'bg-emerald-400' : 'bg-stone-500'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-50 truncate">
                          {friend.username}
                        </div>
                        <div
                          className={`text-[10px] font-semibold ${
                            friend.isOnline
                              ? 'text-emerald-300'
                              : 'text-amber-100/50'
                          }`}
                        >
                          {friend.isOnline ? 'Online now' : 'Offline'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy || friend.roomInvitePolicy === 'nobody'}
                        onClick={async () => {
                          setBusyId(friend.uid);
                          try {
                            await onInviteFriend(friend);
                            setInvitedIds((prev) => ({
                              ...prev,
                              [friend.uid]: true,
                            }));
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        title={
                          friend.roomInvitePolicy === 'nobody'
                            ? `${friend.username} has disabled room invites`
                            : activeRoomCode
                              ? `Invite ${friend.username} to Room ${activeRoomCode}`
                              : `Create room & invite ${friend.username}`
                        }
                        className={`inline-flex items-center gap-1 min-h-[30px] rounded-lg px-2 py-1 text-[10.5px] font-bold transition-colors disabled:opacity-55 ${
                          friend.roomInvitePolicy === 'nobody'
                            ? 'bg-[#1a120d] border border-amber-100/15 text-amber-100/50 cursor-not-allowed'
                            : isInvited
                              ? 'bg-emerald-700/80 text-emerald-100 cursor-pointer'
                              : 'bg-[#d96b27] hover:bg-[#e57731] text-white cursor-pointer'
                        }`}
                      >
                        {friend.roomInvitePolicy === 'nobody' ? (
                          <span>Invites Off</span>
                        ) : isInvited ? (
                          <>
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" aria-hidden="true" />
                            <span>Invite</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        aria-label={`Remove ${friend.username}`}
                        title="Remove friend"
                        onClick={() => {
                          setConfirmBlockUid(null);
                          setConfirmRemoveUid(removing ? null : friend.uid);
                        }}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors cursor-pointer ${
                          removing
                            ? 'bg-amber-500/25 border-amber-300 text-amber-200'
                            : 'bg-[#100a07] border-amber-100/15 text-amber-100/65 hover:text-amber-200'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        aria-label={`Block ${friend.username}`}
                        title="Block user"
                        onClick={() => {
                          setConfirmRemoveUid(null);
                          setConfirmBlockUid(blocking ? null : friend.uid);
                        }}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors cursor-pointer ${
                          blocking
                            ? 'bg-rose-900/60 border-rose-400 text-rose-200'
                            : 'bg-[#100a07] border-amber-100/15 text-amber-100/65 hover:text-rose-300'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {removing && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/25 bg-[#0f0906] px-2.5 py-1.5 text-[10.5px]">
                      <span className="text-amber-100/85">
                        Remove {friend.username}?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveUid(null)}
                          className="rounded px-2 py-0.5 text-amber-100/70 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(friend.uid);
                            try {
                              await onRemoveFriend(friend.uid);
                              setConfirmRemoveUid(null);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="rounded bg-amber-600 hover:bg-amber-500 px-2 py-0.5 font-bold text-white cursor-pointer"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  )}

                  {blocking && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-rose-400/35 bg-rose-950/40 px-2.5 py-1.5 text-[10.5px]">
                      <span className="text-rose-100">
                        Block &amp; remove {friend.username}?
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmBlockUid(null)}
                          className="rounded px-2 py-0.5 text-amber-100/70 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(friend.uid);
                            try {
                              await onBlockPlayer(friend);
                              setConfirmBlockUid(null);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="rounded bg-rose-700 hover:bg-rose-600 px-2 py-0.5 font-bold text-white cursor-pointer"
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Incoming & Outgoing Friend Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-2.5">
          <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/88 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-amber-200">
                Incoming Friend Requests
              </span>
              <span className="text-[10px] font-mono tabular-nums text-amber-100/60">
                {incomingRequests.length}
              </span>
            </div>

            {incomingRequests.length === 0 ? (
              <p className="py-2 text-center text-[10.5px] text-amber-100/55">
                No pending friend requests.
              </p>
            ) : (
              <div className="space-y-1.5">
                {incomingRequests.map((req) => {
                  const isBusy = busyId === req.id;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-amber-100/12 bg-[#0f0906] px-2.5 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfileAvatar
                          avatarId={req.fromAvatarId}
                          sizeClass="w-8 h-8"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-50 truncate">
                            {req.fromUsername}
                          </div>
                          <div className="text-[9.5px] text-amber-100/60">
                            Wants to be friends
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(req.id);
                            try {
                              await onAcceptRequest(req);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 min-h-[28px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[10.5px] font-bold text-white cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(req.id);
                            try {
                              await onDeclineRequest(req);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          aria-label={`Decline ${req.fromUsername}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-amber-100/15 bg-[#1b120c] text-amber-100/75 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(req.id);
                            try {
                              await onBlockPlayer({
                                uid: req.fromUid,
                                username: req.fromUsername,
                                avatarId: req.fromAvatarId,
                              });
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          aria-label={`Block ${req.fromUsername}`}
                          title="Block player"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-amber-100/15 bg-[#1b120c] text-amber-100/70 hover:text-rose-300 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {outgoingRequests.length > 0 && (
            <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/88 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-amber-200/85">
                  Sent Requests
                </span>
                <span className="text-[10px] font-mono tabular-nums text-amber-100/60">
                  {outgoingRequests.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-100/10 bg-[#0f0906] px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProfileAvatar
                        avatarId={req.toAvatarId}
                        sizeClass="w-7 h-7"
                      />
                      <span className="text-[11px] font-semibold text-amber-50 truncate">
                        {req.toUsername}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={async () => {
                        setBusyId(req.id);
                        try {
                          await onCancelRequest(req.toUid);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="min-h-[26px] rounded-lg border border-amber-100/15 bg-[#1b120c] hover:bg-[#2a1c14] px-2 py-0.5 text-[10px] font-semibold text-amber-100/80 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Search Players by Username */}
      {activeTab === 'search' && (
        <div className="space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(searchInput);
            }}
            className="rounded-xl border border-amber-100/15 bg-[#150e0a]/90 p-2.5"
          >
            <label
              htmlFor="friend-search-input"
              className="block text-[11px] font-bold text-amber-200 mb-1.5"
            >
              Search by Username
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="friend-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value.slice(0, 20))}
                placeholder="Type player username..."
                maxLength={20}
                className="flex-1 min-w-0 min-h-[36px] rounded-lg border border-amber-100/20 bg-[#0f0906] px-2.5 py-1 text-xs text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
              />
              <button
                type="submit"
                disabled={searching || !searchInput.trim()}
                className="inline-flex items-center justify-center gap-1 min-h-[36px] rounded-lg bg-[#d96b27] hover:bg-[#e57731] px-3 py-1 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{searching ? '...' : 'Find'}</span>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-amber-100/60">
              Players appear in search once they sign in with Google and save their username.
            </p>
          </form>

          {searchDone && (
            <div className="space-y-1.5">
              {searchResults.length === 0 ? (
                <div className="rounded-xl border border-amber-100/12 bg-[#150e0a]/80 p-3 text-center text-[11px] text-amber-100/65">
                  No players matched &ldquo;{searchInput.trim()}&rdquo;.
                </div>
              ) : (
                searchResults.map((player) => {
                  const isFriend = friendIds.has(player.uid);
                  const isBlocked = blockedIds.has(player.uid);
                  const incomingReq = incomingByFrom.get(player.uid);
                  const isOutgoing = outgoingToIds.has(player.uid);
                  const isBusy = busyId === player.uid;

                  return (
                    <div
                      key={player.uid}
                      className="flex items-center justify-between gap-2 rounded-xl border border-amber-100/15 bg-[#150e0a]/88 px-2.5 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <ProfileAvatar
                            avatarId={
                              !isFriend && player.hideProfileFromStrangers
                                ? 'private'
                                : player.avatarId
                            }
                            sizeClass="w-8 h-8"
                          />
                          {(isFriend || !player.hideProfileFromStrangers) && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#150e0a] ${
                                player.isOnline ? 'bg-emerald-400' : 'bg-stone-500'
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-50 truncate">
                            {player.username}
                          </div>
                          <div className="text-[9.5px] text-amber-100/60">
                            {!isFriend && player.hideProfileFromStrangers
                              ? 'Private profile'
                              : player.isOnline
                                ? 'Online'
                                : 'Offline'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isFriend ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/35 bg-emerald-950/50 px-2 py-1 text-[10px] font-bold text-emerald-200">
                            <UserCheck className="w-3 h-3" aria-hidden="true" />
                            <span>Friends</span>
                          </span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-950/45 px-2 py-1 text-[10px] font-bold text-rose-200">
                            <Ban className="w-3 h-3" aria-hidden="true" />
                            <span>Blocked</span>
                          </span>
                        ) : incomingReq ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(player.uid);
                              try {
                                await onAcceptRequest(incomingReq);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 min-h-[30px] rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10.5px] font-bold text-white cursor-pointer"
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span>Accept</span>
                          </button>
                        ) : isOutgoing ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(player.uid);
                              try {
                                await onCancelRequest(player.uid);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 min-h-[30px] rounded-lg border border-amber-200/25 bg-[#1b120c] px-2.5 py-1 text-[10.5px] font-semibold text-amber-200 cursor-pointer"
                          >
                            <Mail className="w-3 h-3" aria-hidden="true" />
                            <span>Requested</span>
                          </button>
                        ) : player.friendRequestPolicy === 'nobody' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-100/15 bg-[#1a120d] px-2 py-1 text-[10px] font-semibold text-amber-100/55">
                            Requests Off
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(player.uid);
                              try {
                                await onSendRequest(player);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 min-h-[30px] rounded-lg bg-[#d96b27] hover:bg-[#e57731] px-2.5 py-1 text-[10.5px] font-bold text-white cursor-pointer disabled:opacity-50"
                          >
                            <UserPlus className="w-3 h-3" aria-hidden="true" />
                            <span>Add Friend</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Blocked Players */}
      {activeTab === 'blocked' && (
        <div className="space-y-1.5">
          {blockedUsers.length === 0 ? (
            <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-4 text-center text-[11px] text-amber-100/65">
              No blocked players.
            </div>
          ) : (
            blockedUsers.map((b) => (
              <div
                key={b.uid}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-100/15 bg-[#150e0a]/88 px-2.5 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ProfileAvatar avatarId={b.avatarId} sizeClass="w-8 h-8" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-amber-50 truncate">
                      {b.username}
                    </div>
                    <div className="text-[9.5px] text-rose-300/80">Blocked</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === b.uid}
                  onClick={async () => {
                    setBusyId(b.uid);
                    try {
                      await onUnblockPlayer(b.uid);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1 min-h-[30px] rounded-lg border border-amber-100/20 bg-[#1e140e] hover:bg-[#2c1d14] px-2.5 py-1 text-[10.5px] font-semibold text-amber-100 cursor-pointer"
                >
                  <ShieldOff className="w-3 h-3" aria-hidden="true" />
                  <span>Unblock</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
