import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Armchair,
  Award,
  Backpack,
  Bell,
  BellRing,
  Calculator,
  ChevronLeft,
  ChevronUp,
  Coins,
  Crown,
  Dices,
  Disc3,
  Flag,
  Gamepad2,
  Gift,
  Heart,
  LayoutGrid,
  ListMusic,
  Lock,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  Palette,
  Pause,
  Play,
  Radio,
  Repeat,
  Send,
  Settings,
  Share2,
  Shield,
  SkipBack,
  SkipForward,
  Smile,
  Sparkles,
  Star,
  Swords,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GAME_FOODIE_ICON_PATH, GAME_FRUIT_ICON_PATH, ROOM_GIFTS } from '../data/seedData';
import { GiftCategory, UserAccount } from '../types';
import { formatCompactNumber, formatFullGold } from '../utils/format';
import { getLevelProgress } from '../utils/leveling';
import { LuckyGameKind, LuckyGamesModal } from './LuckyGamesModal';
import { RoomControlSheet, RoomSettingsModal } from './RoomSettingsModal';
import { RoomEngagementCard } from './RoomEngagementCard';
import { ActiveHostsPanel } from './ActiveHostsPanel';
import { InviteFriendsModal } from './InviteFriendsModal';

const GIFT_CATEGORIES: GiftCategory[] = ['هدية', 'النشاط', 'العشاق', 'مكافأة', 'شرف', 'SVIP'];
const GIFT_QUANTITIES = [1, 5, 10, 99];
const WEALTH_CRESTS: Array<{ label: string; minHeat: number }> = [
  { label: '50M', minHeat: 50_000_000 },
  { label: '100M', minHeat: 100_000_000 },
  { label: '200M', minHeat: 200_000_000 },
  { label: '300M', minHeat: 300_000_000 },
  { label: '500M', minHeat: 500_000_000 },
  { label: '1000M', minHeat: 1_000_000_000 },
  { label: '2000M', minHeat: 2_000_000_000 },
  { label: '5000M', minHeat: 5_000_000_000 },
];

const MUSIC_TRACKS = [
  { id: 't1', title: 'اغنية هندية مشهورة - تيري ميري', durationSec: 318 },
  { id: 't2', title: 'شيلة رياض الملكية - عز وفخر', durationSec: 264 },
  { id: 't3', title: 'جلسة طرب خليجية - عود ووتر', durationSec: 295 },
];

