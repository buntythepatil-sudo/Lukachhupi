import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Crown,
  EyeOff,
  Flag,
  Hand,
  Link2,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Music,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CircularMinimap } from './components/CircularMinimap';
import { TouchJoystick } from './components/TouchJoystick';
import { createDefaultAudioSettings } from './game/audioEngine';
import {
  CAMERA_MAX_SENSITIVITY,
  CAMERA_MAX_ZOOM,
  CAMERA_MAX_ZOOM_SPEED,
  CAMERA_MIN_SENSITIVITY,
  CAMERA_MIN_ZOOM,
  CAMERA_MIN_ZOOM_SPEED,
  createDefaultCameraSettings,
} from './game/cameraController';
import {
  ACCESSORY_OPTIONS,
  createCustomizationFromPreset,
  getPresetById,
  OUTFIT_COLOR_SWATCHES,
  OUTFIT_STYLE_OPTIONS,
  VILLAGE_CHARACTER_PRESETS,
} from './game/characterPresets';
import {
  EMOTE_DEFINITIONS,
  EmoteType,
  filterChatMessage,
  getEmoteDefinition,
  MAX_CHAT_LENGTH,
  MAX_REPORT_DETAILS_LENGTH,
  QUICK_CHAT_MESSAGES,
  REPORT_REASON_OPTIONS,
  ReportReason,
} from './game/chatFilter';
import { ChhupanChhupaiEngine } from './game/engine';
import {
  getLevelConfig,
  LEVEL_CONFIGS,
  loadUnlockedLevel,
  TOTAL_LEVELS,
} from './game/levels';
import {
  MultiplayerClient,
  MultiplayerConnectionStatus,
} from './game/multiplayerClient';
import {
  ChatMessagePayload,
  MAX_ROOM_PLAYERS,
  MIN_ONLINE_PLAYERS_TO_START,
  MultiplayerRoomSnapshot,
  PlayerEmotePayload,
  PlayerLiveStatus,
} from './game/multiplayerTypes';
import {
  AccessoryType,
  AudioSettings,
  CameraSettings,
  CharacterCustomization,
  CharacterPreset,
  GraphicsQuality,
  HudSnapshot,
  MinimapFrame,
  OutfitStyle,
  TeamRole,
} from './game/types';

const GRAPHICS_QUALITY_OPTIONS: Array<{
  id: GraphicsQuality;
  label: string;
  shortLabel: string;
}> = [
  { id: 'low', label: 'Low', shortLabel: 'Low' },
  { id: 'medium', label: 'Medium', shortLabel: 'Med' },
  { id: 'high', label: 'High', shortLabel: 'High' },
];

const INITIAL_CUSTOMIZATION: CharacterCustomization =
  createCustomizationFromPreset(VILLAGE_CHARACTER_PRESETS[0]);

const INITIAL_HUD: HudSnapshot = {
  phase: 'start',
  playerRole: 'hider',
  playerName: INITIAL_CUSTOMIZATION.name,
  winner: null,
  timeRemaining: 180,
  countdownSeconds: 12,
  isHiding: false,
  playerCaught: false,
  spectatingName: null,
  spectatingRole: null,
  spectatingCanCycle: false,
  canTag: false,
  tagTargetName: null,
  nearestDistance: 12,
  seekerMode: 'counting',
  hidingSpotLabel: null,
  remainingHiders: 4,
  totalHiders: 4,
  caughtCount: 0,
  participants: [],
  eventBanner: null,
  cameraSettings: createDefaultCameraSettings(),
  audioSettings: createDefaultAudioSettings(),
  graphicsQuality: 'medium',
  currentLevelId: 1,
  unlockedLevel: loadUnlockedLevel(),
  newlyUnlockedLevel: null,
  levelName: LEVEL_CONFIGS[0].name,
  difficultyLabel: LEVEL_CONFIGS[0].difficultyLabel,
  webglError: null,
};

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatLiveStatus(status: PlayerLiveStatus): {
  label: string;
  toneClass: string;
} {
  switch (status) {
    case 'counting':
      return { label: 'Counting', toneClass: 'text-amber-300' };
    case 'seeking':
      return { label: 'Seeking', toneClass: 'text-orange-300' };
    case 'hiding':
      return { label: 'Hiding', toneClass: 'text-emerald-300' };
    case 'moving':
      return { label: 'Moving', toneClass: 'text-sky-300' };
    case 'caught':
      return { label: 'Caught', toneClass: 'text-rose-300' };
    default:
      return { label: 'Ready', toneClass: 'text-amber-100/75' };
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ChhupanChhupaiEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const liveStatusRef = useRef<Record<string, PlayerLiveStatus>>({});
  const mutedPlayerIdsRef = useRef<Record<string, boolean>>({});
  const localOnlinePlayerIdRef = useRef<string | null>(null);
  const showChatDrawerRef = useRef(false);
  const hudChatFeedRef = useRef<HTMLDivElement | null>(null);
  const lobbyChatFeedRef = useRef<HTMLDivElement | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [chosenRole, setChosenRole] = useState<TeamRole>('hider');
  const [customization, setCustomization] = useState<CharacterCustomization>(
    INITIAL_CUSTOMIZATION,
  );
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showOnlineRoster, setShowOnlineRoster] = useState(true);
  const [startTab, setStartTab] = useState<'levels' | 'character' | 'online'>(
    'levels',
  );

  // Real-time online multiplayer room state
  const [mpStatus, setMpStatus] =
    useState<MultiplayerConnectionStatus>('disconnected');
  const [onlineRoom, setOnlineRoom] = useState<MultiplayerRoomSnapshot | null>(
    null,
  );
  const [localOnlinePlayerId, setLocalOnlinePlayerId] = useState<string | null>(
    null,
  );
  const [liveStatusMap, setLiveStatusMap] = useState<
    Record<string, PlayerLiveStatus>
  >({});
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<'code' | 'link' | null>(
    null,
  );

  // Real-time room chat, quick chat, emotes, mute & reporting state
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [mutedPlayerIds, setMutedPlayerIds] = useState<Record<string, boolean>>(
    {},
  );
  const [reportedPlayerIds, setReportedPlayerIds] = useState<
    Record<string, boolean>
  >({});
  const [chatInput, setChatInput] = useState('');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [reportReason, setReportReason] =
    useState<ReportReason>('inappropriate_chat');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  const pushSafetyNotice = useCallback((notice: string) => {
    setSafetyNotice(notice);
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
    }
    safetyTimerRef.current = window.setTimeout(() => {
      setSafetyNotice(null);
      safetyTimerRef.current = null;
    }, 3200);
  }, []);

  // Keep refs & 3D engine mute filter synced with React state
  useEffect(() => {
    mutedPlayerIdsRef.current = mutedPlayerIds;
    const mutedSet = new Set(
      Object.keys(mutedPlayerIds).filter((id) => mutedPlayerIds[id]),
    );
    engineRef.current?.setMutedPlayerIds(mutedSet);
  }, [mutedPlayerIds]);

  useEffect(() => {
    showChatDrawerRef.current = showChatDrawer;
    if (showChatDrawer) {
      setUnreadChatCount(0);
    }
  }, [showChatDrawer]);

  useEffect(() => {
    if (hudChatFeedRef.current) {
      hudChatFeedRef.current.scrollTop = hudChatFeedRef.current.scrollHeight;
    }
    if (lobbyChatFeedRef.current) {
      lobbyChatFeedRef.current.scrollTop = lobbyChatFeedRef.current.scrollHeight;
    }
  }, [chatMessages, showChatDrawer]);

  // Detect optional ?room=XXXXXX invite link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('room');
    if (inviteCode) {
      const cleaned = inviteCode
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      if (cleaned.length >= 4) {
        setJoinCodeInput(cleaned);
        setStartTab('online');
      }
    }
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new ChhupanChhupaiEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    const mpClient = new MultiplayerClient({
      onStatusChange: (status) => {
        setMpStatus(status);
      },
      onRoomChange: (room, playerId) => {
        setRoomError(null);
        setOnlineRoom(room);
        setLocalOnlinePlayerId(playerId);
        localOnlinePlayerIdRef.current = playerId;

        if (room && playerId) {
          const nextMap: Record<string, PlayerLiveStatus> = {};
          for (const p of room.players) {
            nextMap[p.id] = p.liveStatus;
          }
          liveStatusRef.current = nextMap;
          setLiveStatusMap(nextMap);

          if (room.phase === 'playing') {
            setShowScoreboard(false);
            setShowCameraSettings(false);
            setShowAudioSettings(false);
            setShowEmotePicker(false);
          }
          engine.syncOnlineRoom(room, playerId);
        } else {
          liveStatusRef.current = {};
          setLiveStatusMap({});
          setChatMessages([]);
          setUnreadChatCount(0);
          setShowChatDrawer(false);
          setShowEmotePicker(false);
          setReportTarget(null);
          engine.exitOnlineMode();
        }
      },
      onPositions: (positions) => {
        engine.applyOnlinePositions(positions);
        let changed = false;
        const next = { ...liveStatusRef.current };
        for (const p of positions) {
          if (next[p.id] !== p.liveStatus) {
            next[p.id] = p.liveStatus;
            changed = true;
          }
        }
        if (changed) {
          liveStatusRef.current = next;
          setLiveStatusMap(next);
        }
      },
      onMatchEvent: (event) => {
        engine.handleOnlineMatchEvent(event);
      },
      onChatHistory: (messages) => {
        setChatMessages(messages.slice(-50));
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => {
          if (prev.some((existing) => existing.id === msg.id)) {
            return prev;
          }
          return [...prev.slice(-59), msg];
        });

        if (mutedPlayerIdsRef.current[msg.senderId]) {
          return;
        }

        if (msg.kind !== 'emote') {
          engine.showCharacterChatBubble(msg.senderId, msg.text, false);
        }

        if (
          !showChatDrawerRef.current &&
          msg.senderId !== localOnlinePlayerIdRef.current
        ) {
          setUnreadChatCount((c) => Math.min(99, c + 1));
        }
      },
      onPlayerEmote: (ev: PlayerEmotePayload) => {
        if (mutedPlayerIdsRef.current[ev.senderId]) {
          return;
        }
        const def = getEmoteDefinition(ev.emote);
        engine.triggerCharacterEmote(ev.senderId, ev.emote, def.bubbleText);
      },
      onReportAck: (reportedPlayerId, message) => {
        setReportedPlayerIds((prev) => ({
          ...prev,
          [reportedPlayerId]: true,
        }));
        setReportTarget(null);
        setReportDetails('');
        pushSafetyNotice(message);
      },
      onError: (message) => {
        setRoomError(message);
      },
    });
    mpClientRef.current = mpClient;

    engine.setOnlineCallbacks(
      (state) => mpClient.sendPlayerState(state),
      (targetId) => mpClient.sendTagAttempt(targetId),
    );

    return () => {
      if (safetyTimerRef.current !== null) {
        window.clearTimeout(safetyTimerRef.current);
      }
      engine.setOnlineCallbacks(null, null);
      mpClient.dispose();
      mpClientRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
  }, [pushSafetyNotice]);

  // Keep the live 3D character showcase on the start screen synchronized with every edit
  useEffect(() => {
    engineRef.current?.updateStartPreview(customization, chosenRole);
  }, [customization, chosenRole]);

  // Sync character customization updates to the online waiting lobby (debounced for typing)
  useEffect(() => {
    if (!onlineRoom || onlineRoom.phase !== 'lobby') return;
    const timer = window.setTimeout(() => {
      mpClientRef.current?.updateProfile(customization, hud.unlockedLevel);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [customization, hud.unlockedLevel, onlineRoom?.code, onlineRoom?.phase]);

  const handleSelectPreset = (preset: CharacterPreset) => {
    setCustomization(createCustomizationFromPreset(preset));
  };

  const handleOutfitStyleChange = (outfitStyle: OutfitStyle) => {
    setCustomization((prev) => ({
      ...prev,
      outfitStyle,
      outfitColor:
        outfitStyle === 'school_uniform' ? 0xf2ede0 : prev.outfitColor,
    }));
  };

  const handleOutfitColorChange = (outfitColor: number) => {
    setCustomization((prev) => ({
      ...prev,
      outfitColor,
      outfitStyle:
        prev.outfitStyle === 'school_uniform' && outfitColor !== 0xf2ede0
          ? 'shirt_shorts'
          : prev.outfitStyle,
    }));
  };

  const handleAccessoryChange = (accessory: AccessoryType) => {
    setCustomization((prev) => ({ ...prev, accessory }));
  };

  const handleNameChange = (name: string) => {
    setCustomization((prev) => ({ ...prev, name: name.slice(0, 16) }));
  };

  const handleSelectLevel = (levelId: number) => {
    engineRef.current?.selectLevel(levelId);
  };

  const handleStartMatch = () => {
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    engineRef.current?.startMatch(chosenRole, customization);
  };

  const handleRestart = () => {
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    engineRef.current?.restartMatch();
  };

  const handleSwapSoloRole = () => {
    const nextRole = hud.playerRole === 'hider' ? 'seeker' : 'hider';
    setChosenRole(nextRole);
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    engineRef.current?.startMatch(nextRole, customization);
  };

  const handleNextLevel = () => {
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    engineRef.current?.advanceToNextLevel();
  };

  const handleSwitchTeam = () => {
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    engineRef.current?.returnToStart();
  };

  const handleToggleHide = () => {
    engineRef.current?.toggleHide();
  };

  const handleJump = () => {
    engineRef.current?.triggerJump();
  };

  const handleTag = () => {
    engineRef.current?.tryTag();
  };

  const handleTouchMove = (x: number, y: number) => {
    engineRef.current?.setTouchInput(x, y);
  };

  const handleRecenterCamera = () => {
    engineRef.current?.recenterCamera();
  };

  const handleCameraSettingChange = (partial: Partial<CameraSettings>) => {
    engineRef.current?.updateCameraSettings(partial);
  };

  const handleResetCameraSettings = () => {
    engineRef.current?.resetCameraSettings();
  };

  const handleGraphicsQualityChange = (quality: GraphicsQuality) => {
    engineRef.current?.setGraphicsQuality(quality);
  };

  const handleAudioSettingChange = (partial: Partial<AudioSettings>) => {
    engineRef.current?.updateAudioSettings(partial);
  };

  const handleToggleMute = () => {
    engineRef.current?.toggleMute();
  };

  const registerMinimapListener = useCallback(
    (cb: ((frame: MinimapFrame) => void) | null) => {
      engineRef.current?.setMinimapListener(cb);
    },
    [],
  );

  const handleCreateRoom = () => {
    setRoomError(null);
    mpClientRef.current?.createRoom(
      customization,
      hud.unlockedLevel,
      Math.min(hud.currentLevelId, hud.unlockedLevel),
    );
  };

  const handleJoinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (cleaned.length < 4) {
      setRoomError('Enter a valid room code to join.');
      return;
    }
    setRoomError(null);
    mpClientRef.current?.joinRoom(cleaned, customization);
  };

  const handleHostSelectMap = (levelId: number) => {
    if (levelId > hud.unlockedLevel) return;
    setRoomError(null);
    mpClientRef.current?.selectMap(levelId, hud.unlockedLevel);
  };

  const handleHostStartOnlineMatch = () => {
    setRoomError(null);
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    mpClientRef.current?.startMatch();
  };

  const handleHostReturnToLobby = () => {
    setRoomError(null);
    mpClientRef.current?.returnToLobby();
  };

  const handleLeaveOnlineRoom = () => {
    setRoomError(null);
    setShowScoreboard(false);
    setShowCameraSettings(false);
    setShowAudioSettings(false);
    mpClientRef.current?.leaveRoom();
  };

  const handleCopyRoomText = (mode: 'code' | 'link') => {
    if (!onlineRoom) return;
    const text =
      mode === 'code'
        ? onlineRoom.code
        : `${window.location.origin}${window.location.pathname}?room=${onlineRoom.code}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedNotice(mode);
    window.setTimeout(() => {
      setCopiedNotice((prev) => (prev === mode ? null : prev));
    }, 1800);
  };

  const handleSendChat = (rawText?: string, isQuickChat = false) => {
    if (!onlineRoom || !localOnlinePlayerId) return;
    const source = rawText ?? chatInput;
    const filtered = filterChatMessage(source);
    if (filtered.empty) return;
    mpClientRef.current?.sendChat(filtered.text, isQuickChat);
    if (!isQuickChat) {
      setChatInput('');
    }
    if (filtered.wasFiltered) {
      pushSafetyNotice('Message cleaned by chat filter.');
    }
  };

  const handleSendEmote = (emote: EmoteType) => {
    if (!onlineRoom || !localOnlinePlayerId) return;
    mpClientRef.current?.sendEmote(emote);
    setShowEmotePicker(false);
  };

  const handleToggleMutePlayer = (playerId: string, playerName: string) => {
    if (playerId === localOnlinePlayerId) return;
    setMutedPlayerIds((prev) => {
      const nextMuted = !prev[playerId];
      pushSafetyNotice(
        nextMuted
          ? `Muted ${playerName}. You will not see their messages or emotes.`
          : `Unmuted ${playerName}.`,
      );
      return {
        ...prev,
        [playerId]: nextMuted,
      };
    });
  };

  const handleOpenReportModal = (playerId: string, playerName: string) => {
    if (playerId === localOnlinePlayerId) return;
    setReportTarget({ id: playerId, name: playerName });
    setReportReason('inappropriate_chat');
    setReportDetails('');
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    mpClientRef.current?.reportPlayer(
      reportTarget.id,
      reportReason,
      reportDetails,
    );
  };

  const selectedPreset = getPresetById(customization.presetId);
  const displayChosenName =
    customization.name.trim() || selectedPreset.defaultName;
  const activeLevel = getLevelConfig(hud.currentLevelId);
  const nextLevelConfig =
    hud.currentLevelId < TOTAL_LEVELS
      ? getLevelConfig(hud.currentLevelId + 1)
      : null;

  const isInOnlineRoom = onlineRoom !== null && localOnlinePlayerId !== null;
  const isOnlineHost =
    isInOnlineRoom && onlineRoom.hostId === localOnlinePlayerId;
  const onlineNextSeeker = isInOnlineRoom
    ? onlineRoom.players.find((p) => p.id === onlineRoom.nextSeekerId) ?? null
    : null;

  const hiders = hud.participants.filter((p) => p.role === 'hider');
  const caughtHiders = hiders.filter((p) => p.caught);
  const survivingHiders = hiders.filter((p) => !p.caught);
  const seeker = hud.participants.find((p) => p.role === 'seeker');

  const playerWon =
    hud.winner !== null &&
    ((hud.winner === 'hiders' && hud.playerRole === 'hider') ||
      (hud.winner === 'seekers' && hud.playerRole === 'seeker'));
  const canPlayNextLevel =
    !isInOnlineRoom &&
    playerWon &&
    nextLevelConfig !== null &&
    nextLevelConfig.id <= hud.unlockedLevel;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1b140f]">
      {/* Isolated WebGL canvas mount — never re-created by React HUD state */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Graceful WebGL error fallback */}
      {hud.webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1b140f]/95 p-6">
          <div className="max-w-md rounded-xl border border-amber-200/20 bg-[#261b14] p-6 text-center">
            <h2 className="font-display text-2xl font-semibold text-amber-50">
              3D View Unavailable
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">{hud.webglError}</p>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {hud.phase === 'playing' && !hud.webglError && (
        <>
          {/* Top-left Circular Minimap (hidden while seeker counts with eyes closed) + compact clickable Timer */}
          <div className="pointer-events-none absolute top-2.5 left-1.5 sm:top-3 sm:left-2 z-20 flex items-start gap-1.5 sm:gap-2.5">
            {!(hud.countdownSeconds > 0 && hud.playerRole === 'seeker') && (
              <CircularMinimap
                registerListener={registerMinimapListener}
                playerRole={hud.playerRole}
              />
            )}

            <div className="pointer-events-auto relative flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowScoreboard((prev) => !prev);
                  setShowCameraSettings(false);
                  setShowAudioSettings(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-expanded={showScoreboard}
                aria-label="Match timer and scoreboard"
                title="Click to view remaining and caught players"
                className={`inline-flex items-center gap-1 sm:gap-1.5 min-h-[28px] sm:min-h-[42px] rounded-lg border px-1.5 sm:px-3 py-0.5 sm:py-2 font-mono text-[11px] sm:text-base font-bold tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  showScoreboard
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : hud.countdownSeconds === 0 && hud.timeRemaining <= 15
                      ? 'bg-rose-950/92 hover:bg-rose-900 text-rose-100 border-rose-400/70'
                      : 'bg-[#1d140e]/85 hover:bg-[#2c1f16] text-amber-300 border-amber-100/20'
                }`}
              >
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                <span>{formatClock(hud.timeRemaining)}</span>
              </button>

              <div
                aria-label={`${hud.remainingHiders} of ${hud.totalHiders} players still hiding`}
                title={`${hud.remainingHiders} of ${hud.totalHiders} players still hiding`}
                className="inline-flex items-center gap-1 sm:gap-1.5 min-h-[26px] sm:min-h-[42px] rounded-lg border border-amber-100/20 bg-[#1d140e]/85 px-1.5 sm:px-3 py-0.5 sm:py-2 text-[10px] sm:text-sm font-semibold text-amber-50 whitespace-nowrap shrink-0"
              >
                <EyeOff
                  className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-300 shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline text-amber-100/75">
                  Still Hiding:
                </span>
                <span className="font-mono font-bold tabular-nums text-emerald-300">
                  {hud.remainingHiders}/{hud.totalHiders}
                </span>
              </div>

              {showScoreboard && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-1.5 w-[228px] sm:w-[252px] max-w-[calc(100vw-6rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-amber-200/20 bg-[#1f150f]/95 p-3 sm:p-4 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-amber-100/12 pb-2">
                    <h2 className="font-display text-sm font-semibold text-amber-50">
                      Match Scoreboard
                    </h2>
                    <span className="font-mono text-xs font-semibold text-amber-300 tabular-nums">
                      {formatClock(hud.timeRemaining)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3 text-xs max-h-[260px] overflow-y-auto pr-0.5">
                    <div>
                      <div className="flex items-center justify-between text-amber-200/85 font-semibold">
                        <span>Remaining Hiders</span>
                        <span className="tabular-nums">
                          {survivingHiders.length}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1 text-amber-50/90">
                        {survivingHiders.length > 0 ? (
                          survivingHiders.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate pr-2">
                                {h.name}
                                {h.isPlayer ? ' (You)' : ''}
                              </span>
                              <span className="text-amber-200/70 shrink-0">
                                {isInOnlineRoom
                                  ? formatLiveStatus(
                                      liveStatusMap[h.id] ?? 'moving',
                                    ).label
                                  : 'Hiding'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-amber-100/50">None remaining</div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-amber-100/12 pt-2.5">
                      <div className="flex items-center justify-between text-amber-200/85 font-semibold">
                        <span>Caught Players</span>
                        <span className="tabular-nums">
                          {caughtHiders.length}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1 text-amber-100/75">
                        {caughtHiders.length > 0 ? (
                          caughtHiders.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate pr-2">
                                {h.name}
                                {h.isPlayer ? ' (You)' : ''}
                              </span>
                              <span className="font-mono tabular-nums text-amber-200/65 shrink-0">
                                {h.caughtAtSeconds !== null
                                  ? formatClock(h.caughtAtSeconds)
                                  : 'Caught'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-amber-100/50">
                            No one caught yet
                          </div>
                        )}
                      </div>
                    </div>

                    {seeker && (
                      <div className="border-t border-amber-100/12 pt-2.5 flex items-center justify-between text-amber-100/80">
                        <span>Seeker</span>
                        <span className="font-semibold text-amber-50">
                          {seeker.name}
                          {seeker.isPlayer ? ' (You)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top-right Sound, Mute, Behind-Player Camera, Camera Settings & Restart buttons */}
          <div className="absolute top-2.5 right-1.5 sm:top-3.5 sm:right-3.5 z-10 flex items-center gap-[3px] sm:gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              onPointerDown={(e) => e.stopPropagation()}
              title={hud.audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
              aria-label={hud.audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
              aria-pressed={hud.audioSettings.muted}
              className={`inline-flex items-center justify-center min-w-[28px] min-h-[30px] sm:min-w-[42px] sm:min-h-[42px] rounded-lg border px-1 sm:px-2.5 py-1 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                hud.audioSettings.muted
                  ? 'bg-amber-500/25 text-amber-200 border-amber-300'
                  : 'bg-[#1d140e]/82 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
              }`}
            >
              {hud.audioSettings.muted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAudioSettings((prev) => !prev);
                setShowCameraSettings(false);
                setShowScoreboard(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-expanded={showAudioSettings}
              aria-label="Sound and music volume settings"
              className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[28px] min-h-[30px] sm:min-h-[42px] rounded-lg border px-1 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                showAudioSettings
                  ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                  : 'bg-[#1d140e]/82 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
              }`}
            >
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Sound</span>
            </button>

            <button
              type="button"
              onClick={handleRecenterCamera}
              title="Return camera behind character (R)"
              aria-label="Center camera behind character"
              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[28px] min-h-[30px] sm:min-h-[42px] rounded-lg bg-[#1d140e]/82 hover:bg-[#2c1f16] active:scale-[0.98] border border-amber-100/20 px-1 sm:px-3.5 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">Behind View</span>
              <span className="hidden sm:inline md:hidden">Center</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCameraSettings((prev) => !prev);
                setShowAudioSettings(false);
                setShowScoreboard(false);
              }}
              aria-expanded={showCameraSettings}
              aria-label="Camera and graphics settings"
              className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[28px] min-h-[30px] sm:min-h-[42px] rounded-lg border px-1 sm:px-3.5 py-1 sm:py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                showCameraSettings
                  ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                  : 'bg-[#1d140e]/82 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {isInOnlineRoom && (
              <button
                type="button"
                onClick={() => {
                  setShowOnlineRoster((prev) => !prev);
                  setShowAudioSettings(false);
                  setShowCameraSettings(false);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-expanded={showOnlineRoster}
                aria-label="Toggle live players status"
                className={`inline-flex items-center justify-center gap-0.5 sm:gap-1.5 min-h-[30px] sm:min-h-[42px] rounded-lg border px-1.5 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  showOnlineRoster
                    ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                    : 'bg-[#1d140e]/82 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
                }`}
              >
                <Users className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  {onlineRoom.players.length}/{MAX_ROOM_PLAYERS}
                </span>
              </button>
            )}

            {isInOnlineRoom ? (
              <button
                type="button"
                onClick={handleLeaveOnlineRoom}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Leave online room"
                className="inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[28px] min-h-[30px] sm:min-h-[42px] rounded-lg bg-[#1d140e]/82 hover:bg-[#3a1f18] active:scale-[0.98] border border-amber-100/20 px-1 sm:px-3.5 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestart}
                aria-label="Restart match"
                className="inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[28px] min-h-[30px] sm:min-h-[42px] rounded-lg bg-[#1d140e]/82 hover:bg-[#2c1f16] active:scale-[0.98] border border-amber-100/20 px-1 sm:px-3.5 py-1 sm:py-2 text-xs sm:text-sm font-semibold text-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Restart</span>
              </button>
            )}
          </div>

          {/* Live Online Players Name & Status Panel (visible during multiplayer matches) */}
          {isInOnlineRoom &&
            showOnlineRoster &&
            !showAudioSettings &&
            !showCameraSettings && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-12 sm:top-16 right-2 sm:right-3.5 z-10 w-[238px] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-amber-200/20 bg-[#1d140e]/92 px-3 py-2.5 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-amber-100/12 pb-1.5">
                  <span className="text-[11px] font-bold tracking-wide text-amber-200">
                    Room {onlineRoom.code} · Round {onlineRoom.roundNumber}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-amber-100/70">
                    {onlineRoom.players.length}/{MAX_ROOM_PLAYERS}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 max-h-[215px] overflow-y-auto pr-0.5 text-xs">
                  {onlineRoom.players.map((p) => {
                    const statusKey: PlayerLiveStatus = p.caught
                      ? 'caught'
                      : liveStatusMap[p.id] ?? p.liveStatus;
                    const badge = formatLiveStatus(statusKey);
                    const isMe = p.id === localOnlinePlayerId;
                    const isMuted = Boolean(mutedPlayerIds[p.id]);
                    const isReported = Boolean(reportedPlayerIds[p.id]);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-1.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              p.role === 'seeker'
                                ? 'bg-amber-400'
                                : p.caught
                                  ? 'bg-rose-400'
                                  : 'bg-emerald-400'
                            }`}
                          />
                          <span className="truncate text-amber-50/95 font-medium">
                            {p.name}
                            {isMe ? ' (You)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[11px] font-semibold ${badge.toneClass}`}
                          >
                            {p.role === 'seeker'
                              ? `Seeker · ${badge.label}`
                              : badge.label}
                          </span>
                          {!isMe && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleMutePlayer(p.id, p.name)
                                }
                                title={isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                                aria-label={
                                  isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`
                                }
                                aria-pressed={isMuted}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors cursor-pointer ${
                                  isMuted
                                    ? 'bg-rose-900/70 border-rose-400/50 text-rose-200'
                                    : 'bg-[#140d09]/70 border-amber-100/15 text-amber-100/70 hover:text-amber-50'
                                }`}
                              >
                                {isMuted ? (
                                  <VolumeX className="w-3 h-3" aria-hidden="true" />
                                ) : (
                                  <Volume2 className="w-3 h-3" aria-hidden="true" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenReportModal(p.id, p.name)
                                }
                                disabled={isReported}
                                title={
                                  isReported
                                    ? `Reported ${p.name}`
                                    : `Report ${p.name}`
                                }
                                aria-label={
                                  isReported
                                    ? `Reported ${p.name}`
                                    : `Report ${p.name}`
                                }
                                className={`inline-flex items-center justify-center w-6 h-6 rounded border transition-colors ${
                                  isReported
                                    ? 'bg-[#140d09]/50 border-amber-100/10 text-amber-100/35 cursor-not-allowed'
                                    : 'bg-[#140d09]/70 border-amber-100/15 text-amber-100/70 hover:text-rose-200 hover:border-rose-400/45 cursor-pointer'
                                }`}
                              >
                                <Flag className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Expandable Sound & Music Volume Panel */}
          {showAudioSettings && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-12 sm:top-16 right-2 sm:right-3.5 z-20 w-[264px] sm:w-[276px] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-amber-200/20 bg-[#1f150f]/95 p-3 sm:p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-amber-100/12 pb-2">
                <h2 className="font-display text-base font-semibold text-amber-50">
                  1995 Village Audio
                </h2>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  {hud.audioSettings.muted ? 'Unmute' : 'Mute All'}
                </button>
              </div>

              <div className="mt-3 space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between text-amber-100/90 font-medium">
                    <label htmlFor="hud-music-vol">Background Music</label>
                    <span className="font-mono tabular-nums text-amber-300">
                      {Math.round(hud.audioSettings.musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    id="hud-music-vol"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={hud.audioSettings.musicVolume}
                    onChange={(e) =>
                      handleAudioSettingChange({
                        musicVolume: parseFloat(e.target.value),
                        muted: false,
                      })
                    }
                    className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-amber-100/90 font-medium">
                    <label htmlFor="hud-sfx-vol">Sound Effects &amp; Village</label>
                    <span className="font-mono tabular-nums text-amber-300">
                      {Math.round(hud.audioSettings.sfxVolume * 100)}%
                    </span>
                  </div>
                  <input
                    id="hud-sfx-vol"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={hud.audioSettings.sfxVolume}
                    onChange={(e) =>
                      handleAudioSettingChange({
                        sfxVolume: parseFloat(e.target.value),
                        muted: false,
                      })
                    }
                    className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-amber-100/12 pt-3">
                  <span className="text-amber-100/90 font-medium">Mute Audio</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hud.audioSettings.muted}
                    onClick={handleToggleMute}
                    className={`min-w-[54px] min-h-[30px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      hud.audioSettings.muted
                        ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                        : 'bg-[#140d09] text-amber-100/70 border-amber-100/20'
                    }`}
                  >
                    {hud.audioSettings.muted ? 'Muted' : 'On'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expandable Camera Settings Panel */}
          {showCameraSettings && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-12 sm:top-16 right-2 sm:right-3.5 z-20 w-[268px] sm:w-[284px] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-amber-200/20 bg-[#1f150f]/95 p-3 sm:p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-amber-100/12 pb-2">
                <h2 className="font-display text-base font-semibold text-amber-50">
                  Camera &amp; Graphics
                </h2>
                <button
                  type="button"
                  onClick={handleResetCameraSettings}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  Reset
                </button>
              </div>

              <div className="mt-3 space-y-3.5 text-xs">
                {/* Rotation Sensitivity */}
                <div>
                  <div className="flex items-center justify-between text-amber-100/90 font-medium">
                    <label htmlFor="cam-sensitivity">Rotation Sensitivity</label>
                    <span className="font-mono tabular-nums text-amber-300">
                      {hud.cameraSettings.sensitivity.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    id="cam-sensitivity"
                    type="range"
                    min={CAMERA_MIN_SENSITIVITY}
                    max={CAMERA_MAX_SENSITIVITY}
                    step={0.05}
                    value={hud.cameraSettings.sensitivity}
                    onChange={(e) =>
                      handleCameraSettingChange({
                        sensitivity: parseFloat(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Zoom Distance */}
                <div>
                  <div className="flex items-center justify-between text-amber-100/90 font-medium">
                    <label htmlFor="cam-zoom-distance">Zoom Distance</label>
                    <span className="font-mono tabular-nums text-amber-300">
                      {hud.cameraSettings.zoomDistance.toFixed(1)}m
                    </span>
                  </div>
                  <input
                    id="cam-zoom-distance"
                    type="range"
                    min={CAMERA_MIN_ZOOM}
                    max={CAMERA_MAX_ZOOM}
                    step={0.2}
                    value={hud.cameraSettings.zoomDistance}
                    onChange={(e) =>
                      handleCameraSettingChange({
                        zoomDistance: parseFloat(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Zoom Speed */}
                <div>
                  <div className="flex items-center justify-between text-amber-100/90 font-medium">
                    <label htmlFor="cam-zoom-speed">Zoom Speed</label>
                    <span className="font-mono tabular-nums text-amber-300">
                      {hud.cameraSettings.zoomSpeed.toFixed(2)}×
                    </span>
                  </div>
                  <input
                    id="cam-zoom-speed"
                    type="range"
                    min={CAMERA_MIN_ZOOM_SPEED}
                    max={CAMERA_MAX_ZOOM_SPEED}
                    step={0.1}
                    value={hud.cameraSettings.zoomSpeed}
                    onChange={(e) =>
                      handleCameraSettingChange({
                        zoomSpeed: parseFloat(e.target.value),
                      })
                    }
                    className="mt-1.5 w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Auto-Follow Toggle */}
                <div className="flex items-center justify-between border-t border-amber-100/12 pt-3">
                  <span className="text-amber-100/90 font-medium">
                    Auto-Follow While Moving
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hud.cameraSettings.autoFollow}
                    onClick={() =>
                      handleCameraSettingChange({
                        autoFollow: !hud.cameraSettings.autoFollow,
                      })
                    }
                    className={`min-w-[54px] min-h-[30px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      hud.cameraSettings.autoFollow
                        ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                        : 'bg-[#140d09] text-amber-100/70 border-amber-100/20'
                    }`}
                  >
                    {hud.cameraSettings.autoFollow ? 'On' : 'Off'}
                  </button>
                </div>

                {/* Graphics Quality Selector */}
                <div className="border-t border-amber-100/12 pt-3">
                  <div className="flex items-center justify-between text-amber-100/90 font-medium mb-1.5">
                    <span>Graphics Quality</span>
                    <span className="font-mono text-[11px] uppercase text-amber-300">
                      {hud.graphicsQuality}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                      const active = hud.graphicsQuality === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleGraphicsQualityChange(opt.id)}
                          aria-pressed={active}
                          className={`min-h-[30px] rounded-lg border px-2 py-1 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                            active
                              ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                              : 'bg-[#140d09] text-amber-100/75 border-amber-100/20 hover:border-amber-200/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-amber-100/12 pt-2.5 text-[11px] text-amber-100/65 leading-relaxed">
                  PC: WASD move · Space jump · Drag rotate · Scroll zoom · R center.
                  <br />
                  Mobile: Joystick move · JUMP button · Swipe rotate · Pinch zoom.
                </div>
              </div>
            </div>
          )}

          {/* Seeker Eyes-Closed Blindfold Counting Screen (prevents peeking while counting) */}
          {hud.countdownSeconds > 0 && hud.playerRole === 'seeker' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-0 z-[9] flex items-center justify-center bg-[#0d0806]/96 p-6"
            >
              <div className="w-full max-w-md rounded-2xl border border-amber-300/35 bg-[#1b120c] px-6 py-7 text-center shadow-2xl">
                <div className="mx-auto inline-flex items-center justify-center w-12 h-12 rounded-xl border border-amber-300/30 bg-[#2a1c12] text-amber-300">
                  <EyeOff className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-300/90">
                  Eyes Closed · Counting
                </div>
                <div className="mt-2 font-mono text-6xl font-extrabold tabular-nums text-amber-50">
                  {hud.countdownSeconds}
                </div>
                <p className="mt-3 text-sm text-amber-100/85 leading-relaxed">
                  Keep your eyes closed! Hiders are dispersing behind walls, trees, vehicles, and inside village buildings.
                </p>
              </div>
            </div>
          )}

          {/* Clear Pre-Search Countdown Banner for Hiders */}
          {hud.countdownSeconds > 0 && hud.playerRole === 'hider' && (
            <div className="pointer-events-none absolute top-[118px] sm:top-16 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100vw-1rem)] rounded-xl bg-[#1d140e]/92 border border-amber-300/45 px-3 sm:px-4 py-1.5 sm:py-2 text-center shadow-xl">
              <div className="text-[11px] sm:text-sm font-bold text-amber-200 tabular-nums whitespace-nowrap">
                Hide now! Seeker counting:{' '}
                <span className="font-mono text-amber-50">
                  {hud.countdownSeconds}s
                </span>
              </div>
              <div className="mt-0.5 text-[10px] sm:text-[11px] text-amber-100/75 hidden sm:block">
                Hide behind walls, trees, vehicles, or inside open buildings
              </div>
            </div>
          )}

          {/* Transient top-center match event notice (hidden during hider countdown banner to prevent overlap) */}
          {hud.eventBanner &&
            !(hud.countdownSeconds > 0 && hud.playerRole === 'hider') && (
              <div className="pointer-events-none absolute top-[118px] sm:top-16 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100vw-1rem)] truncate rounded-lg bg-[#1d140e]/88 border border-amber-200/25 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-medium text-amber-50 text-center">
                {hud.eventBanner}
              </div>
            )}

          {/* Caught Player Spectating Bar (cycle across remaining hiders and seeker) */}
          {hud.playerCaught && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 sm:gap-2 max-w-[calc(100vw-1rem)] rounded-xl border border-amber-200/30 bg-[#1d140e]/92 px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-2xl ${
                isInOnlineRoom ? 'bottom-[70px] sm:bottom-6' : 'bottom-4 sm:bottom-6'
              }`}
            >
              {hud.spectatingCanCycle && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.cycleSpectateTarget(-1)}
                  aria-label="Previous player to watch"
                  className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] rounded-lg border border-amber-100/20 bg-[#2a1d14] hover:bg-[#3a281c] text-amber-100 transition-colors cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
              )}

              <div className="px-1 sm:px-2 text-center min-w-0">
                <div className="text-[11px] sm:text-xs font-bold text-amber-50 truncate">
                  {hud.spectatingName
                    ? `Watching ${hud.spectatingName} (${hud.spectatingRole === 'seeker' ? 'Seeker' : 'Hider'})`
                    : 'Caught! Switching to live view...'}
                </div>
                <div className="text-[10px] sm:text-[11px] text-amber-200/80 whitespace-nowrap tabular-nums">
                  {hud.remainingHiders}{' '}
                  {hud.remainingHiders === 1 ? 'hider' : 'hiders'} hiding ·{' '}
                  {formatClock(hud.timeRemaining)} left
                </div>
              </div>

              {hud.spectatingCanCycle && (
                <button
                  type="button"
                  onClick={() => engineRef.current?.cycleSpectateTarget(1)}
                  aria-label="Next player to watch"
                  className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-[38px] sm:min-h-[38px] rounded-lg border border-amber-100/20 bg-[#2a1d14] hover:bg-[#3a281c] text-amber-100 transition-colors cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Bottom-left Mobile Touch Joystick + desktop hint */}
          {!hud.playerCaught && (
            <div className="absolute bottom-4 left-3 sm:bottom-5 sm:left-5 z-10 flex flex-col items-start gap-2">
              <TouchJoystick onMove={handleTouchMove} />
              <div className="pointer-events-none hidden sm:block text-xs text-amber-50/85 bg-[#1d140e]/75 px-2.5 py-1 rounded">
                {hud.playerRole === 'hider'
                  ? 'WASD move · Space jump · Drag rotate · R center · C hide'
                  : 'WASD move · Space jump · Drag rotate · R center · E tag'}
              </div>
            </div>
          )}

          {/* Bottom-right role action column: JUMP stacked cleanly above HIDE / TAG */}
          {!hud.playerCaught &&
            !(hud.countdownSeconds > 0 && hud.playerRole === 'seeker') && (
            <div className="absolute bottom-4 right-3 sm:bottom-6 sm:right-5 z-10 flex flex-col items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleJump}
                aria-label="Jump"
                className="inline-flex items-center justify-center gap-1 sm:gap-1.5 min-w-[92px] sm:min-w-[116px] min-h-[38px] sm:min-h-[44px] rounded-xl border border-amber-100/25 bg-[#1d140e]/88 hover:bg-[#2d2017] active:scale-[0.97] px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold tracking-wide text-amber-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <ArrowUp
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <span>JUMP</span>
              </button>

              {hud.playerRole === 'hider' ? (
                <button
                  type="button"
                  onClick={handleToggleHide}
                  aria-pressed={hud.isHiding}
                  className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-w-[92px] sm:min-w-[116px] min-h-[46px] sm:min-h-[54px] rounded-xl border px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold tracking-wide transition-colors active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    hud.isHiding
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200 shadow-md'
                      : 'bg-[#1d140e]/88 hover:bg-[#2d2017] text-amber-50 border-amber-100/25'
                  }`}
                >
                  <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{hud.isHiding ? 'HIDING' : 'HIDE'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTag}
                  disabled={!hud.canTag}
                  className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 min-w-[92px] sm:min-w-[116px] min-h-[46px] sm:min-h-[54px] rounded-xl border px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold tracking-wide transition-colors active:scale-[0.97] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    hud.canTag
                      ? 'bg-[#d96b27] hover:bg-[#e87933] text-white border-amber-200/80 shadow-lg cursor-pointer'
                      : 'bg-[#1d140e]/65 text-amber-100/45 border-amber-100/15 cursor-not-allowed'
                  }`}
                >
                  <Hand className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>TAG</span>
                </button>
              )}
            </div>
          )}

          {/* Online Multiplayer Chat & Emotes HUD Controls (active across all 8 maps) */}
          {isInOnlineRoom && (
            <>
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className={`absolute bottom-4 sm:bottom-6 z-20 flex items-center gap-1.5 sm:gap-2 ${
                  !hud.playerCaught
                    ? 'right-[112px] sm:right-[140px]'
                    : 'right-3 sm:right-5'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowEmotePicker((prev) => !prev);
                    setShowChatDrawer(false);
                  }}
                  aria-expanded={showEmotePicker}
                  aria-label="Open emotes"
                  title="Emotes"
                  className={`inline-flex items-center justify-center gap-1.5 min-w-[42px] min-h-[42px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl border px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    showEmotePicker
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                      : 'bg-[#1d140e]/88 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
                  }`}
                >
                  <Smile className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Emote</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowChatDrawer((prev) => !prev);
                    setShowEmotePicker(false);
                  }}
                  aria-expanded={showChatDrawer}
                  aria-label="Toggle room chat"
                  title="Room Chat & Quick Chat"
                  className={`relative inline-flex items-center justify-center gap-1.5 min-w-[42px] min-h-[42px] sm:min-w-[48px] sm:min-h-[48px] rounded-xl border px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    showChatDrawer
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                      : 'bg-[#1d140e]/88 hover:bg-[#2c1f16] text-amber-50 border-amber-100/20'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Chat</span>
                  {unreadChatCount > 0 && !showChatDrawer && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-[#d96b27] border border-amber-200 px-1 text-[10px] font-extrabold text-white flex items-center justify-center tabular-nums">
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Compact Quick Emotes Strip */}
              {showEmotePicker && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute bottom-[74px] sm:bottom-[88px] right-2 sm:right-5 z-20 max-w-[calc(100vw-1rem)] rounded-xl border border-amber-200/25 bg-[#1f150f]/95 p-2 sm:p-2.5 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 pb-1 mb-1.5 border-b border-amber-100/12">
                    <span className="text-[10.5px] sm:text-[11px] font-bold text-amber-200">
                      Express Emote
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEmotePicker(false)}
                      aria-label="Close emotes"
                      className="text-amber-100/70 hover:text-amber-50 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {EMOTE_DEFINITIONS.map((em) => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => handleSendEmote(em.id)}
                        className="flex flex-col items-center justify-center min-w-[46px] sm:min-w-[54px] min-h-[44px] sm:min-h-[50px] rounded-lg border border-amber-100/15 bg-[#150e0a] hover:bg-[#2a1c14] hover:border-amber-300/45 px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors cursor-pointer"
                      >
                        <span className="text-base sm:text-lg leading-none">{em.icon}</span>
                        <span className="mt-1 text-[9.5px] sm:text-[10px] font-semibold text-amber-100/90">
                          {em.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable In-Match Room Chat & Quick Chat Drawer */}
              {showChatDrawer && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute bottom-[74px] sm:bottom-[88px] right-2 sm:right-5 z-20 w-[calc(100vw-1rem)] max-w-[348px] max-h-[calc(100dvh-8.5rem)] overflow-y-auto rounded-2xl border border-amber-200/25 bg-[#1f150f]/96 p-2.5 sm:p-3.5 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-amber-100/12 pb-2">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare
                        className="w-4 h-4 text-amber-300"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-bold text-amber-50">
                        Room Chat ({onlineRoom.code})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowChatDrawer(false)}
                      aria-label="Close chat"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-amber-100/75 hover:bg-[#2c1f16] hover:text-amber-50 cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Quick Emotes Strip inside Chat Drawer */}
                  <div className="mt-2 flex items-center gap-1">
                    {EMOTE_DEFINITIONS.map((em) => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => handleSendEmote(em.id)}
                        title={em.label}
                        className="flex-1 inline-flex items-center justify-center gap-1 min-h-[34px] rounded-lg border border-amber-100/15 bg-[#150e0a] hover:bg-[#2b1d14] hover:border-amber-300/40 px-1.5 py-1 text-[11px] font-semibold text-amber-100 transition-colors cursor-pointer"
                      >
                        <span>{em.icon}</span>
                        <span className="hidden sm:inline">{em.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Live Message Feed (filtered by per-player Mute) */}
                  <div
                    ref={hudChatFeedRef}
                    className="mt-2 h-[146px] overflow-y-auto rounded-xl border border-amber-100/12 bg-[#140d09]/95 p-2.5 space-y-1.5 text-xs"
                  >
                    {chatMessages.filter((m) => !mutedPlayerIds[m.senderId])
                      .length === 0 ? (
                      <div className="text-[11px] text-amber-100/45 text-center py-8">
                        Say hello or use a quick chat below!
                      </div>
                    ) : (
                      chatMessages
                        .filter((m) => !mutedPlayerIds[m.senderId])
                        .map((msg) => {
                          const isMe = msg.senderId === localOnlinePlayerId;
                          const isReported = Boolean(
                            reportedPlayerIds[msg.senderId],
                          );
                          return (
                            <div
                              key={msg.id}
                              className="flex items-start justify-between gap-1.5 rounded-lg bg-[#1d140e]/85 px-2 py-1"
                            >
                              <div className="min-w-0 leading-snug break-words">
                                <span
                                  className={`font-bold ${
                                    msg.senderRole === 'seeker'
                                      ? 'text-orange-300'
                                      : isMe
                                        ? 'text-amber-300'
                                        : 'text-emerald-300'
                                  }`}
                                >
                                  {msg.senderName}
                                  {isMe ? ' (You)' : ''}:
                                </span>{' '}
                                <span
                                  className={
                                    msg.kind === 'emote'
                                      ? 'italic text-amber-200/90'
                                      : 'text-amber-50/95'
                                  }
                                >
                                  {msg.text}
                                </span>
                                {msg.wasFiltered && (
                                  <span className="ml-1 text-[9px] text-amber-200/50">
                                    (filtered)
                                  </span>
                                )}
                              </div>
                              {!isMe && (
                                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleMutePlayer(
                                        msg.senderId,
                                        msg.senderName,
                                      )
                                    }
                                    title={`Mute ${msg.senderName}`}
                                    aria-label={`Mute ${msg.senderName}`}
                                    className="text-amber-100/50 hover:text-amber-200 cursor-pointer"
                                  >
                                    <VolumeX
                                      className="w-3 h-3"
                                      aria-hidden="true"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isReported}
                                    onClick={() =>
                                      handleOpenReportModal(
                                        msg.senderId,
                                        msg.senderName,
                                      )
                                    }
                                    title={`Report ${msg.senderName}`}
                                    aria-label={`Report ${msg.senderName}`}
                                    className={
                                      isReported
                                        ? 'text-amber-100/25 cursor-not-allowed'
                                        : 'text-amber-100/50 hover:text-rose-300 cursor-pointer'
                                    }
                                  >
                                    <Flag
                                      className="w-3 h-3"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Quick Chat Presets */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {QUICK_CHAT_MESSAGES.map((qc) => (
                      <button
                        key={qc.id}
                        type="button"
                        onClick={() => handleSendChat(qc.text, true)}
                        className="rounded-lg border border-amber-100/15 bg-[#150e0a] hover:bg-[#2a1c14] hover:border-amber-300/40 px-2 py-1 text-[10px] font-semibold text-amber-100/90 transition-colors cursor-pointer"
                      >
                        {qc.text}
                      </button>
                    ))}
                  </div>

                  {/* Live Text Chat Composer */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="mt-2 flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) =>
                        setChatInput(e.target.value.slice(0, MAX_CHAT_LENGTH))
                      }
                      placeholder="Type a message..."
                      maxLength={MAX_CHAT_LENGTH}
                      className="flex-1 min-w-0 min-h-[36px] sm:min-h-[40px] rounded-lg border border-amber-100/20 bg-[#120b08] px-2.5 py-1.5 text-xs text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                    />
                    <button
                      type="submit"
                      aria-label="Send chat message"
                      className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] shrink-0 rounded-lg bg-[#d96b27] hover:bg-[#e57731] text-white transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Start Screen: Compact Single-Screen Mobile Layout + Split Desktop Showcase */}
      {hud.phase === 'start' && !hud.webglError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col lg:flex-row justify-between gap-2 lg:gap-4 p-2.5 sm:p-5 lg:p-6 overflow-hidden">
          {/* Top / Left Hero Header */}
          <div className="flex flex-col justify-between lg:max-w-[44%] shrink-0">
            <div className="min-w-0">
              <p className="hidden sm:block text-xs font-semibold tracking-wider text-amber-200 drop-shadow">
                1995 Indian Village Hide-and-Seek
              </p>
              <h1 className="font-display text-base sm:text-2xl lg:text-4xl font-bold tracking-tight text-amber-50 leading-tight whitespace-nowrap truncate drop-shadow-[0_2px_10px_rgba(20,12,6,0.75)]">
                Gully Chhupan Chhupai 1995
              </h1>
              <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-sm font-medium text-amber-100/90 truncate drop-shadow">
                Level {activeLevel.id} · {activeLevel.name} ({activeLevel.difficultyLabel})
              </p>
            </div>

            {/* Subtle character & level nameplate under the 3D showcase */}
            <div className="hidden lg:inline-flex flex-col self-start rounded-xl bg-[#1d140e]/82 border border-amber-200/20 px-4 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg font-bold text-amber-50">
                  {displayChosenName}
                </span>
                <span className="text-xs text-amber-300/90">
                  {selectedPreset.ageLabel} ·{' '}
                  {selectedPreset.ageGroup === 'child' ? 'Village Kid' : 'Village Teen'}
                </span>
              </div>
              <span className="text-xs text-amber-100/75">
                {chosenRole === 'seeker'
                  ? 'Wearing Seeker saffron bandana'
                  : selectedPreset.tagline}
              </span>
            </div>
          </div>

          {/* Right Level Selection, Character Customization, Audio & Online Panel */}
          <div className="pointer-events-auto flex flex-col flex-1 min-h-0 lg:flex-none w-full lg:w-[446px] lg:max-h-[calc(100dvh-2.5rem)] overflow-hidden rounded-xl sm:rounded-2xl border border-amber-200/25 bg-[#1e140e]/92 px-3 py-2.5 sm:px-5 sm:py-4 shadow-2xl">
            {/* Top Bar: Levels / Character / Online Switcher + Compact Mute Button */}
            <div className="flex items-center justify-between gap-1.5 pb-2 sm:pb-3 border-b border-amber-100/12 shrink-0">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setStartTab('levels')}
                  aria-pressed={startTab === 'levels'}
                  className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[40px] rounded-lg border px-1.5 sm:px-2 py-1 text-[10.5px] sm:text-xs font-bold whitespace-nowrap overflow-hidden transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    startTab === 'levels'
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                      : 'bg-[#150e0a]/80 text-amber-100/80 border-amber-100/15 hover:border-amber-200/35'
                  }`}
                >
                  <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    Levels ({hud.unlockedLevel}/{TOTAL_LEVELS})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setStartTab('character')}
                  aria-pressed={startTab === 'character'}
                  className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[40px] rounded-lg border px-1.5 sm:px-2 py-1 text-[10.5px] sm:text-xs font-bold whitespace-nowrap overflow-hidden transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    startTab === 'character'
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                      : 'bg-[#150e0a]/80 text-amber-100/80 border-amber-100/15 hover:border-amber-200/35'
                  }`}
                >
                  <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Character</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStartTab('online')}
                  aria-pressed={startTab === 'online'}
                  className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[40px] rounded-lg border px-1.5 sm:px-2 py-1 text-[10.5px] sm:text-xs font-bold whitespace-nowrap overflow-hidden transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    startTab === 'online'
                      ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                      : isInOnlineRoom
                        ? 'bg-emerald-950/75 text-emerald-200 border-emerald-400/45 hover:border-emerald-300'
                        : 'bg-[#150e0a]/80 text-amber-100/80 border-amber-100/15 hover:border-amber-200/35'
                  }`}
                >
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {isInOnlineRoom
                      ? `Room (${onlineRoom.players.length}/${MAX_ROOM_PLAYERS})`
                      : 'Online'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                title={hud.audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
                aria-label={hud.audioSettings.muted ? 'Unmute audio' : 'Mute audio'}
                className={`inline-flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg border shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                  hud.audioSettings.muted
                    ? 'bg-amber-500/25 text-amber-200 border-amber-300'
                    : 'bg-[#150e0a]/80 text-amber-100/85 border-amber-100/15 hover:border-amber-200/35'
                }`}
              >
                {hud.audioSettings.muted ? (
                  <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Scroll-safe Middle Tab Body (compact so all tabs fit inside 1 single screen) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5">
              {/* TAB 1: 8-Level Map Selection Screen */}
              {startTab === 'levels' && (
                <div className="mt-2 sm:mt-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5 sm:mb-2">
                    <span className="text-[11px] sm:text-xs font-semibold text-amber-200/90 whitespace-nowrap">
                      Select Playable Map
                    </span>
                    <span className="text-[9.5px] sm:text-[11px] text-amber-100/65 truncate">
                      Win a level to unlock next
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {LEVEL_CONFIGS.map((lvl) => {
                      const isUnlocked = lvl.id <= hud.unlockedLevel;
                      const isSelected = lvl.id === hud.currentLevelId;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => handleSelectLevel(lvl.id)}
                          aria-pressed={isSelected}
                          className={`flex flex-col items-start min-w-0 rounded-lg sm:rounded-xl border px-2 py-1.5 sm:px-2.5 sm:py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                            isSelected
                              ? 'bg-amber-500/22 border-amber-300 text-amber-50 cursor-pointer'
                              : isUnlocked
                                ? 'bg-[#150e0a]/85 border-amber-100/15 text-amber-100/90 hover:border-amber-200/40 cursor-pointer'
                                : 'bg-[#120c08]/70 border-amber-100/10 text-amber-100/45 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full gap-1 min-w-0">
                            <span className="text-[9.5px] sm:text-[11px] font-bold tracking-wide text-amber-300 whitespace-nowrap">
                              L{lvl.id}
                            </span>
                            {isUnlocked ? (
                              <span className="text-[9px] sm:text-[10px] font-semibold text-amber-100/75 truncate">
                                {lvl.difficultyLabel}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold text-amber-100/50 whitespace-nowrap">
                                <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" aria-hidden="true" />
                                Locked
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] sm:text-xs font-bold leading-tight text-amber-50 truncate w-full">
                            {lvl.name}
                          </div>
                          <div className="mt-0.5 text-[9px] sm:text-[10px] leading-tight text-amber-100/65 truncate sm:whitespace-normal sm:line-clamp-2 w-full">
                            {isUnlocked
                              ? lvl.hidingFeatures
                              : `Win L${lvl.id - 1} to unlock`}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Compact Selected Map Brief */}
                  <div className="mt-2 rounded-lg bg-[#150e0a]/85 border border-amber-100/12 px-2.5 py-1.5 text-[10px] sm:text-[11px] text-amber-100/80 leading-snug line-clamp-2">
                    <span className="font-semibold text-amber-200">
                      {activeLevel.name}:
                    </span>{' '}
                    {activeLevel.description}
                  </div>

                  {/* Start Screen Quick Audio Sliders */}
                  <div className="mt-2 grid grid-cols-2 gap-2.5 rounded-lg bg-[#150e0a]/75 border border-amber-100/12 px-2.5 py-1.5 text-[10px] sm:text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-amber-100/80">
                        <label htmlFor="start-music-vol">Music</label>
                        <span className="font-mono tabular-nums text-amber-300">
                          {Math.round(hud.audioSettings.musicVolume * 100)}%
                        </span>
                      </div>
                      <input
                        id="start-music-vol"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={hud.audioSettings.musicVolume}
                        onChange={(e) =>
                          handleAudioSettingChange({
                            musicVolume: parseFloat(e.target.value),
                            muted: false,
                          })
                        }
                        className="mt-0.5 w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-amber-100/80">
                        <label htmlFor="start-sfx-vol">Sound FX</label>
                        <span className="font-mono tabular-nums text-amber-300">
                          {Math.round(hud.audioSettings.sfxVolume * 100)}%
                        </span>
                      </div>
                      <input
                        id="start-sfx-vol"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={hud.audioSettings.sfxVolume}
                        onChange={(e) =>
                          handleAudioSettingChange({
                            sfxVolume: parseFloat(e.target.value),
                            muted: false,
                          })
                        }
                        className="mt-0.5 w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Start Screen Compact Graphics Quality Switcher */}
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#150e0a]/75 border border-amber-100/12 px-2.5 py-1.5 text-[10px] sm:text-[11px]">
                    <span className="font-semibold text-amber-100/85 whitespace-nowrap">
                      Graphics
                    </span>
                    <div className="grid grid-cols-3 gap-1 w-[156px] sm:w-[192px]">
                      {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
                        const active = hud.graphicsQuality === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleGraphicsQualityChange(opt.id)}
                            aria-pressed={active}
                            className={`min-h-[24px] sm:min-h-[26px] rounded-md border px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              active
                                ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                                : 'bg-[#1e140e] text-amber-100/75 border-amber-100/15 hover:border-amber-200/40'
                            }`}
                          >
                            <span className="sm:hidden">{opt.shortLabel}</span>
                            <span className="hidden sm:inline">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Character Selection & Customization */}
              {startTab === 'character' && (
                <div className="mt-2 sm:mt-3">
                  {/* 1. Character Name Input */}
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="character-name-input"
                      className="text-[11px] sm:text-xs font-semibold text-amber-200/90 shrink-0"
                    >
                      Character Name
                    </label>
                    <input
                      id="character-name-input"
                      type="text"
                      value={customization.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={selectedPreset.defaultName}
                      maxLength={16}
                      className="w-36 sm:w-48 min-w-0 rounded-lg border border-amber-100/20 bg-[#140d09]/90 px-2.5 py-1 text-xs sm:text-sm font-semibold text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                    />
                  </div>

                  {/* 2. 10 Village Children & Teenagers Selector Grid */}
                  <div className="mt-2.5 sm:mt-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <span className="text-[11px] sm:text-xs font-semibold text-amber-200/90 truncate">
                        Choose Character (10 Kids &amp; Teens)
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-amber-100/65 whitespace-nowrap shrink-0">
                        {selectedPreset.ageLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                      {VILLAGE_CHARACTER_PRESETS.map((preset) => {
                        const isSelected = customization.presetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectPreset(preset)}
                            aria-pressed={isSelected}
                            className={`flex flex-col items-center min-w-0 rounded-lg border px-0.5 py-1 sm:px-1.5 sm:py-1.5 text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              isSelected
                                ? 'bg-amber-500/22 border-amber-300 text-amber-50'
                                : 'bg-[#150e0a]/80 border-amber-100/12 text-amber-100/80 hover:border-amber-200/35'
                            }`}
                          >
                            <span
                              className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-amber-100/30 mb-0.5"
                              style={{ backgroundColor: preset.skinHex }}
                            >
                              <span
                                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-black/30 translate-y-1.5 sm:translate-y-2"
                                style={{ backgroundColor: preset.outfitColorHex }}
                              />
                            </span>
                            <span className="text-[9.5px] sm:text-[11px] font-semibold leading-tight truncate w-full">
                              {preset.defaultName}
                            </span>
                            <span className="text-[8px] sm:text-[9px] text-amber-100/60 leading-none mt-0.5">
                              {preset.ageGroup === 'child' ? 'Kid' : 'Teen'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Traditional 1990s Outfit Style */}
                  <div className="mt-2.5 sm:mt-3">
                    <div className="text-[11px] sm:text-xs font-semibold text-amber-200/90 mb-1">
                      1990s Outfit
                    </div>
                    <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                      {OUTFIT_STYLE_OPTIONS.map((opt) => {
                        const active = customization.outfitStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleOutfitStyleChange(opt.id)}
                            aria-pressed={active}
                            className={`min-w-0 rounded-lg border px-1 sm:px-2 py-1 sm:py-1.5 text-[9.5px] sm:text-[11px] font-semibold leading-tight whitespace-nowrap truncate transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              active
                                ? 'bg-amber-500 text-[#1d140e] border-amber-200'
                                : 'bg-[#150e0a]/80 text-amber-100/80 border-amber-100/15 hover:border-amber-200/35'
                            }`}
                          >
                            {opt.id === 'school_uniform' ? (
                              <>
                                <span className="sm:hidden">Uniform</span>
                                <span className="hidden sm:inline">{opt.label}</span>
                              </>
                            ) : opt.id === 'shirt_shorts' ? (
                              <>
                                <span className="sm:hidden">Shirt</span>
                                <span className="hidden sm:inline">{opt.label}</span>
                              </>
                            ) : (
                              opt.label
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Outfit Colour Swatches */}
                  <div className="mt-2.5">
                    <div className="text-[11px] sm:text-xs font-semibold text-amber-200/90 mb-1">
                      Outfit Colour
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      {OUTFIT_COLOR_SWATCHES.map((swatch) => {
                        const active = customization.outfitColor === swatch.color;
                        return (
                          <button
                            key={swatch.name}
                            type="button"
                            title={swatch.name}
                            aria-label={swatch.name}
                            aria-pressed={active}
                            onClick={() => handleOutfitColorChange(swatch.color)}
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              active
                                ? 'border-amber-200 scale-110 shadow-md'
                                : 'border-amber-100/25 hover:scale-105'
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* 5. Accessories */}
                  <div className="mt-2.5">
                    <div className="text-[11px] sm:text-xs font-semibold text-amber-200/90 mb-1">
                      Accessory
                    </div>
                    <div className="flex flex-wrap gap-1 sm:gap-1.5">
                      {ACCESSORY_OPTIONS.map((acc) => {
                        const active = customization.accessory === acc.id;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleAccessoryChange(acc.id)}
                            aria-pressed={active}
                            className={`rounded-lg border px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              active
                                ? 'bg-amber-500/25 text-amber-50 border-amber-300'
                                : 'bg-[#150e0a]/80 text-amber-100/75 border-amber-100/15 hover:border-amber-200/35'
                            }`}
                          >
                            {acc.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Real-Time Online Multiplayer Rooms (Up to 10 Real Players) */}
              {startTab === 'online' && (
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {roomError && (
                    <div className="rounded-lg border border-rose-400/40 bg-rose-950/75 px-2.5 py-1.5 text-[11px] font-medium text-rose-100">
                      {roomError}
                    </div>
                  )}

                  {!isInOnlineRoom ? (
                    <>
                      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-2.5 sm:p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] sm:text-xs font-bold text-amber-50">
                            Host a New Room
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-amber-300/90 font-semibold whitespace-nowrap">
                            Up to {MAX_ROOM_PLAYERS} Players
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] sm:text-[11px] text-amber-100/70 leading-snug">
                          Create a private room code to play live with friends across devices. Seeker rotates every round.
                        </p>
                        <button
                          type="button"
                          onClick={handleCreateRoom}
                          className="mt-2 sm:mt-3 w-full inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[44px] rounded-xl bg-[#d96b27] hover:bg-[#e57731] active:scale-[0.98] px-3 py-2 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
                        >
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">Create Room ({displayChosenName})</span>
                        </button>
                      </div>

                      <form
                        onSubmit={handleJoinRoom}
                        className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-2.5 sm:p-3.5"
                      >
                        <label
                          htmlFor="join-room-code-input"
                          className="block text-[11px] sm:text-xs font-bold text-amber-50"
                        >
                          Join Friend&apos;s Room
                        </label>
                        <p className="mt-0.5 text-[10px] sm:text-[11px] text-amber-100/70">
                          Enter the 6-character code shared by the host.
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <input
                            id="join-room-code-input"
                            type="text"
                            value={joinCodeInput}
                            onChange={(e) =>
                              setJoinCodeInput(
                                e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, '')
                                  .slice(0, 6),
                              )
                            }
                            placeholder="e.g. K7M9P2"
                            maxLength={6}
                            autoComplete="off"
                            className="flex-1 min-w-0 min-h-[38px] sm:min-h-[44px] rounded-lg border border-amber-100/20 bg-[#110b08] px-2.5 sm:px-3 py-1.5 font-mono text-xs sm:text-sm font-bold tracking-[0.14em] sm:tracking-[0.2em] uppercase text-amber-50 placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                          />
                          <button
                            type="submit"
                            className="min-h-[38px] sm:min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-[#1d140e] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-200"
                          >
                            Join Room
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      {/* Active Waiting Lobby Header with Room Code & Copy Controls */}
                      <div className="rounded-xl border border-amber-300/35 bg-[#150e0a]/90 p-2.5 sm:p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-amber-200/80">
                              Room Code
                            </div>
                            <div className="font-mono text-lg sm:text-2xl font-extrabold tracking-[0.18em] text-amber-300 leading-tight">
                              {onlineRoom.code}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyRoomText('code')}
                              className="inline-flex items-center gap-1 min-h-[34px] sm:min-h-[38px] rounded-lg border border-amber-100/20 bg-[#231811] hover:bg-[#312118] px-2 py-1 text-[11px] font-semibold text-amber-50 transition-colors cursor-pointer"
                            >
                              {copiedNotice === 'code' ? (
                                <Check className="w-3 h-3 text-emerald-300" aria-hidden="true" />
                              ) : (
                                <Copy className="w-3 h-3" aria-hidden="true" />
                              )}
                              <span>{copiedNotice === 'code' ? 'Copied' : 'Code'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyRoomText('link')}
                              className="inline-flex items-center gap-1 min-h-[34px] sm:min-h-[38px] rounded-lg border border-amber-100/20 bg-[#231811] hover:bg-[#312118] px-2 py-1 text-[11px] font-semibold text-amber-50 transition-colors cursor-pointer"
                            >
                              {copiedNotice === 'link' ? (
                                <Check className="w-3 h-3 text-emerald-300" aria-hidden="true" />
                              ) : (
                                <Link2 className="w-3 h-3" aria-hidden="true" />
                              )}
                              <span>{copiedNotice === 'link' ? 'Copied' : 'Invite'}</span>
                            </button>
                          </div>
                        </div>

                        {mpStatus === 'connecting' && (
                          <div className="mt-1 text-[10px] text-amber-300">
                            Reconnecting to room...
                          </div>
                        )}
                      </div>

                      {/* Waiting Lobby Joined Players Roster */}
                      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-2 sm:p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-bold text-amber-200 whitespace-nowrap">
                            Players ({onlineRoom.players.length}/{MAX_ROOM_PLAYERS})
                          </span>
                          {onlineNextSeeker && (
                            <span className="text-[10px] text-amber-300/90 font-medium truncate">
                              Next Seeker: {onlineNextSeeker.name}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 max-h-[84px] sm:max-h-[120px] overflow-y-auto pr-0.5">
                          {onlineRoom.players.map((p) => {
                            const preset = getPresetById(p.customization.presetId);
                            const isMe = p.id === localOnlinePlayerId;
                            const isNextSeeker = p.id === onlineRoom.nextSeekerId;
                            const isMuted = Boolean(mutedPlayerIds[p.id]);
                            const isReported = Boolean(reportedPlayerIds[p.id]);
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-1.5 rounded-lg border border-amber-100/10 bg-[#1e140e]/90 px-2 py-1 text-[11px]"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-amber-100/35 shrink-0"
                                    style={{ backgroundColor: preset.skinHex }}
                                  />
                                  <span className="font-semibold text-amber-50 truncate">
                                    {p.name}
                                    {isMe ? ' (You)' : ''}
                                  </span>
                                  {p.isHost && (
                                    <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-amber-300 shrink-0">
                                      <Crown className="w-2.5 h-2.5" aria-hidden="true" />
                                      Host
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[9.5px] font-semibold ${
                                      isNextSeeker
                                        ? 'text-orange-300'
                                        : 'text-amber-100/65'
                                    }`}
                                  >
                                    {isNextSeeker ? 'Seeker Next' : 'Hider'}
                                  </span>
                                  {!isMe && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleMutePlayer(p.id, p.name)
                                        }
                                        title={
                                          isMuted
                                            ? `Unmute ${p.name}`
                                            : `Mute ${p.name}`
                                        }
                                        aria-label={
                                          isMuted
                                            ? `Unmute ${p.name}`
                                            : `Mute ${p.name}`
                                        }
                                        aria-pressed={isMuted}
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors cursor-pointer ${
                                          isMuted
                                            ? 'bg-rose-900/70 border-rose-400/50 text-rose-200'
                                            : 'bg-[#140d09]/70 border-amber-100/15 text-amber-100/75 hover:text-amber-50'
                                        }`}
                                      >
                                        {isMuted ? (
                                          <VolumeX
                                            className="w-2.5 h-2.5"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <Volume2
                                            className="w-2.5 h-2.5"
                                            aria-hidden="true"
                                          />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isReported}
                                        onClick={() =>
                                          handleOpenReportModal(p.id, p.name)
                                        }
                                        title={
                                          isReported
                                            ? `Reported ${p.name}`
                                            : `Report ${p.name}`
                                        }
                                        aria-label={
                                          isReported
                                            ? `Reported ${p.name}`
                                            : `Report ${p.name}`
                                        }
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded border transition-colors ${
                                          isReported
                                            ? 'bg-[#140d09]/50 border-amber-100/10 text-amber-100/35 cursor-not-allowed'
                                            : 'bg-[#140d09]/70 border-amber-100/15 text-amber-100/75 hover:text-rose-200 hover:border-rose-400/45 cursor-pointer'
                                        }`}
                                      >
                                        <Flag
                                          className="w-2.5 h-2.5"
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Map Selection: Host picks from Unlocked Maps; Guests see synced map */}
                      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-2 sm:p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-bold text-amber-200 truncate">
                            {isOnlineHost
                              ? `Map (${hud.unlockedLevel}/${TOTAL_LEVELS} unlocked)`
                              : 'Selected Map'}
                          </span>
                          <span className="text-[10px] font-semibold text-amber-300 whitespace-nowrap">
                            L{onlineRoom.levelId} ·{' '}
                            {getLevelConfig(onlineRoom.levelId).shortName}
                          </span>
                        </div>

                        {isOnlineHost ? (
                          <div className="grid grid-cols-2 gap-1 max-h-[82px] sm:max-h-[116px] overflow-y-auto pr-0.5">
                            {LEVEL_CONFIGS.map((lvl) => {
                              const unlocked = lvl.id <= hud.unlockedLevel;
                              const selected = lvl.id === onlineRoom.levelId;
                              return (
                                <button
                                  key={lvl.id}
                                  type="button"
                                  disabled={!unlocked}
                                  onClick={() => handleHostSelectMap(lvl.id)}
                                  className={`flex items-center justify-between gap-1 min-w-0 rounded-md border px-2 py-1 text-left text-[10px] sm:text-[11px] font-semibold transition-colors ${
                                    selected
                                      ? 'bg-amber-500/25 border-amber-300 text-amber-50 cursor-pointer'
                                      : unlocked
                                        ? 'bg-[#1c130d] border-amber-100/15 text-amber-100/85 hover:border-amber-200/40 cursor-pointer'
                                        : 'bg-[#120c08] border-amber-100/8 text-amber-100/40 cursor-not-allowed'
                                  }`}
                                >
                                  <span className="truncate">
                                    {lvl.id}. {lvl.shortName}
                                  </span>
                                  {!unlocked && (
                                    <Lock className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-100/80 truncate">
                            {getLevelConfig(onlineRoom.levelId).name} —{' '}
                            <span className="text-amber-100/60">
                              {getLevelConfig(onlineRoom.levelId).description}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Waiting Lobby Live Chat, Quick Chat & Emotes */}
                      <div className="rounded-xl border border-amber-100/15 bg-[#150e0a]/85 p-2 sm:p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-200">
                            <MessageSquare
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                            <span>Room Chat &amp; Emotes</span>
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9.5px] text-amber-100/60">
                            <ShieldCheck
                              className="w-2.5 h-2.5 text-emerald-300"
                              aria-hidden="true"
                            />
                            Filtered
                          </span>
                        </div>

                        {/* Emote Triggers (also plays live on the 3D preview character!) */}
                        <div className="flex items-center gap-1 mb-1.5">
                          {EMOTE_DEFINITIONS.map((em) => (
                            <button
                              key={em.id}
                              type="button"
                              onClick={() => handleSendEmote(em.id)}
                              className="flex-1 min-w-0 inline-flex items-center justify-center gap-0.5 min-h-[28px] rounded-md border border-amber-100/15 bg-[#1d140e] hover:bg-[#2b1d14] hover:border-amber-300/40 px-1 py-0.5 text-[9.5px] sm:text-[10.5px] font-semibold text-amber-100 transition-colors cursor-pointer"
                            >
                              <span>{em.icon}</span>
                              <span className="truncate hidden sm:inline">{em.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Lobby Chat Feed */}
                        <div
                          ref={lobbyChatFeedRef}
                          className="h-[62px] sm:h-[88px] overflow-y-auto rounded-lg border border-amber-100/12 bg-[#100a07] p-1.5 space-y-1 text-[10.5px]"
                        >
                          {chatMessages.filter((m) => !mutedPlayerIds[m.senderId])
                            .length === 0 ? (
                            <div className="text-amber-100/40 text-center py-3">
                              Chat or tap an emote while waiting...
                            </div>
                          ) : (
                            chatMessages
                              .filter((m) => !mutedPlayerIds[m.senderId])
                              .map((msg) => {
                                const isMe = msg.senderId === localOnlinePlayerId;
                                const isReported = Boolean(
                                  reportedPlayerIds[msg.senderId],
                                );
                                return (
                                  <div
                                    key={msg.id}
                                    className="flex items-start justify-between gap-1.5 leading-snug"
                                  >
                                    <div className="min-w-0 break-words">
                                      <span
                                        className={`font-bold ${
                                          isMe
                                            ? 'text-amber-300'
                                            : 'text-emerald-300'
                                        }`}
                                      >
                                        {msg.senderName}
                                        {isMe ? ' (You)' : ''}:
                                      </span>{' '}
                                      <span
                                        className={
                                          msg.kind === 'emote'
                                            ? 'italic text-amber-200/90'
                                            : 'text-amber-50/90'
                                        }
                                      >
                                        {msg.text}
                                      </span>
                                      {msg.wasFiltered && (
                                        <span className="ml-1 text-[9px] text-amber-200/50">
                                          (filtered)
                                        </span>
                                      )}
                                    </div>
                                    {!isMe && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleMutePlayer(
                                              msg.senderId,
                                              msg.senderName,
                                            )
                                          }
                                          title={`Mute ${msg.senderName}`}
                                          aria-label={`Mute ${msg.senderName}`}
                                          className="text-amber-100/45 hover:text-amber-200 cursor-pointer"
                                        >
                                          <VolumeX
                                            className="w-2.5 h-2.5"
                                            aria-hidden="true"
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isReported}
                                          onClick={() =>
                                            handleOpenReportModal(
                                              msg.senderId,
                                              msg.senderName,
                                            )
                                          }
                                          title={`Report ${msg.senderName}`}
                                          aria-label={`Report ${msg.senderName}`}
                                          className={
                                            isReported
                                              ? 'text-amber-100/20 cursor-not-allowed'
                                              : 'text-amber-100/45 hover:text-rose-300 cursor-pointer'
                                          }
                                        >
                                          <Flag
                                            className="w-2.5 h-2.5"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                          )}
                        </div>

                        {/* Quick Chat Chips */}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {QUICK_CHAT_MESSAGES.slice(0, 4).map((qc) => (
                            <button
                              key={qc.id}
                              type="button"
                              onClick={() => handleSendChat(qc.text, true)}
                              className="rounded border border-amber-100/15 bg-[#1d140e] hover:bg-[#2a1c14] hover:border-amber-300/40 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-100/90 transition-colors cursor-pointer"
                            >
                              {qc.text}
                            </button>
                          ))}
                        </div>

                        {/* Lobby Chat Input */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendChat();
                          }}
                          className="mt-1.5 flex items-center gap-1.5 min-w-0"
                        >
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) =>
                              setChatInput(
                                e.target.value.slice(0, MAX_CHAT_LENGTH),
                              )
                            }
                            placeholder="Chat with room..."
                            maxLength={MAX_CHAT_LENGTH}
                            className="flex-1 min-w-0 min-h-[34px] rounded-lg border border-amber-100/20 bg-[#100a07] px-2.5 py-1 text-[11px] text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                          />
                          <button
                            type="submit"
                            aria-label="Send message"
                            className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] shrink-0 rounded-lg bg-[#d96b27] hover:bg-[#e57731] text-white transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </form>
                      </div>

                      {/* Lobby Actions: Start Game (Host) & Leave Room */}
                      <div className="space-y-1.5">
                        {isOnlineHost ? (
                          <button
                            type="button"
                            onClick={handleHostStartOnlineMatch}
                            disabled={
                              onlineRoom.players.length <
                              MIN_ONLINE_PLAYERS_TO_START
                            }
                            className={`w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
                              onlineRoom.players.length >=
                              MIN_ONLINE_PLAYERS_TO_START
                                ? 'bg-[#d96b27] hover:bg-[#e57731] active:scale-[0.98] text-white cursor-pointer'
                                : 'bg-[#2a1d15] text-amber-100/45 border border-amber-100/15 cursor-not-allowed'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              {onlineRoom.players.length >=
                              MIN_ONLINE_PLAYERS_TO_START
                                ? `Start Game (${onlineRoom.players.length} Players)`
                                : `Need ${MIN_ONLINE_PLAYERS_TO_START}+ Players to Start`}
                            </span>
                          </button>
                        ) : (
                          <div className="rounded-xl border border-amber-200/20 bg-[#150e0a]/85 px-3 py-2 text-center text-[11px] font-semibold text-amber-200">
                            Waiting for host to start the game...
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleLeaveOnlineRoom}
                          className="w-full inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-xl border border-amber-100/15 bg-[#150e0a]/80 hover:bg-[#2d1812] px-3 py-1.5 text-[11px] font-semibold text-amber-100/85 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Leave Room</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Pinned Solo Team Selection + Play Button (hidden while on Online tab or inside an Online Room) */}
            {startTab !== 'online' && !isInOnlineRoom && (
              <div className="mt-2 sm:mt-3 border-t border-amber-100/12 pt-2 sm:pt-3 shrink-0">
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setChosenRole('hider')}
                    aria-pressed={chosenRole === 'hider'}
                    className={`flex items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      chosenRole === 'hider'
                        ? 'bg-amber-500/20 border-amber-300 text-amber-50'
                        : 'bg-[#150e0a]/80 border-amber-100/15 text-amber-100/75 hover:border-amber-200/35'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs font-bold leading-tight">Hider</div>
                      <div className="text-[9.5px] sm:text-[10px] text-amber-100/70 truncate">12s hide · 3m</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChosenRole('seeker')}
                    aria-pressed={chosenRole === 'seeker'}
                    className={`flex items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg sm:rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      chosenRole === 'seeker'
                        ? 'bg-[#d96b27]/25 border-amber-300 text-amber-50'
                        : 'bg-[#150e0a]/80 border-amber-100/15 text-amber-100/75 hover:border-amber-200/35'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs font-bold leading-tight">Seeker</div>
                      <div className="text-[9.5px] sm:text-[10px] text-amber-100/70 truncate">Count 12s · Tag 4</div>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartMatch}
                  className="mt-2 sm:mt-3 w-full min-h-[40px] sm:min-h-[46px] rounded-xl bg-[#d96b27] hover:bg-[#e57731] active:scale-[0.98] px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold text-white truncate transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  Play Level {activeLevel.id}: {activeLevel.shortName} ({displayChosenName})
                </button>
              </div>
            )}

            {/* Quick button back to active room if player edited character while waiting */}
            {startTab !== 'online' && isInOnlineRoom && (
              <button
                type="button"
                onClick={() => setStartTab('online')}
                className="mt-2 sm:mt-3 shrink-0 w-full inline-flex items-center justify-center gap-2 min-h-[40px] sm:min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs sm:text-sm font-bold text-[#1d140e] transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Back to Room {onlineRoom.code} ({onlineRoom.players.length}/{MAX_ROOM_PLAYERS})
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Match Complete Overlay with Full Scoreboard & Next Level Progression */}
      {hud.phase === 'ended' && !hud.webglError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#18100a]/62 p-3 sm:p-5">
          <div className="w-full max-w-md max-h-[94dvh] overflow-y-auto rounded-2xl border border-amber-200/25 bg-[#201610]/96 px-4 py-4 sm:px-7 sm:py-6 text-center shadow-2xl">
            <p className="text-[11px] sm:text-xs font-semibold tracking-wider text-amber-300/90">
              Level {hud.currentLevelId} · {hud.levelName} ·{' '}
              {playerWon ? 'Victory' : 'Match Complete'}
            </p>
            <h2 className="font-display mt-0.5 text-xl sm:text-3xl font-bold text-amber-50 text-balance">
              {hud.winner === 'hiders' ? 'Hiders Win!' : 'Seekers Win!'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-amber-100/80">
              {hud.winner === 'hiders'
                ? `${hud.remainingHiders} ${hud.remainingHiders === 1 ? 'hider' : 'hiders'} survived until the 3-minute timer ran out.`
                : `All ${hud.totalHiders} hiders were caught with ${formatClock(hud.timeRemaining)} remaining.`}
            </p>

            {hud.newlyUnlockedLevel !== null && (
              <div className="mt-2.5 rounded-lg bg-emerald-950/75 border border-emerald-400/35 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-200">
                New Map Unlocked: Level {hud.newlyUnlockedLevel} —{' '}
                {getLevelConfig(hud.newlyUnlockedLevel).name}!
              </div>
            )}

            {/* End-of-Match Scoreboard */}
            <div className="mt-3 rounded-xl bg-[#160f0b]/85 border border-amber-100/12 p-3 sm:p-4 text-left text-[11px] sm:text-xs">
              <div className="flex items-center justify-between text-amber-200/90 font-semibold border-b border-amber-100/12 pb-1.5">
                <span>Match Scoreboard</span>
                <span className="tabular-nums">
                  {hud.caughtCount} Caught · {hud.remainingHiders} Survived
                </span>
              </div>

              <div className="mt-2 space-y-1 max-h-[120px] sm:max-h-[180px] overflow-y-auto pr-0.5">
                {hiders.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between text-amber-50/90"
                  >
                    <span className="truncate pr-2">
                      {h.name}
                      {h.isPlayer ? ' (You)' : ''}
                    </span>
                    <span
                      className={
                        h.caught
                          ? 'text-amber-300/80 font-medium tabular-nums shrink-0'
                          : 'text-emerald-300 font-medium shrink-0'
                      }
                    >
                      {h.caught
                        ? `Caught (${formatClock(h.caughtAtSeconds ?? 0)})`
                        : 'Survived'}
                    </span>
                  </div>
                ))}
              </div>

              {seeker && (
                <div className="mt-2.5 border-t border-amber-100/12 pt-2 flex items-center justify-between text-amber-100/80">
                  <span>
                    Seeker: {seeker.name}
                    {seeker.isPlayer ? ' (You)' : ''}
                  </span>
                  <span className="tabular-nums font-medium text-amber-200">
                    {hud.caughtCount}/{hud.totalHiders} tagged
                  </span>
                </div>
              )}
            </div>

            {isInOnlineRoom && (
              <div className="mt-3 rounded-xl border border-amber-100/15 bg-[#160f0b]/90 p-3 text-left">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold text-amber-200">
                    Post-Match Chat &amp; Emotes
                  </span>
                  <div className="flex items-center gap-1">
                    {EMOTE_DEFINITIONS.map((em) => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => handleSendEmote(em.id)}
                        title={em.label}
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-amber-100/15 bg-[#1e140e] hover:border-amber-300/45 text-sm cursor-pointer"
                      >
                        {em.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-[72px] overflow-y-auto space-y-1 text-[11px] text-amber-50/90 mb-2">
                  {chatMessages
                    .filter((m) => !mutedPlayerIds[m.senderId])
                    .slice(-6)
                    .map((msg) => (
                      <div key={msg.id} className="truncate">
                        <span className="font-bold text-amber-300">
                          {msg.senderName}:
                        </span>{' '}
                        <span>{msg.text}</span>
                      </div>
                    ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) =>
                      setChatInput(e.target.value.slice(0, MAX_CHAT_LENGTH))
                    }
                    placeholder="Say gg or chat..."
                    maxLength={MAX_CHAT_LENGTH}
                    className="flex-1 min-w-0 min-h-[34px] sm:min-h-[36px] rounded-lg border border-amber-100/20 bg-[#100a07] px-2.5 py-1 text-xs text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
                  />
                  <button
                    type="submit"
                    aria-label="Send post-match chat"
                    className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-[36px] sm:min-h-[36px] shrink-0 rounded-lg bg-[#d96b27] hover:bg-[#e57731] text-white cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}

            {isInOnlineRoom && onlineNextSeeker && (
              <div className="mt-2.5 rounded-lg border border-amber-300/30 bg-[#150e0a]/90 px-3 py-1.5 text-[11px] sm:text-xs text-amber-200">
                Seeker rotates next round to{' '}
                <span className="font-bold text-amber-50">
                  {onlineNextSeeker.name}
                </span>
                .
              </div>
            )}

            {isInOnlineRoom ? (
              <div className="mt-3 space-y-2">
                {isOnlineHost ? (
                  <>
                    <button
                      type="button"
                      onClick={handleHostStartOnlineMatch}
                      disabled={
                        onlineRoom.players.length < MIN_ONLINE_PLAYERS_TO_START
                      }
                      className={`w-full inline-flex items-center justify-center gap-2 min-h-[42px] sm:min-h-[48px] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-200 ${
                        onlineRoom.players.length >= MIN_ONLINE_PLAYERS_TO_START
                          ? 'bg-[#d96b27] hover:bg-[#e57731] active:scale-[0.98] text-white cursor-pointer'
                          : 'bg-[#2a1d15] text-amber-100/45 border border-amber-100/15 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Next Round (Rotate Seeker)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleHostReturnToLobby}
                        className="flex-1 inline-flex items-center justify-center min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#2c1e15] hover:bg-[#3a281d] border border-amber-100/20 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-amber-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Back to Lobby
                      </button>
                      <button
                        type="button"
                        onClick={handleLeaveOnlineRoom}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#2c1e15] hover:bg-[#3a1f18] border border-amber-100/20 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-amber-100/85 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Leave</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-amber-200/20 bg-[#150e0a]/85 px-3 py-2.5 text-[11px] sm:text-xs font-semibold text-amber-200">
                      Waiting for host to start the next round or return to lobby...
                    </div>
                    <button
                      type="button"
                      onClick={handleLeaveOnlineRoom}
                      className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[44px] rounded-xl bg-[#2c1e15] hover:bg-[#3a1f18] border border-amber-100/20 px-4 py-2 text-xs sm:text-sm font-semibold text-amber-50 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Leave Room</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {canPlayNextLevel && nextLevelConfig && (
                  <button
                    type="button"
                    onClick={handleNextLevel}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[42px] sm:min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-[#1d140e] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-200"
                  >
                    <span className="truncate">
                      Next Level: {nextLevelConfig.id}. {nextLevelConfig.name}
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                )}

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[46px] rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      canPlayNextLevel
                        ? 'bg-[#2c1e15] hover:bg-[#3a281d] border border-amber-100/20 text-amber-50'
                        : 'bg-[#d96b27] hover:bg-[#e57731] text-white'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true" />
                    <span>Play Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwapSoloRole}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[46px] rounded-xl bg-[#2c1e15] hover:bg-[#3a281d] border border-amber-100/20 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-amber-100 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    <span>
                      {hud.playerRole === 'hider'
                        ? 'Play as Seeker'
                        : 'Play as Hider'}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchTeam}
                  className="mt-2 w-full inline-flex items-center justify-center min-h-[38px] sm:min-h-[42px] rounded-xl bg-[#18100b] hover:bg-[#2a1d15] border border-amber-100/15 px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-amber-100/85 transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  Levels &amp; Setup
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Report Player Modal */}
      {reportTarget && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 flex items-center justify-center bg-[#140d09]/75 p-3 sm:p-5"
        >
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-2xl border border-amber-200/25 bg-[#1f150f] p-4 sm:p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-amber-100/12 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Flag className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
                <h2 className="font-display text-base sm:text-lg font-bold text-amber-50 truncate">
                  Report {reportTarget.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                aria-label="Close report dialog"
                className="text-amber-100/70 hover:text-amber-50 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-2 text-[11px] sm:text-xs text-amber-100/75">
              Help keep Gully Chhupan Chhupai 1995 friendly for everyone. Select a reason:
            </p>

            <div className="mt-2 space-y-1.5">
              {REPORT_REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium cursor-pointer transition-colors ${
                    reportReason === opt.id
                      ? 'bg-amber-500/20 border-amber-300 text-amber-50'
                      : 'bg-[#150e0a] border-amber-100/15 text-amber-100/80 hover:border-amber-200/35'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={opt.id}
                    checked={reportReason === opt.id}
                    onChange={() => setReportReason(opt.id)}
                    className="accent-amber-400"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-2.5">
              <label
                htmlFor="report-details-input"
                className="block text-[10.5px] sm:text-[11px] font-semibold text-amber-200/85 mb-1"
              >
                Optional note
              </label>
              <input
                id="report-details-input"
                type="text"
                value={reportDetails}
                onChange={(e) =>
                  setReportDetails(
                    e.target.value.slice(0, MAX_REPORT_DETAILS_LENGTH),
                  )
                }
                placeholder="Describe what happened..."
                maxLength={MAX_REPORT_DETAILS_LENGTH}
                className="w-full min-h-[36px] sm:min-h-[40px] rounded-lg border border-amber-100/20 bg-[#120b08] px-3 py-1.5 text-xs text-amber-50 placeholder:text-amber-100/35 focus:border-amber-300 focus:outline-none select-text"
              />
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="flex-1 min-h-[40px] sm:min-h-[44px] rounded-xl border border-amber-100/20 bg-[#2c1e15] hover:bg-[#3a281d] px-4 py-2 text-xs font-semibold text-amber-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[40px] sm:min-h-[44px] rounded-xl bg-rose-700 hover:bg-rose-600 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transient Safety / Mute / Report Confirmation Notice */}
      {safetyNotice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1rem)] truncate rounded-xl border border-amber-300/40 bg-[#1f150f]/95 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-amber-100 shadow-xl">
          {safetyNotice}
        </div>
      )}
    </div>
  );
}