const QUICK_EMOJIS = ['👑', '🔥', '❤️', '👏', '🎉', '💎', '🌹', '😂'];
const AUTO_SLEEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without voice activity
const AUTO_SLEEP_WARNING_MS = 10 * 1000; // Show pre-sleep hint in final 10s

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LiveRoomView: React.FC = () => {
  const {
    state,
    activeRoomId,
    setActiveRoomId,
    minimizeRoom,
    setActiveTab,
    openWallet,
    currentUser,
    isApprovedAgent,
    activeGiftAnimation,
    dismissGiftAnimation,
    toggleSeatInRoom,
    toggleMuteSeat,
    sendSpeakingState,
    sendRoomMessage,
    clearRoomMessages,
    sendRoomGift,
    triggerIncomingGiftForMe,
    triggerRoyalDragon,
    boostRoomHeat,
    adjustUserGold,
    updateRoomSettings,
    followedRoomIds,
    toggleFollowRoom,
    startRoomLiveBroadcast,
    stopRoomLiveBroadcast,
    showToast,
  } = useApp();

  const [chatFilter, setChatFilter] = useState<'all' | 'chat'>('all');
  const [liveTopicOpen, setLiveTopicOpen] = useState(false);
  const [liveTopicInput, setLiveTopicInput] = useState('');
  const [liveActionBusy, setLiveActionBusy] = useState(false);
  const [chatComposerOpen, setChatComposerOpen] = useState(false);
  const [emojiBarOpen, setEmojiBarOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Sheets & Overlays
  const [giftDrawerOpen, setGiftDrawerOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeGiftCategory, setActiveGiftCategory] = useState<GiftCategory>('هدية');
  const [selectedGiftId, setSelectedGiftId] = useState<string>(ROOM_GIFTS[3]?.id || ROOM_GIFTS[0].id);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [giftQuantity, setGiftQuantity] = useState<number>(1);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState('1000');

  // Music Player Overlay (Screenshot 6)
  const [musicOpen, setMusicOpen] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isFavoriteTrack, setIsFavoriteTrack] = useState(false);
  const [musicElapsed, setMusicElapsed] = useState(0);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  // User Profile Card Popup (Screenshot 9)
  const [inspectedUser, setInspectedUser] = useState<UserAccount | null>(null);

  // In-Room Lucky Games Drawer, Room Control Sheets & Floating Emoji
  const [luckyGamesOpen, setLuckyGamesOpen] = useState(false);
  const [luckyGameMode, setLuckyGameMode] = useState<LuckyGameKind>('launcher');
  const [controlSheet, setControlSheet] = useState<RoomControlSheet>('none');
  const [roomInsightDrawer, setRoomInsightDrawer] = useState<'none' | 'engagement' | 'hosts'>('none');
  const [floatingEmoji, setFloatingEmoji] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState(true);
  const [entryBannerVisible, setEntryBannerVisible] = useState(false);

  // Auto-Sleep Battery-Saving Mode (after 5 minutes of no voice activity)
  const [isSleepMode, setIsSleepMode] = useState(false);
  const [sleepCountdownSec, setSleepCountdownSec] = useState<number | null>(null);
  const [silenceSeconds, setSilenceSeconds] = useState(0);
  const lastVoiceActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    setJoiningRoom(true);
    setEntryBannerVisible(false);
    lastVoiceActivityRef.current = Date.now();
    setIsSleepMode(false);
    setSleepCountdownSec(null);
    setSilenceSeconds(0);
    const id = window.setTimeout(() => {
      setJoiningRoom(false);
      setEntryBannerVisible(true);
    }, 550);
    const hideEntryId = window.setTimeout(() => {
      setEntryBannerVisible(false);
    }, 3800);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(hideEntryId);
    };
  }, [activeRoomId]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const room = state.rooms.find((r) => r.id === activeRoomId);
  const mySeat = room?.seats.find((s) => s.userId === currentUser.id);
  const mySeatNumber = mySeat?.seatNumber ?? null;
  const mySeatActiveUnmuted = Boolean(mySeat && !mySeat.isMuted);

  const [micLevel, setMicLevel] = useState(0);
  const [micStatus, setMicStatus] = useState<'idle' | 'active' | 'denied'>('idle');
  const lastSpeakingSentRef = useRef<{ ts: number; speaking: boolean }>({
    ts: 0,
    speaking: false,
  });

  const wakeFromSleep = useCallback(
    (showFeedback = false) => {
      lastVoiceActivityRef.current = Date.now();
      setSleepCountdownSec(null);
      setSilenceSeconds(0);
      setIsSleepMode((prev) => {
        if (prev && showFeedback) {
          showToast('تم إيقاظ شاشة الغرفة واستعادة الإضاءة الكاملة', 'info');
        }
        return false;
      });
    },
    [showToast]
  );

  const triggerManualSleep = useCallback(() => {
    lastVoiceActivityRef.current = Date.now() - AUTO_SLEEP_TIMEOUT_MS;
    setSilenceSeconds(Math.floor(AUTO_SLEEP_TIMEOUT_MS / 1000));
    setSleepCountdownSec(null);
    setIsSleepMode(true);
  }, []);

  // Real browser microphone capture & WebSocket speech-level sync
  useEffect(() => {
    if (!room || mySeatNumber === null || !mySeatActiveUnmuted) {
      setMicLevel(0);
      setMicStatus('idle');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let rafId = 0;

    const startMic = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMicStatus('active');

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;

        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(dataArray);
          let sumSq = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const norm = (dataArray[i] - 128) / 128;
            sumSq += norm * norm;
          }
          const rms = Math.sqrt(sumSq / dataArray.length);
          const scaled = Math.min(1, rms * 6);
          setMicLevel(scaled);

          const isSpeech = rms > 0.025;
          const now = Date.now();
          if (
            lastSpeakingSentRef.current.speaking !== isSpeech ||
            now - lastSpeakingSentRef.current.ts >= 250
          ) {
            if (lastSpeakingSentRef.current.speaking !== isSpeech || isSpeech) {
              lastSpeakingSentRef.current = { ts: now, speaking: isSpeech };
              sendSpeakingState(room.id, mySeatNumber, isSpeech);
            }
          }
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setMicStatus('denied');
          showToast('تعذر تفعيل الميكروفون من المتصفح — تعمل المزامنة النصية والصوتية عبر المقعد', 'warning');
        }
      }
    };

    void startMic();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      setMicLevel(0);
      sendSpeakingState(room.id, mySeatNumber, false);
    };
  }, [room?.id, mySeatNumber, mySeatActiveUnmuted, sendSpeakingState, showToast]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [room?.messages.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const activeTrack = MUSIC_TRACKS[trackIndex];
    const id = window.setInterval(() => {
      setMusicElapsed((prev) => {
        if (prev + 1 >= activeTrack.durationSec) {
          if (isRepeat) return 0;
          setTrackIndex((idx) => (idx + 1) % MUSIC_TRACKS.length);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPlaying, trackIndex, isRepeat]);

  const hasOtherSpeakingSeat = Boolean(
    room?.seats.some((s) => Boolean(s.userId) && !s.isMuted && s.isSpeaking)
  );
  const isLocalVoiceActive = mySeatActiveUnmuted && micLevel > 0.08;
  const hasLiveVoiceActivity = Boolean(isLocalVoiceActive || hasOtherSpeakingSeat || isPlaying);

  useEffect(() => {
    if (!room) return;
    if (hasLiveVoiceActivity) {
      lastVoiceActivityRef.current = Date.now();
      setSleepCountdownSec(null);
      setSilenceSeconds(0);
      if (isSleepMode) {
        setIsSleepMode(false);
      }
    }
  }, [room?.id, hasLiveVoiceActivity, isSleepMode]);

  useEffect(() => {
    if (!room || room.autoSleepEnabled === false) {
      setSleepCountdownSec(null);
      if (isSleepMode) setIsSleepMode(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (hasLiveVoiceActivity) {
        lastVoiceActivityRef.current = Date.now();
        setSleepCountdownSec(null);
        setSilenceSeconds(0);
        return;
      }

      const elapsedMs = Date.now() - lastVoiceActivityRef.current;
      setSilenceSeconds(Math.floor(elapsedMs / 1000));

      if (isSleepMode) {
        setSleepCountdownSec(null);
        return;
      }

      const remainingMs = AUTO_SLEEP_TIMEOUT_MS - elapsedMs;
      if (remainingMs <= 0) {
        setSleepCountdownSec(null);
        setIsSleepMode(true);
      } else if (remainingMs <= AUTO_SLEEP_WARNING_MS) {
        setSleepCountdownSec(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setSleepCountdownSec(null);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [room?.id, room?.autoSleepEnabled, hasLiveVoiceActivity, isSleepMode]);

  if (!room) {
    return (
      <div className="rounded-3xl bg-[#0B041D] border border-violet-500/35 p-8 text-center space-y-3 text-white">
        <p className="text-sm font-semibold">الغرفة غير متوفرة حالياً</p>
        <button
          type="button"
          onClick={() => setActiveRoomId(null)}
          className="px-5 py-2.5 rounded-full bg-gradient-to-l from-violet-600 to-blue-500 text-white text-xs font-bold cursor-pointer"
        >
          العودة إلى قائمة الغرف
        </button>
      </div>
    );
  }

  const occupiedSpeakers = room.seats.filter((s) => s.userId !== null);
  const recipientCandidates = Array.from(
    new Map(
      [
        { id: room.ownerId, name: room.ownerName, avatar: room.ownerAvatar },
        ...occupiedSpeakers
          .filter((s) => s.userId && s.userName && s.avatar)
          .map((s) => ({
            id: s.userId as string,
            name: s.userName as string,
            avatar: s.avatar as string,
          })),
      ].map((u) => [u.id, u])
    ).values()
  );

  const effectiveRecipientId =
    recipientCandidates.find((c) => c.id === selectedRecipientId)?.id ||
    recipientCandidates[0]?.id ||
    room.ownerId;

  const levelProgress = getLevelProgress(currentUser.level, currentUser.xp);
  const roomGiftAnim =
    activeGiftAnimation && activeGiftAnimation.roomId === room.id ? activeGiftAnimation : null;

  const filteredMessages =
    chatFilter === 'chat'
      ? room.messages.filter((m) => m.type === 'chat' || m.type === 'achievement')
      : room.messages;

  const activeCategoryGifts = ROOM_GIFTS.filter(
    (g) => !g.category || g.category === activeGiftCategory || activeGiftCategory === 'هدية'
  );
  const chosenGift =
    ROOM_GIFTS.find((g) => g.id === selectedGiftId) ||
    activeCategoryGifts[0] ||
    ROOM_GIFTS[0];

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendRoomMessage(room.id, chatInput);
    setChatInput('');
  };

  const handleSeatClick = (seat: typeof room.seats[number]) => {
    if (seat.userId) {
      const foundUser =
        state.users.find((u) => u.id === seat.userId) || {
          id: seat.userId,
          name: seat.userName || 'عضو الغرفة',
          avatar: seat.avatar || room.ownerAvatar,
          role: 'USER',
          flag: room.flag,
          country: room.country,
          level: 1,
          xp: 0,
          svip: 0,
          aristocratTier: null,
          gold: 0,
          diamonds: 0,
          charisma: 0,
          giftedGold: 0,
          followers: 0,
          following: 0,
          visitors: 0,
          title: 'عضو جديد',
          ownedEntries: [],
        };
      setInspectedUser(foundUser);
      return;
    }
    toggleSeatInRoom(room.id, seat.seatNumber);
  };

  const handleToolAction = (toolId: string) => {
    setToolsOpen(false);
    switch (toolId) {
      case 'music':
        setMusicOpen(true);
        break;
      case 'clean':
        clearRoomMessages(room.id);
        break;
      case 'calc':
        setCalculatorOpen(true);
        break;
      case 'fruit':
        setLuckyGameMode('fruit');
        setLuckyGamesOpen(true);
        break;
      case 'wheel':
        setLuckyGameMode('foodie');
        setLuckyGamesOpen(true);
        break;
      case 'agency':
        if (!isApprovedAgent) {
          showToast('🚫 بوابة الوكالة متاحة فقط بعد اعتماد طلبك من المالك (ID: 900)', 'error');
          break;
        }
        minimizeRoom();
        setActiveTab('agencies');
        break;
      case 'pk':
      case 'pk-room':
        boostRoomHeat(room.id, 2_500_000);
        sendRoomMessage(room.id, '⚔️ انطلقت جولة تحدي PK حماسية في الغرفة! (+2.5M حرارة)');
        break;
      case 'broadcast':
        void startRoomLiveBroadcast(room.id, `بث مباشر مع ${currentUser.name}`);
        break;
      case 'treasure':
        adjustUserGold(currentUser.id, 25_000);
        sendRoomMessage(room.id, '🎁 فتح صندوق كنز الغرفة (+25,000 ذهب للمحظوظين!)');
        showToast('تم فتح كنز الغرفة وإضافة +25,000 ذهب!', 'success');
        break;
      case 'gather':
        sendRoomMessage(room.id, '📣 تم إرسال نداء تجمع للأصدقاء للانضمام إلى الغرفة الآن!');
        showToast('تم إرسال دعوة تجمع للأصدقاء والمتابعين للانضمام للغرفة', 'info');
        break;
      case 'dice': {
        const count = Math.min(3, Math.max(1, room.diceCount ?? 1));
        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
        const total = rolls.reduce((a, b) => a + b, 0);
        const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const visual = rolls.map((r) => diceFaces[r - 1]).join(' ');
        sendRoomMessage(room.id, `🎲 رمى ${count} نرد: ${visual} (المجموع: ${total})`);
        break;
      }
      case 'room-settings':
        setControlSheet('quick-menu');
        break;
      case 'themes':
        setControlSheet('themes');
        break;
      case 'mics':
        setControlSheet('mics');
        break;
      case 'wallet':
        openWallet('gold');
        break;
      case 'sleep':
        triggerManualSleep();
        break;
      default:
        break;
    }
  };

  const activeTrack = MUSIC_TRACKS[trackIndex];
  const activeTheme = room.themeId || 'ocean-stars';

  return (
    <div
      onPointerDown={() => {
        if (!isSleepMode) {
          lastVoiceActivityRef.current = Date.now();
          setSleepCountdownSec(null);
          setSilenceSeconds(0);
        }
      }}
      className={`relative h-[100dvh] sm:h-auto sm:min-h-[820px] rounded-none sm:rounded-3xl text-white overflow-hidden flex flex-col justify-between shadow-2xl border ${
        isSleepMode ? 'room-sleep-mode' : ''
      } ${
        activeTheme === 'ocean-stars'
          ? 'bg-[#03145C] border-sky-400/30'
          : activeTheme === 'ramadan-green'
          ? 'bg-[#032612] border-emerald-400/30'
          : activeTheme === 'royal-gold'
          ? 'bg-[#170C02] border-amber-400/30'
          : 'bg-[#05010E] border-violet-500/25'
      }`}
    >
      {/* Dynamic Room Theme Background */}
      {activeTheme === 'ocean-stars' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_#03145C_0%,_#04269E_40%,_#035CD4_64%,_#08B2F0_82%,_#01237A_100%)]" />
          {/* Twinkling Night Sky Stars */}
          <div className="absolute inset-x-0 top-0 h-[55%] opacity-60 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute inset-x-0 top-3 h-[48%] opacity-35 bg-[radial-gradient(#bae6fd_1.5px,transparent_1.5px)] [background-size:44px_44px]" />
          {/* Glowing Turquoise Ocean Wave Crest */}
          <svg
            viewBox="0 0 400 220"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-14 w-full h-[46%] opacity-85"
          >
            <defs>
              <linearGradient id="oceanWaveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.65" />
                <stop offset="35%" stopColor="#0284C7" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#021D6E" stopOpacity="0.92" />
              </linearGradient>
            </defs>
            <path
              d="M0,78 C70,42 150,95 235,62 C305,34 360,55 400,40 L400,220 L0,220 Z"
              fill="url(#oceanWaveGrad)"
            />
            <path
              d="M0,122 C85,90 165,140 265,108 C330,88 370,104 400,96 L400,220 L0,220 Z"
              fill="#00B4FF"
              fillOpacity="0.22"
            />
          </svg>
        </div>
      )}
      {activeTheme === 'cosmic-purple' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,_rgba(124,58,237,0.52)_0%,_rgba(88,28,135,0.28)_44%,_#05010E_74%)]"
        />
      )}
      {activeTheme === 'ramadan-green' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_#032812_0%,_#086D2B_55%,_#023E19_100%)]"
        >
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#fde68a_1.2px,transparent_1.2px)] [background-size:26px_26px]" />
        </div>
      )}
      {activeTheme === 'royal-gold' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,_rgba(245,158,11,0.36)_0%,_rgba(120,53,15,0.28)_45%,_#120802_82%)]"
        />
      )}

      {/* TOP HEADER */}
      <header className="room-sleep-stage relative z-20 px-3 pt-2 sm:pt-3 pb-1 sm:pb-1.5 space-y-1 sm:space-y-1.5 bg-gradient-to-b from-black/45 to-transparent shrink-0">
        <div className="flex items-start justify-between gap-2">
          {/* Right side (RTL): Owner/Cover photo + Title + ID & Wealth Badges */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-11 h-11 rounded-xl p-[2px] overflow-hidden shrink-0 shadow-[0_0_14px_rgba(168,85,247,0.48)]">
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <img
                src={room.coverImage || room.ownerAvatar}
                alt={room.ownerName}
                referrerPolicy="no-referrer"
                className="relative z-10 w-full h-full rounded-[10px] object-cover"
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-display font-extrabold text-amber-200 truncate max-w-[155px] sm:max-w-xs">
                  {room.title}
                </h1>
                <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-l from-rose-700 to-red-600 border border-amber-300/60 text-amber-200 text-[9px] font-bold flex items-center gap-1 shrink-0">
                  <Crown className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                  <span>VII رياض</span>
                </span>
              </div>

              {/* Wealth Badge + ID */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <span className="text-[11px] font-mono-num font-extrabold text-sky-200 shrink-0">
                  ID:{room.ownerId}
                </span>
                {WEALTH_CRESTS.filter((crest) => room.heat >= crest.minHeat).map((crest, idx) => (
                  <span
                    key={crest.label}
                    className={`px-1.5 py-0.5 rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-[#2E1300] text-[8.5px] font-mono-num font-black border border-yellow-200/80 shadow-xs shrink-0 ${
                      idx === 0 ? 'inline-flex' : 'hidden sm:inline-flex'
                    }`}
                  >
                    {crest.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Left side (RTL): Live Broadcast / Follow Bell, Share Invite Link, Settings, Minimize ^ & Exit X */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(room.ownerId === currentUser.id ||
              currentUser.id === '900' ||
              room.seats.some((s) => s.userId === currentUser.id)) && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLiveTopicOpen((o) => !o)}
                  aria-label={room.isLive ? 'إدارة البث المباشر' : 'بدء بث مباشر وإشعار المتابعين'}
                  title={
                    room.isLive
                      ? 'البث المباشر نشط — اضغط للإرسال أو الإيقاف'
                      : 'بدء بث مباشر وإشعار المتابعين الآن'
                  }
                  className={`h-8 px-2.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                    room.isLive
                      ? 'bg-rose-600/95 hover:bg-rose-500 border-rose-300/70 text-white shadow-[0_0_12px_rgba(244,63,94,0.45)]'
                      : 'bg-emerald-500/95 hover:bg-emerald-400 border-emerald-200/70 text-slate-950'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">
                    {room.isLive ? 'بث مباشر' : 'ابدأ البث'}
                  </span>
                </button>

                {liveTopicOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setLiveTopicOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#120D2E] border border-violet-400/50 p-3.5 shadow-2xl z-50 space-y-2.5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-display font-extrabold flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-rose-400" />
                          <span>إشعار البث المباشر</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setLiveTopicOpen(false)}
                          className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        أرسل إشعاراً فورياً داخل التطبيق لجميع متابعي الغرفة ومهتمي الغرف الشائعة.
                      </p>
                      <input
                        type="text"
                        value={liveTopicInput}
                        onChange={(e) => setLiveTopicInput(e.target.value)}
                        maxLength={85}
                        placeholder="عنوان البث (اختياري): سهرة طرب ومسابقات..."
                        className="w-full h-9 px-3 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-400"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={liveActionBusy}
                          onClick={async () => {
                            setLiveActionBusy(true);
                            try {
                              await startRoomLiveBroadcast(room.id, liveTopicInput.trim());
                              setLiveTopicInput('');
                              setLiveTopicOpen(false);
                            } finally {
                              setLiveActionBusy(false);
                            }
                          }}
                          className="flex-1 min-h-[38px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-extrabold cursor-pointer"
                        >
                          {liveActionBusy
                            ? 'جارٍ الإرسال...'
                            : room.isLive
                            ? 'تحديث وإرسال إشعار البث'
                            : 'بدء البث وإشعار المتابعين'}
                        </button>
                        {room.isLive &&
                          (room.ownerId === currentUser.id || currentUser.id === '900') && (
                            <button
                              type="button"
                              disabled={liveActionBusy}
                              onClick={async () => {
                                setLiveActionBusy(true);
                                try {
                                  await stopRoomLiveBroadcast(room.id);
                                  setLiveTopicOpen(false);
                                } finally {
                                  setLiveActionBusy(false);
                                }
                              }}
                              className="min-h-[38px] px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-bold cursor-pointer"
                            >
                              إيقاف
                            </button>
                          )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {room.ownerId !== currentUser.id && (
              <button
                type="button"
                onClick={() => void toggleFollowRoom(room.id)}
                aria-label={
                  followedRoomIds.includes(room.id)
                    ? 'إلغاء متابعة الغرفة'
                    : 'متابعة الغرفة لتلقي إشعارات البث المباشر'
                }
                title={
                  followedRoomIds.includes(room.id)
                    ? 'تتابع هذه الغرفة · تصلك تنبيهات البث'
                    : 'متابعة الغرفة لتصلك تنبيهات البث المباشر'
                }
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  followedRoomIds.includes(room.id)
                    ? 'bg-emerald-500/90 border-emerald-200/80 text-slate-950'
                    : 'bg-[#1E293B] hover:bg-violet-600/80 border-white/25 text-white'
                }`}
              >
                {followedRoomIds.includes(room.id) ? (
                  <BellRing className="w-3.5 h-3.5" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              aria-label="دعوة الأصدقاء للغرفة"
              title="إنشاء ومشاركة رابط دعوة للغرفة"
              className="group relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(56,189,248,0.4)] transition-transform active:scale-95"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#1E293B] group-hover:bg-sky-600/80 text-sky-200 group-hover:text-white flex items-center justify-center transition-colors">
                <Share2 className="w-3.5 h-3.5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setControlSheet('quick-menu')}
              aria-label="قائمة وإعدادات الغرفة"
              title="قائمة الغرفة والإعدادات"
              className="group relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#2B2C34] group-hover:bg-[#383A44] text-white flex items-center justify-center transition-colors">
                <Settings className="w-4 h-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={minimizeRoom}
              aria-label="تصغير الغرفة"
              title="تصغير الغرفة ومواصلة التصفح"
              className="group relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#2B2C34] group-hover:bg-[#383A44] text-white flex items-center justify-center transition-colors">
                <ChevronUp className="w-4 h-4" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRoomId(null)}
              aria-label="مغادرة الغرفة"
              title="خروج من الغرفة"
              className="group relative w-8 h-8 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-transform active:scale-95"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
              <span className="relative z-10 w-full h-full rounded-full bg-[#2B2C34] group-hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>

        {/* Sub-bar: Clean Heat + Seat Distribution (hidden when game drawer is open to avoid top clutter) */}
        {!luckyGamesOpen && (
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-900/55 border border-violet-400/35 text-[11px] font-mono-num font-extrabold text-amber-300 shadow-sm">
                <Trophy className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{formatCompactNumber(room.heat)}</span>
              </div>

              {/* Live User XP Level Pill */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 border border-violet-400/30">
                <span className="text-[10px] font-mono-num font-extrabold text-sky-300">
                  Lv.{levelProgress.level}
                </span>
                <div className="w-12 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-violet-500 to-blue-400"
                    style={{ width: `${Math.max(8, levelProgress.percent)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Seat Distribution Switcher: 5 | 10 | 15 | 20 */}
            <div
              className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-black/45 border border-amber-300/30 backdrop-blur-xs"
              aria-label="توزيع المقاعد الصوتية"
            >
              <span className="text-[9px] text-amber-200/80 font-bold px-1.5 hidden sm:inline">
                المقاعد:
              </span>
              {[5, 10, 15, 20].map((count) => {
                const active = room.totalMics === count;
                const canManageRoom =
                  currentUser.role === 'OWNER' ||
                  currentUser.role === 'SUPERVISOR' ||
                  room.ownerId === currentUser.id;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      if (!canManageRoom) {
                        showToast('تغيير توزيع المقاعد مخصص لمالك الغرفة والمشرفين فقط', 'warning');
                        return;
                      }
                      updateRoomSettings(room.id, { totalMics: count });
                      showToast(`تم تعديل توزيع المقاعد إلى ${count} مقعداً`, 'success');
                    }}
                    className={`px-2 py-0.5 rounded-full font-mono-num text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-gradient-to-l from-amber-400 to-yellow-300 text-amber-950 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
                        : 'text-white/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const canManageRoom =
                    currentUser.role === 'OWNER' ||
                    currentUser.role === 'SUPERVISOR' ||
                    room.ownerId === currentUser.id;
                  if (!canManageRoom) {
                    showToast('تخصيص عدد المقاعد مخصص لمالك الغرفة والمشرفين فقط', 'warning');
                    return;
                  }
                  setControlSheet('mics');
                }}
                title="تخصيص عدد المقاعد والزخرفة (1-20)"
                aria-label="تخصيص عدد المقاعد"
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-emerald-500/35 text-amber-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Mic className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => triggerIncomingGiftForMe(room.id)}
                className="hidden sm:flex px-2 py-1 rounded-full bg-violet-600/35 hover:bg-violet-600/55 border border-violet-400/40 text-[10px] font-bold text-violet-100 items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-sky-300" />
                <span>محاكاة هدية</span>
              </button>

              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/45 border border-white/15">
                <img
                  src={room.ownerAvatar}
                  alt={room.ownerName}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-amber-400"
                />
                <span className="text-[11px] font-mono-num font-bold text-sky-300">
                  {room.listeners}
                </span>
                <span className="inline-flex items-end gap-[1.5px] h-2.5">
                  <span className="w-[2px] h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="w-[2px] h-2.5 bg-emerald-400 rounded-full" />
                  <span className="w-[2px] h-1 bg-emerald-400 rounded-full animate-pulse" />
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* CENTRAL COSMIC CIRCULAR STAGE */}
      <main className="room-sleep-stage relative z-10 flex-1 min-h-0 flex flex-col justify-between px-3 pb-2.5 sm:pb-3">
        {/* VIP Entrance Ribbon displaying configured room welcomeMessage */}
        <AnimatePresence>
          {entryBannerVisible && (
            <motion.div
              initial={{ opacity: 0, x: 90, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -90, scale: 0.94 }}
              transition={{ duration: 0.35 }}
              className={`pointer-events-none mx-auto w-full max-w-md mb-1 rounded-full bg-gradient-to-l from-amber-500 via-sky-500 to-blue-600 p-[1.5px] shadow-[0_0_24px_rgba(251,191,36,0.5)] ${
                luckyGamesOpen ? 'relative z-[55]' : 'z-30'
              }`}
            >
              <div className="rounded-full bg-[#06185E]/92 px-3.5 py-1 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base shrink-0">🏎️</span>
                  <span className="font-display font-extrabold text-amber-200 truncate">
                    {room.welcomeMessage || 'ارحبووو'} · {currentUser.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-200 truncate shrink-0">
                  دخل الغرفة
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Reaction Emoji Pop */}
        <AnimatePresence>
          {floatingEmoji && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.6 }}
              animate={{ opacity: 1, y: -12, scale: 1.35 }}
              exit={{ opacity: 0, y: -36, scale: 0.9 }}
              className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 z-40 text-5xl drop-shadow-2xl"
            >
              {floatingEmoji}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gift Animation Overlay Banner */}
        <AnimatePresence>
          {roomGiftAnim && (
            <motion.div
              key={roomGiftAnim.id}
              initial={{ opacity: 0, y: -18, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.94 }}
              transition={{ duration: 0.25 }}
              className={`pointer-events-none mx-auto w-full max-w-md rounded-2xl bg-gradient-to-l from-violet-600/95 via-[#1C144A]/95 to-blue-600/95 border border-sky-400/70 p-3 shadow-2xl backdrop-blur-md overflow-hidden mb-2 ${
                luckyGamesOpen ? 'relative z-[55]' : 'z-30'
              }`}
            >
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <motion.div
                    animate={{ scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }}
                    className="w-11 h-11 rounded-2xl bg-[#0F0B28] border border-blue-400/60 flex items-center justify-center text-2xl shrink-0"
                  >
                    {roomGiftAnim.giftIcon}
                  </motion.div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>هدية مستلمة في الغرفة!</span>
                    </div>
                    <div className="text-xs font-display font-bold text-white truncate">
                      {roomGiftAnim.senderName} ← {roomGiftAnim.recipientName}
                    </div>
                    <div className="text-[11px] text-violet-200 truncate">
                      {roomGiftAnim.giftName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2 py-0.5 rounded-lg bg-gradient-to-l from-violet-500 to-blue-500 text-white font-mono-num font-extrabold text-xs">
                    ×{roomGiftAnim.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={dismissGiftAnimation}
                    className="pointer-events-auto w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center cursor-pointer"
                    aria-label="إغلاق"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5-Column Adaptive Golden Throne Seats (compact vertical height on mobile so bottom bar is 100% visible) */}
        <div className="relative mx-auto w-full max-w-[390px] sm:max-w-[500px] my-auto py-0.5 shrink-0">
          <div
            className={`grid grid-cols-5 place-items-center ${
              room.seats.length <= 5
                ? 'gap-x-3 gap-y-4 sm:gap-x-5 py-6 sm:py-8'
                : room.seats.length <= 10
                ? 'gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-5 py-3 sm:py-4'
                : 'gap-x-2.5 gap-y-1.5 sm:gap-x-4 sm:gap-y-3 py-0.5 sm:py-1'
            }`}
          >
            {room.seats.map((seat) => {
              const isOccupied = Boolean(seat.userId);
              const isMeOnSeat = seat.userId === currentUser.id;
              const isSpeakingActive =
                isOccupied &&
                !seat.isMuted &&
                (seat.isSpeaking || (isMeOnSeat && micLevel > 0.08));
              const isOwnerSeat = seat.userId === room.ownerId;
              const seatUser = seat.userId
                ? state.users.find((u) => u.id === seat.userId)
                : null;
              const userLevel = seatUser?.level || 30;
              const livePulseScale = isMeOnSeat && isSpeakingActive ? 1.12 + micLevel * 0.3 : 1.15;

              const seatBoxSize =
                room.seats.length <= 5
                  ? 'w-[62px] h-[62px] sm:w-[76px] sm:h-[76px]'
                  : room.seats.length <= 10
                  ? 'w-[54px] h-[54px] sm:w-[68px] sm:h-[68px]'
                  : 'w-[46px] h-[46px] sm:w-[60px] sm:h-[60px]';
              const throneIconSize =
                room.seats.length <= 5
                  ? 'w-7 h-7 sm:w-9 sm:h-9'
                  : room.seats.length <= 10
                  ? 'w-6 h-6 sm:w-8 sm:h-8'
                  : 'w-5 h-5 sm:w-7 sm:h-7';

              return (
                <button
                  key={seat.seatNumber}
                  type="button"
                  onClick={() => handleSeatClick(seat)}
                  className="group relative flex flex-col items-center gap-0.5 sm:gap-1 cursor-pointer focus:outline-none"
                >
                  <div className={`relative ${seatBoxSize} flex items-center justify-center`}>
                    {/* Speaking Aura Pulse Rings */}
                    {isSpeakingActive && (
                      <>
                        <motion.span
                          aria-hidden="true"
                          animate={{ scale: [0.95, livePulseScale, 0.95], opacity: [0.55, 0.9, 0.55] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="pointer-events-none absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-300/60 via-sky-400/50 to-cyan-300/60 blur-sm"
                        />
                        <motion.span
                          aria-hidden="true"
                          initial={{ scale: 0.98, opacity: 0.85 }}
                          animate={{ scale: 1.34, opacity: 0 }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                          className="pointer-events-none absolute inset-0 rounded-full border-2 border-sky-300/90"
                        />
                      </>
                    )}

                    {/* Avatar OR Royal Golden Throne Seat */}
                    {isOccupied && seat.avatar ? (
                      <div
                        className={`relative z-10 ${seatBoxSize} rounded-full overflow-hidden transition-all ${
                          isSpeakingActive
                            ? 'p-[2.5px] bg-gradient-to-tr from-amber-300 via-sky-300 to-cyan-300 shadow-[0_0_16px_rgba(56,189,248,0.85)]'
                            : 'ring-[2.5px] ring-[#FFD83B] shadow-[0_0_14px_rgba(253,224,71,0.52)]'
                        }`}
                      >
                        <img
                          src={seat.avatar}
                          alt={seat.userName || ''}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>
                    ) : (
                      <div
                        className={`relative z-10 ${seatBoxSize} rounded-full bg-gradient-to-b from-[#0E2785]/80 via-[#071A60]/90 to-[#040E3B]/95 backdrop-blur-[2px] border-[2.5px] border-[#FFD83B] ring-1 ring-inset ring-amber-200/35 group-hover:border-yellow-200 flex items-center justify-center shadow-[0_0_16px_rgba(251,191,36,0.45),inset_0_2px_8px_rgba(253,224,71,0.22)] transition-transform group-hover:scale-105`}
                      >
                        {seat.seatNumber === 1 && !seat.isLocked && (
                          <Crown className="absolute -top-2.5 w-3.5 h-3.5 text-amber-300 fill-amber-300 drop-shadow" />
                        )}
                        {seat.isLocked ? (
                          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-200" />
                        ) : (
                          <Armchair
                            className={`${throneIconSize} text-amber-300 fill-rose-600/95 stroke-[1.9] drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]`}
                          />
                        )}
                      </div>
                    )}

                    {/* Mute / Equalizer / Owner Crown Badges */}
                    {isOccupied && seat.isMuted && (
                      <span className="z-20 absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 border border-[#03145C] text-white flex items-center justify-center">
                        <MicOff className="w-2.5 h-2.5" />
                      </span>
                    )}

                    {isOccupied && !seat.isMuted && isSpeakingActive && (
                      <span className="z-20 absolute -bottom-0.5 -right-0.5 h-4 px-1 rounded-full bg-gradient-to-l from-sky-500 to-blue-600 border border-sky-200 text-white flex items-center gap-[1.5px] shadow">
                        {[0, 1, 2].map((bar) => (
                          <motion.span
                            key={bar}
                            animate={{ scaleY: [0.4, 1, 0.4] }}
                            transition={{ duration: 0.65, delay: bar * 0.14, repeat: Infinity }}
                            className="w-[1.5px] h-2 rounded-full bg-white origin-bottom"
                          />
                        ))}
                      </span>
                    )}

                    {isOwnerSeat && (
                      <span className="z-20 absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 border border-white/80 text-white flex items-center justify-center shadow">
                        <Crown className="w-2.5 h-2.5 fill-white" />
                      </span>
                    )}
                  </div>

                  {/* Seat Number or Speaker Name */}
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold truncate max-w-[66px] leading-tight ${
                      isOccupied
                        ? isSpeakingActive
                          ? 'text-sky-200'
                          : 'text-amber-200'
                        : 'text-white/80 font-mono-num'
                    }`}
                  >
                    {isOccupied ? `${seat.userName} · ${userLevel}` : seat.seatNumber}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-Time WebSocket Room Interaction Live Chart Card */}
        {!luckyGamesOpen && !giftDrawerOpen && (
          <div className="room-sleep-stage shrink-0 pt-0.5">
            <RoomEngagementCard room={room} variant="inline" />
          </div>
        )}

        {/* Pre-Sleep 10-Second Calm Warning Banner */}
        <AnimatePresence>
          {sleepCountdownSec !== null && !isSleepMode && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-auto w-full max-w-sm rounded-full bg-[#0A081E]/90 border border-indigo-400/45 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] shadow-lg shrink-0"
            >
              <span className="flex items-center gap-1.5 text-sky-200 font-semibold truncate">
                <Moon className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">
                  سكون تلقائي لتوفير البطارية خلال{' '}
                  <strong className="font-mono-num text-white">{sleepCountdownSec}</strong> ث
                </span>
              </span>
              <button
                type="button"
                onClick={() => wakeFromSleep(false)}
                className="px-2.5 py-0.5 rounded-full bg-violet-600/70 hover:bg-violet-500 text-white text-[10px] font-bold shrink-0 cursor-pointer"
              >
                إلغاء
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM SECTION: Chat + Left Floating Widget Column */}
        <div className="relative flex-1 min-h-0 flex items-end justify-between gap-2 pt-1">
          {/* Right side (RTL): Chat Filter Tabs + Live Chat Feed */}
          <div className="flex-1 min-w-0 flex flex-col justify-end h-full space-y-1.5 max-w-xl">
            <div className="flex items-center gap-4 px-1 shrink-0">
              <button
                type="button"
                onClick={() => setChatFilter('all')}
                className={`text-xs sm:text-sm font-display cursor-pointer transition-colors ${
                  chatFilter === 'all' ? 'font-extrabold text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setChatFilter('chat')}
                className={`text-xs sm:text-sm font-display cursor-pointer transition-colors ${
                  chatFilter === 'chat' ? 'font-extrabold text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                دردشة
              </button>
            </div>

            <div className="min-h-0 max-h-20 sm:max-h-32 overflow-y-auto no-scrollbar space-y-1 pl-1">
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`inline-block max-w-full rounded-2xl px-2.5 py-1 text-[11px] leading-snug backdrop-blur-sm ${
                    msg.type === 'achievement'
                      ? 'bg-gradient-to-l from-violet-600/50 via-indigo-600/45 to-blue-600/50 border border-sky-300/65 text-white shadow-[0_0_14px_rgba(99,102,241,0.5)]'
                      : msg.type === 'gift'
                      ? 'bg-violet-600/35 border border-violet-300/40 text-violet-100'
                      : msg.type === 'system'
                      ? 'bg-black/45 border border-white/10 text-slate-100'
                      : 'bg-black/40 border border-white/10 text-white'
                  }`}
                >
                  {msg.type !== 'system' && (
                    <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
                      <span className="px-1 py-[1px] rounded bg-gradient-to-l from-violet-600 to-blue-500 text-[8.5px] font-mono-num font-bold text-white">
                        Lv.{msg.senderLevel}
                      </span>
                      <span className="font-bold text-sky-300">{msg.senderName}:</span>
                    </span>
                  )}
                  <span>{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Compact Treasure Discovery Banner with GO> (matching Farah_f256f88c) */}
            <div className="rounded-2xl bg-black/35 backdrop-blur-sm border border-sky-300/20 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setLuckyGameMode('launcher');
                  setLuckyGamesOpen(true);
                }}
                className="px-2.5 py-0.5 rounded-full bg-gradient-to-l from-violet-500 to-sky-500 text-white font-mono-num font-black text-[10px] shrink-0 cursor-pointer shadow"
              >
                GO&gt;
              </button>
              <span className="text-slate-100 truncate font-medium">
                تهانينا على اكتشاف الكنوز والحصول على 150,000,000 عملة
              </span>
            </div>

            {/* Expandable Chat Composer or Quick Emoji Strip */}
            {emojiBarOpen && (
              <div className="flex items-center gap-1.5 flex-wrap bg-black/75 border border-violet-500/35 rounded-2xl p-2">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setFloatingEmoji(em);
                      window.setTimeout(() => setFloatingEmoji(null), 1300);
                      if (room.sendEmojiToChat) {
                        sendRoomMessage(room.id, em);
                      }
                      setEmojiBarOpen(false);
                    }}
                    className="w-8 h-8 rounded-xl hover:bg-white/10 text-lg flex items-center justify-center cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {chatComposerOpen && (
              <form onSubmit={handleSendChat} className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="اكتب رسالتك في الغرفة..."
                  autoFocus
                  className="flex-1 h-10 px-3.5 rounded-full bg-black/70 border border-violet-400/50 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-full bg-gradient-to-l from-violet-600 to-blue-500 text-white flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label="إرسال"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          {/* Left side (RTL end): Compact Shortcuts Column (Music & Messages only) */}
          <aside className="flex flex-col items-center gap-2 shrink-0 pb-1">
            {/* White Vinyl Turntable Music Icon with Animated Glowing Purple Frame */}
            <button
              type="button"
              onClick={() => setMusicOpen((v) => !v)}
              title="مشغل الموسيقى"
              aria-label="مشغل الموسيقى"
              className="group relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            >
              {/* Soft outer purple aura */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-1 rounded-full bg-violet-500/35 blur-md group-hover:bg-purple-400/50 transition-colors"
              />

              {/* Rotating glowing purple border ring */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full p-[2.5px] overflow-hidden shadow-[0_0_18px_rgba(168,85,247,0.72)]"
              >
                <span className="absolute -inset-1/2 animate-purple-glow-ring" />
              </span>

              {/* Inner pearl-white vinyl disc + purple hub */}
              <span className="relative z-10 w-[43px] h-[43px] rounded-full bg-white p-[1.5px] flex items-center justify-center shadow-inner overflow-hidden">
                <svg
                  viewBox="0 0 48 48"
                  className={`w-full h-full ${isPlaying ? 'animate-[spin_4.5s_linear_infinite]' : ''}`}
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient id="whiteVinylSurface" cx="42%" cy="35%" r="68%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="65%" stopColor="#F5F3FF" />
                      <stop offset="100%" stopColor="#E2E8F0" />
                    </radialGradient>
                    <radialGradient id="purpleVinylHub" cx="40%" cy="35%" r="70%">
                      <stop offset="0%" stopColor="#C084FC" />
                      <stop offset="60%" stopColor="#9333EA" />
                      <stop offset="100%" stopColor="#6D28D9" />
                    </radialGradient>
                  </defs>
                  {/* Pearl-white disc */}
                  <circle cx="24" cy="24" r="22" fill="url(#whiteVinylSurface)" stroke="#DDD6FE" strokeWidth="1" />
                  {/* Subtle vinyl grooves */}
                  <circle cx="24" cy="24" r="18" fill="none" stroke="#CBD5E1" strokeOpacity="0.7" strokeWidth="0.75" />
                  <circle cx="24" cy="24" r="14.5" fill="none" stroke="#DDD6FE" strokeOpacity="0.85" strokeWidth="0.75" />
                  <circle cx="24" cy="24" r="11" fill="none" stroke="#CBD5E1" strokeOpacity="0.6" strokeWidth="0.75" />
                  {/* Shine arc for spinning visual cue */}
                  <path d="M 11 15 A 16 16 0 0 1 26 8" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
                  {/* Purple center label */}
                  <circle cx="24" cy="24" r="7.5" fill="url(#purpleVinylHub)" stroke="#F3E8FF" strokeWidth="1" />
                  {/* White center spindle dot */}
                  <circle cx="24" cy="24" r="2.2" fill="#FFFFFF" />
                </svg>
              </span>

              {/* Tonearm pivot & needle arm at top-right */}
              <svg
                viewBox="0 0 48 48"
                className={`pointer-events-none z-20 absolute inset-0 w-full h-full transition-transform duration-300 origin-[39px_9px] ${
                  isPlaying ? 'rotate-[5deg]' : '-rotate-[6deg]'
                }`}
                aria-hidden="true"
              >
                {/* Pivot glow & white circle with purple rim */}
                <circle cx="39" cy="9" r="3.6" fill="#FFFFFF" stroke="#7C3AED" strokeWidth="1.2" />
                <circle cx="39" cy="9" r="1.4" fill="#9333EA" />
                {/* Sleek tonearm rod */}
                <path
                  d="M 39 12.2 L 38.4 23.5 L 33.8 28.2"
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 39 12.2 L 38.4 23.5 L 33.8 28.2"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Needle cartridge head */}
                <rect
                  x="30.8"
                  y="26.5"
                  width="5"
                  height="2.5"
                  rx="1.2"
                  transform="rotate(-44 33.3 27.75)"
                  fill="#FFFFFF"
                  stroke="#7C3AED"
                  strokeWidth="0.8"
                />
              </svg>
            </button>

            {/* Messages Quick Button */}
            <button
              type="button"
              onClick={() => {
                minimizeRoom();
                setActiveTab('messages');
              }}
              title="الرسائل"
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-[#05010E]" />
            </button>
          </aside>
        </div>

        {/* BOTTOM ROOM ACTION BAR (Balanced 7-column equal-spacing responsive dock) */}
        <nav
          aria-label="أدوات التحكم بالغرفة"
          className="shrink-0 mt-1.5 pt-1.5 pb-[max(4px,env(safe-area-inset-bottom))] border-t border-white/15"
        >
          <div className="mx-auto w-full max-w-xl rounded-2xl bg-black/25 backdrop-blur-sm border border-white/10 px-1.5 py-1 sm:px-3 sm:py-1.5 grid grid-cols-7 items-center gap-1 sm:gap-2">
            {/* 1. الميكروفون (Voice / Seat Mic Control) */}
            <button
              type="button"
              onClick={() => {
                if (mySeat) {
                  toggleMuteSeat(room.id, mySeat.seatNumber);
                } else {
                  const firstEmpty = room.seats.find((s) => !s.userId && !s.isLocked);
                  if (firstEmpty) toggleSeatInRoom(room.id, firstEmpty.seatNumber);
                }
              }}
              title={
                micStatus === 'active'
                  ? 'الميكروفون الحقيقي نشط'
                  : micStatus === 'denied'
                  ? 'صلاحية المايك مرفوضة من المتصفح'
                  : mySeat
                  ? mySeat.isMuted
                    ? 'فتح المايك'
                    : 'كتم المايك'
                  : 'صعود على المايك'
              }
              aria-label={mySeat ? (mySeat.isMuted ? 'فتح المايك' : 'كتم المايك') : 'صعود على المايك'}
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span
                className={`relative w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                  mySeat?.isMuted
                    ? 'p-[2px] shadow-[0_0_14px_rgba(168,85,247,0.45)]'
                    : 'bg-gradient-to-br from-[#5DA8FF] via-[#6F7BFF] to-[#8E52FF] group-hover:brightness-110 text-white shadow-[0_0_16px_rgba(111,123,255,0.62)]'
                }`}
              >
                {mySeat?.isMuted ? (
                  <>
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full overflow-hidden">
                      <span className="absolute -inset-1/2 animate-white-purple-ring" />
                    </span>
                    <span className="relative z-10 w-full h-full rounded-full bg-[#2B2C34] group-hover:bg-[#353742] text-slate-100 flex items-center justify-center transition-colors">
                      <MicOff className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                    </span>
                  </>
                ) : (
                  <Mic className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                )}
                {(micStatus === 'active' || (mySeat && !mySeat.isMuted)) && (
                  <span className="z-20 absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#00DF76] border-2 border-[#080B1C]" />
                )}
              </span>
            </button>

            {/* 2. كتابة رسالة (Chat Composer) */}
            <button
              type="button"
              onClick={() => {
                setEmojiBarOpen(false);
                setChatComposerOpen((v) => !v);
              }}
              title="كتابة رسالة"
              aria-label="كتابة رسالة"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="relative w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full p-[2px] overflow-hidden flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.42)]">
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                <span
                  className={`relative z-10 w-full h-full rounded-full flex items-center justify-center transition-colors ${
                    chatComposerOpen
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#2B2C34] group-hover:bg-[#353742] text-white'
                  }`}
                >
                  <MessageCircle className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                </span>
              </span>
            </button>

            {/* 3. الرموز التعبيرية (Emoji Strip) */}
            <button
              type="button"
              onClick={() => {
                setChatComposerOpen(false);
                setEmojiBarOpen((v) => !v);
              }}
              title="الرموز التعبيرية"
              aria-label="الرموز التعبيرية"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="relative w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full p-[2px] overflow-hidden flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.42)]">
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                <span
                  className={`relative z-10 w-full h-full rounded-full flex items-center justify-center transition-colors ${
                    emojiBarOpen
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#2B2C34] group-hover:bg-[#353742] text-white'
                  }`}
                >
                  <Smile className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                </span>
              </span>
            </button>

            {/* 4. أدوات الحفلة (Center Hub) */}
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              title="أدوات الحفلة"
              aria-label="أدوات الحفلة"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="relative w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full p-[2px] overflow-hidden flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.45)]">
                <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                <span className="relative z-10 w-full h-full rounded-full bg-[#2B2C34] group-hover:bg-[#353742] text-white flex items-center justify-center transition-colors">
                  <LayoutGrid className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                </span>
              </span>
            </button>

            {/* 5. المؤثرات الملكية (Royal Effects) */}
            <button
              type="button"
              onClick={() => triggerRoyalDragon(currentUser.name)}
              title="المؤثرات الملكية"
              aria-label="المؤثرات الملكية"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-[#B04BFF] to-[#7D2AE8] group-hover:brightness-110 text-white flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.52)] transition-all">
                <Wand2 className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
              </span>
            </button>

            {/* 6. ألعاب الغرفة — محظوظ (Lucky Games) */}
            <button
              type="button"
              onClick={() => {
                setLuckyGameMode('launcher');
                setLuckyGamesOpen(true);
              }}
              title="ألعاب الغرفة — محظوظ"
              aria-label="ألعاب الغرفة — محظوظ"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-[#FFD83B] to-[#FF8C00] group-hover:brightness-110 text-[#3B1900] flex items-center justify-center shadow-[0_0_15px_rgba(255,153,0,0.45)] transition-all">
                <Gamepad2 className="w-[19px] h-[19px] sm:w-6 sm:h-6" />
              </span>
            </button>

            {/* 7. صندوق الهدايا (Gift Drawer) */}
            <button
              type="button"
              onClick={() => setGiftDrawerOpen(true)}
              title="فتح صندوق الهدايا"
              aria-label="فتح صندوق الهدايا"
              className="group w-full min-h-[44px] flex items-center justify-center rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80 transition-transform active:scale-95"
            >
              <span className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[400px]:w-11 min-[400px]:h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-[#44F29F] via-[#1FD97F] to-[#00BA63] group-hover:brightness-110 text-white flex items-center justify-center shadow-[0_0_18px_rgba(31,217,127,0.62)] transition-all">
                <Gift className="w-[19px] h-[19px] sm:w-6 sm:h-6" />
              </span>
            </button>
          </div>
        </nav>
      </main>

      {/* SCREENSHOT 6: MUSIC PLAYER FLOATING OVERLAY */}
      <AnimatePresence>
        {musicOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            className="absolute inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-1/3 z-40 sm:w-full sm:max-w-sm rounded-3xl bg-[#29204A]/90 backdrop-blur-xl border border-violet-300/30 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsFavoriteTrack((v) => !v)}
                aria-label="إضافة للمفضلة"
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                  isFavoriteTrack ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Star className={`w-5 h-5 ${isFavoriteTrack ? 'fill-amber-400' : ''}`} />
              </button>

              <div className="flex-1 text-center font-display font-bold text-sm text-white truncate px-2">
                {activeTrack.title}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMusicMuted((v) => !v)}
                  aria-label={isMusicMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  {isMusicMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMusicOpen(false)}
                  aria-label="إغلاق المشغل"
                  className="w-7 h-7 rounded-full bg-white/10 text-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrubber */}
            <div className="flex items-center gap-2.5 text-[11px] font-mono-num text-slate-300">
              <span>{formatTimer(musicElapsed)}</span>
              <input
                type="range"
                min={0}
                max={activeTrack.durationSec}
                value={musicElapsed}
                onChange={(e) => setMusicElapsed(Number(e.target.value))}
                className="flex-1 accent-violet-400 h-1.5 cursor-pointer"
              />
              <span>{formatTimer(activeTrack.durationSec)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setPlaylistOpen((v) => !v)}
                aria-label="قائمة التشغيل"
                className={`p-2 rounded-full cursor-pointer ${
                  playlistOpen ? 'text-sky-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListMusic className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrackIndex((i) => (i - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);
                  setMusicElapsed(0);
                }}
                aria-label="الأغنية السابقة"
                className="p-2 text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying((v) => !v)}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-violet-600 text-white flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.7)] cursor-pointer hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrackIndex((i) => (i + 1) % MUSIC_TRACKS.length);
                  setMusicElapsed(0);
                }}
                aria-label="الأغنية التالية"
                className="p-2 text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                type="button"
                onClick={() => setIsRepeat((v) => !v)}
                aria-label="تكرار"
                className={`p-2 rounded-full cursor-pointer ${
                  isRepeat ? 'text-sky-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {playlistOpen && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                {MUSIC_TRACKS.map((tr, idx) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      setTrackIndex(idx);
                      setMusicElapsed(0);
                      setIsPlaying(true);
                    }}
                    className={`w-full px-3 py-1.5 rounded-xl text-right text-xs font-medium flex items-center justify-between cursor-pointer ${
                      idx === trackIndex
                        ? 'bg-violet-500/40 text-white font-bold'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{tr.title}</span>
                    <span className="font-mono-num text-[10px] text-slate-300">
                      {formatTimer(tr.durationSec)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PARTY TOOLS BOTTOM SHEET (أدوات الحفلة) */}
      <AnimatePresence>
        {toolsOpen && (
          <div className="absolute inset-0 z-40 flex items-end bg-black/60 backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={() => setToolsOpen(false)} />
            <motion.div
              initial={{ y: 260 }}
              animate={{ y: 0 }}
              exit={{ y: 260 }}
              className="relative z-10 w-full rounded-t-3xl p-[2.5px] overflow-hidden shadow-[0_-14px_48px_rgba(168,85,247,0.58)]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-purple-glow-ring" />
              <div className="relative z-10 max-h-[78dvh] overflow-y-auto rounded-t-[21px] bg-gradient-to-b from-[#1E133D] via-[#150D2D] to-[#0E0820] px-4 pt-3 pb-6 space-y-3.5">
                {/* Drag handle bar */}
                <div className="w-10 h-1 rounded-full bg-violet-300/35 mx-auto" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative w-7 h-7 rounded-xl p-[1.5px] overflow-hidden flex items-center justify-center shrink-0">
                      <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                      <span className="relative z-10 w-full h-full rounded-[10px] bg-[#291952] text-violet-200 flex items-center justify-center">
                        <Wand2 className="w-3.5 h-3.5" />
                      </span>
                    </span>
                    <h2 className="text-base font-display font-extrabold text-white">أدوات الحفلة</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setToolsOpen(false)}
                    aria-label="إغلاق أدوات الحفلة"
                    className="group relative w-9 h-9 rounded-full p-[1.5px] overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                  >
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-1/2 animate-white-purple-ring" />
                    <span className="relative z-10 w-full h-full rounded-full bg-[#241645] group-hover:bg-rose-600/80 text-white flex items-center justify-center transition-colors">
                      <X className="w-4 h-4" />
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2.5 text-center">
                  {[
                    { id: 'room-settings', label: 'تحكم الغرفة', bg: 'from-emerald-500 to-teal-700', icon: Settings },
                    { id: 'fruit', label: 'الفواكه', bg: 'from-purple-700 to-indigo-950', image: GAME_FRUIT_ICON_PATH },
                    { id: 'wheel', label: 'الخضروات', bg: 'from-indigo-700 to-purple-950', image: GAME_FOODIE_ICON_PATH },
                    { id: 'dice', label: `نرد (×${room.diceCount ?? 1})`, bg: 'from-amber-400 to-orange-600', icon: Dices },
                    ...(isApprovedAgent
                      ? [{ id: 'agency', label: 'شحن الوكالة', bg: 'from-emerald-400 to-emerald-700', icon: Coins }]
                      : []),
                    { id: 'gather', label: 'جمع', bg: 'from-teal-400 to-cyan-700', icon: Flag },
                    { id: 'broadcast', label: 'البث', bg: 'from-sky-400 to-blue-700', icon: Megaphone },
                    { id: 'pk', label: 'PK', bg: 'from-violet-500 via-fuchsia-500 to-rose-500', icon: Swords },
                    { id: 'pk-room', label: 'PK الغرفة', bg: 'from-indigo-500 via-purple-600 to-pink-600', icon: Shield },
                    { id: 'music', label: 'موسيقى', bg: 'from-[#3B1778] to-[#1D0B42]', isVinyl: true, icon: Disc3 },
                    { id: 'treasure', label: 'كنز', bg: 'from-rose-500 to-pink-700', icon: Gift },
                    { id: 'clean', label: 'ينظف', bg: 'from-cyan-500 to-indigo-700', icon: Trash2 },
                    { id: 'themes', label: 'الخلفيات', bg: 'from-violet-500 to-purple-800', icon: Palette },
                    { id: 'mics', label: 'المايكات', bg: 'from-fuchsia-500 to-purple-800', icon: Mic },
                    { id: 'wallet', label: 'المحفظة', bg: 'from-amber-500 to-purple-800', icon: Wallet },
                    { id: 'calc', label: 'الحاسبة', bg: 'from-orange-500 to-rose-600', icon: Calculator },
                    { id: 'sleep', label: 'سكون الشاشة', bg: 'from-indigo-700 to-slate-950', icon: Moon },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => handleToolAction(tool.id)}
                        className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.1] border border-violet-300/12 py-2.5 px-1 cursor-pointer transition-colors duration-150 active:scale-[0.97]"
                      >
                        <span
                          className={`relative w-13 h-13 rounded-2xl p-[2px] overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-150 ${
                            tool.image
                              ? 'animate-soft-white-glow bg-white/15'
                              : 'shadow-[0_6px_18px_rgba(139,92,246,0.38)]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute -inset-1/2 ${
                              tool.image ? 'animate-soft-white-ring' : 'animate-white-purple-ring'
                            }`}
                          />
                          {tool.image ? (
                            <span className={`relative z-10 w-full h-full rounded-[13px] bg-gradient-to-br ${tool.bg} overflow-hidden flex items-center justify-center`}>
                              <img
                                src={tool.image}
                                alt={tool.label}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover scale-[1.12]"
                              />
                            </span>
                          ) : tool.isVinyl ? (
                            <span className={`relative z-10 w-full h-full rounded-[14px] bg-gradient-to-br ${tool.bg} flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]`}>
                              <svg viewBox="0 0 36 36" className="w-8 h-8" aria-hidden="true">
                                <circle cx="17" cy="18" r="12.5" fill="#F8FAFC" stroke="#E9D5FF" strokeWidth="1.5" />
                                <circle cx="17" cy="18" r="9" fill="none" stroke="#CBD5E1" strokeWidth="0.9" />
                                <circle cx="17" cy="18" r="5" fill="#7C3AED" />
                                <circle cx="17" cy="18" r="1.7" fill="#FFFFFF" />
                                <path d="M27.5 8.5 L27.5 18.5 L23 22" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="27.5" cy="8.5" r="2" fill="#C4B5FD" stroke="#FFFFFF" strokeWidth="0.8" />
                              </svg>
                            </span>
                          ) : (
                            <span
                              className={`relative z-10 w-full h-full rounded-[14px] bg-gradient-to-br ${tool.bg} text-white flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)]`}
                            >
                              {Icon && <Icon className="w-6 h-6 drop-shadow-sm" />}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] font-bold text-violet-100 whitespace-nowrap truncate max-w-full">
                          {tool.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCREENSHOT 5: ROOM GIFT DRAWER */}
      <AnimatePresence>
        {giftDrawerOpen && (
          <div className="absolute inset-0 z-40 flex items-end bg-black/55 backdrop-blur-[2px]">
            <div className="absolute inset-0" onClick={() => setGiftDrawerOpen(false)} />
            <motion.div
              initial={{ y: 320 }}
              animate={{ y: 0 }}
              exit={{ y: 320 }}
              className="relative z-10 w-full rounded-t-3xl bg-[#1D1B27] border-t border-white/10 p-4 space-y-3"
            >
              {/* Top row: Gold balance + < الشحن */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openWallet('gold')}
                  className="flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>الشحن</span>
                </button>

                <div className="flex items-center gap-1.5 font-mono-num font-extrabold text-sm text-white">
                  <span>{formatFullGold(currentUser.gold)}</span>
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-[#4A2500] text-[10px] font-black flex items-center justify-center">
                    $
                  </span>
                </div>
              </div>

              {/* Category Tabs + Backpack */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-4">
                  {GIFT_CATEGORIES.map((cat) => {
                    const active = activeGiftCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveGiftCategory(cat)}
                        className={`text-xs sm:text-sm whitespace-nowrap shrink-0 cursor-pointer pb-1 ${
                          active
                            ? 'text-white font-extrabold border-b-2 border-white'
                            : 'text-slate-400 font-medium'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`لديك ${currentUser.ownedEntries.length} مقتنيات في الحقيبة`, 'info')}
                  aria-label="الحقيبة"
                  className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                >
                  <Backpack className="w-4 h-4" />
                </button>
              </div>

              {/* 4-Col Gift Grid */}
              <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto py-1">
                {activeCategoryGifts.map((gift) => {
                  const selected = chosenGift.id === gift.id;
                  return (
                    <button
                      key={gift.id}
                      type="button"
                      onClick={() => setSelectedGiftId(gift.id)}
                      className={`relative rounded-2xl p-2 text-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#262335] border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'bg-[#252233]/75 border border-transparent hover:border-white/20'
                      }`}
                    >
                      {gift.badge === '3D' && (
                        <span className="absolute top-1.5 right-1.5 px-1 py-[1px] rounded bg-amber-300 text-[#3F2000] text-[9px] font-black">
                          3D
                        </span>
                      )}
                      {gift.badge === 'magic' && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded bg-emerald-500 text-white text-[9px] flex items-center justify-center">
                          🪄
                        </span>
                      )}

                      <div className="text-3xl my-1.5">{gift.icon}</div>
                      <div className="text-[11px] font-bold text-white truncate">{gift.name}</div>
                      <div className="text-[10px] font-mono-num text-amber-300 mt-0.5 flex items-center justify-center gap-0.5">
                        <span>{gift.costGold.toLocaleString('en-US')}</span>
                        <span className="text-[9px]">🪙</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Recipient + Quantity + Green الإهداء Button */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      sendRoomGift(room.id, chosenGift.id, effectiveRecipientId, giftQuantity)
                    }
                    className="h-10 px-5 rounded-full bg-gradient-to-l from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-extrabold text-xs sm:text-sm cursor-pointer shrink-0 shadow-md"
                  >
                    الإهداء
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = GIFT_QUANTITIES.indexOf(giftQuantity);
                      setGiftQuantity(GIFT_QUANTITIES[(idx + 1) % GIFT_QUANTITIES.length]);
                    }}
                    className="h-10 px-3 rounded-full bg-[#2A2738] border border-emerald-400/50 text-white text-xs font-mono-num font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>^</span>
                    <span>{giftQuantity}</span>
                  </button>
                </div>

                <select
                  value={effectiveRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="h-10 px-3 rounded-full bg-[#2A2738] border border-white/15 text-xs text-white focus:outline-none max-w-[165px]"
                >
                  {recipientCandidates.map((cand) => (
                    <option key={cand.id} value={cand.id} className="bg-[#1D1B27]">
                      الإهداء إلى: {cand.name}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCREENSHOT 9: IN-ROOM USER PROFILE CARD POPUP */}
      <AnimatePresence>
        {inspectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
            <div className="absolute inset-0" onClick={() => setInspectedUser(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#FFEAF2] via-[#FFF6FA] to-white text-slate-900 shadow-2xl overflow-visible mt-10"
            >
              {/* Winged Angelic Crown Avatar Frame (Screenshot 9 top) */}
              <div className="relative -mt-12 flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {/* Left & Right Angelic Wings Decoration */}
                  <span className="text-3xl -ml-3 select-none" aria-hidden="true">
                    🪽
                  </span>
                  <div className="relative w-22 h-22 rounded-full p-1 bg-gradient-to-tr from-pink-400 via-amber-300 to-rose-400 shadow-lg">
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">
                      👑
                    </span>
                    <img
                      src={inspectedUser.avatar}
                      alt={inspectedUser.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover border-2 border-white"
                    />
                  </div>
                  <span className="text-3xl -mr-3 select-none scale-x-[-1]" aria-hidden="true">
                    🪽
                  </span>

                  {/* Secondary buddy mini avatar */}
                  <img
                    src={room.ownerAvatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute -left-10 bottom-1 w-10 h-10 rounded-full object-cover ring-2 ring-pink-300 shadow"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                aria-label="إغلاق البطاقة"
                className="absolute top-3 left-3 w-7 h-7 rounded-full bg-slate-900/10 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="px-5 pt-3 pb-4 text-center space-y-3">
                {/* User Name & Badges */}
                <div>
                  <h3 className="text-base font-display font-extrabold text-slate-900">
                    {inspectedUser.name}
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-bold">
                      {inspectedUser.title}
                    </span>
                    <span className="font-semibold">{inspectedUser.country}</span>
                    <span>{inspectedUser.flag}</span>
                    <span className="font-mono-num font-bold text-sky-600">
                      ID:{inspectedUser.id}
                    </span>
                  </div>
                </div>

                {/* Star / Heart / Crown / SVIP Pill Row */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-mono-num font-bold flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-white" />
                    {inspectedUser.level}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500 text-white text-[10px] font-mono-num font-bold flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 fill-white" />
                    {(inspectedUser.charisma ?? 0).toLocaleString('en-US')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-mono-num font-bold flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 fill-white" />
                    {formatCompactNumber(inspectedUser.giftedGold ?? 0)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-l from-amber-500 to-yellow-400 text-[#3F2000] text-[10px] font-mono-num font-black">
                    SVIP{inspectedUser.svip}
                  </span>
                </div>

                {/* 4 Achievement Medals */}
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  {['🏅', '🛡️', '🏆', '🦅'].map((medal, idx) => (
                    <span
                      key={idx}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 flex items-center justify-center text-lg shadow-xs"
                    >
                      {medal}
                    </span>
                  ))}
                </div>

                {/* Luxury Season Title Ribbons */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="px-3 py-1 rounded-full bg-gradient-to-l from-rose-600 via-amber-500 to-rose-600 text-white text-[10px] font-extrabold shadow-xs">
                    Legend Queen Season18
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gradient-to-l from-emerald-600 to-amber-500 text-white text-[10px] font-extrabold shadow-xs">
                    Limited-Time Recharge
                  </span>
                  <span className="px-3 py-1 rounded-full bg-gradient-to-l from-amber-500 to-lime-600 text-white text-[10px] font-extrabold shadow-xs">
                    Legend King Season 17
                  </span>
                </div>

                {/* Emerald Gift Circle Button */}
                <div className="pt-2 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecipientId(inspectedUser.id);
                      setInspectedUser(null);
                      setGiftDrawerOpen(true);
                    }}
                    className="w-12 h-12 rounded-full bg-gradient-to-b from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 text-white flex items-center justify-center shadow-md cursor-pointer"
                  >
                    <Gift className="w-6 h-6" />
                  </button>
                  <span className="text-xs font-bold text-slate-600">الهدايا المرسلة</span>
                </div>
              </div>

              {/* Bottom Split Action Bar: Mic / Mute */}
              <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50 rounded-b-3xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    const seat = room.seats.find((s) => s.userId === inspectedUser.id);
                    if (seat && seat.userId === currentUser.id) {
                      toggleSeatInRoom(room.id, seat.seatNumber);
                    } else {
                      showToast(`تمت دعوة ${inspectedUser.name} للبقاء على المنصة`, 'info');
                    }
                    setInspectedUser(null);
                  }}
                  className="h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 border-l border-slate-200 cursor-pointer"
                  aria-label="التحكم بالمايك"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const seat = room.seats.find((s) => s.userId === inspectedUser.id);
                    if (seat) {
                      toggleMuteSeat(room.id, seat.seatNumber);
                      showToast(`تم تبديل كتم المايك لـ ${inspectedUser.name}`, 'info');
                    }
                    setInspectedUser(null);
                  }}
                  className="h-12 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="كتم المايك"
                >
                  <MicOff className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calculator Mini Modal */}
      {calculatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xs rounded-3xl bg-[#1D1B27] border border-violet-500/40 p-5 space-y-3 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>حاسبة حرارة الغرفة والذهب</span>
              </span>
              <button
                type="button"
                onClick={() => setCalculatorOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs text-slate-300">أدخل مبلغ الذهب:</label>
            <input
              type="number"
              value={calcExpr}
              onChange={(e) => setCalcExpr(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-black/50 border border-violet-400/40 font-mono-num text-white focus:outline-none"
            />
            <div className="rounded-xl bg-violet-500/20 border border-violet-400/30 p-3 text-xs space-y-1 font-mono-num">
              <div>الحرارة المكتسبة: +{((Number(calcExpr) || 0) * 10).toLocaleString('en-US')}</div>
              <div>نقاط الخبرة (XP): +{Math.max(10, Math.floor((Number(calcExpr) || 0) / 100)).toLocaleString('en-US')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Brief Room Joining Loader (Videos 1 & 2) */}
      <AnimatePresence>
        {joiningRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
          >
            <div className="rounded-2xl bg-white text-slate-800 px-6 py-5 shadow-2xl flex flex-col items-center gap-3">
              <span className="w-8 h-8 rounded-full border-3 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-xs font-display font-extrabold">الانضمام إلى الغرفة ...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Room Lucky Games Drawer & Live Betting Games */}
      <LuckyGamesModal
        open={luckyGamesOpen}
        initialMode={luckyGameMode}
        onClose={() => setLuckyGamesOpen(false)}
      />

      {/* Room Quick Menu, Mic Count & Decoration, Themes & 16-Control Settings Panel */}
      <RoomSettingsModal
        room={room}
        sheet={controlSheet}
        onChangeSheet={setControlSheet}
        onOpenInsight={(drawer) => setRoomInsightDrawer(drawer)}
        onPreviewSleep={triggerManualSleep}
        onClose={() => setControlSheet('none')}
      />

      {/* Spacious Slide-Up Sheet for Real-Time Recharts Engagement & Active Hosts */}
      <AnimatePresence>
        {roomInsightDrawer !== 'none' && (
          <div className="absolute inset-0 z-40 flex items-end bg-black/60 backdrop-blur-[2px]">
            <div
              className="absolute inset-0"
              onClick={() => setRoomInsightDrawer('none')}
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: 260, opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 260, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative z-10 w-full rounded-t-3xl p-[2px] overflow-hidden shadow-[0_-14px_48px_rgba(99,102,241,0.52)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-1/2 animate-purple-blue-ring"
              />
              <div className="relative z-10 max-h-[78dvh] overflow-y-auto no-scrollbar rounded-t-[22px] bg-gradient-to-b from-[#170F3C] via-[#0F0C2E] to-[#080922] px-4 pt-3 pb-6 space-y-3">
                <div className="w-10 h-1 rounded-full bg-indigo-300/35 mx-auto" />
                {roomInsightDrawer === 'engagement' ? (
                  <RoomEngagementCard
                    room={room}
                    onClose={() => setRoomInsightDrawer('none')}
                  />
                ) : (
                  <ActiveHostsPanel
                    room={room}
                    onInspectHost={(u) => setInspectedUser(u)}
                    onClose={() => setRoomInsightDrawer('none')}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto-Sleep Battery-Saving OLED Dimming Overlay */}
      <AnimatePresence>
        {isSleepMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            onClick={() => wakeFromSleep(true)}
            role="button"
            tabIndex={0}
            aria-label="إيقاظ الغرفة من وضع السكون التلقائي"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                wakeFromSleep(true);
              }
            }}
            className="absolute inset-0 z-50 bg-[#020108]/88 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none"
          >
            <div className="max-w-xs w-full space-y-5 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-indigo-950/60 border border-indigo-400/25 flex items-center justify-center text-indigo-200/80">
                <Moon className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <div className="text-base font-display font-extrabold text-slate-200">
                  وضع السكون التلقائي لتوفير البطارية
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  تم تعتيم الشاشة وتخفيف إضاءة الأيقونات بعد هدوء الصوت، والغرفة لا تزال متصلة في الخلفية.
                </p>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-slate-200 truncate max-w-[230px]">{room.title}</div>
                <div className="font-mono-num text-[11px] text-sky-300/80">
                  مدة السكون: {formatTimer(silenceSeconds)}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  wakeFromSleep(true);
                }}
                className="min-h-[48px] px-7 rounded-full bg-violet-600/35 hover:bg-violet-600/55 border border-violet-300/35 text-slate-100 font-display font-bold text-sm transition-colors cursor-pointer"
              >
                إيقاظ الغرفة واستعادة السطوع
              </button>

              <p className="text-[11px] text-slate-500">
                المس الشاشة في أي مكان أو تحدث عبر المايك للاستيقاظ التلقائي
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InviteFriendsModal
        open={inviteModalOpen}
        roomId={room.id}
        roomTitle={room.title}
        onClose={() => setInviteModalOpen(false)}
      />
    </div>
  );
};
