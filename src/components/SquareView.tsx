import React, { useState } from 'react';
import {
  Compass,
  Crown,
  Diamond,
  Flame,
  Heart,
  MessageCircle,
  Send,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AVATAR_AHMED_PATH, AVATAR_NAWAF_PATH, AVATAR_RIAD_PATH, COVER_OCEAN_PATH } from '../data/seedData';
import { formatCompactNumber } from '../utils/format';

interface SquarePost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorFlag: string;
  authorLevel: number;
  time: string;
  content: string;
  image?: string;
  likes: number;
  liked: boolean;
  roomId?: string;
}

const INITIAL_POSTS: SquarePost[] = [
  {
    id: 'post-1',
    authorId: '900',
    authorName: 'رياض | Riad',
    authorAvatar: AVATAR_RIAD_PATH,
    authorFlag: '🇾🇪',
    authorLevel: 98,
    time: 'منذ 12 دقيقة',
    content: 'حياكم الله جميعاً في سهرة وكالة رياض الليلة — تحديات حية وجوائز كبرى للداعمين على المايك! 👑✨',
    likes: 412,
    liked: false,
    roomId: 'room-900',
  },
  {
    id: 'post-2',
    authorId: '51115',
    authorName: 'وكالة نواف للشحن',
    authorAvatar: AVATAR_NAWAF_PATH,
    authorFlag: '🇾🇪',
    authorLevel: 85,
    time: 'منذ 35 دقيقة',
    content: 'بونص الشحن الفوري +25% متاح الآن لجميع الباقات عبر الوكلاء المعتمدين! 🚀💎',
    image: COVER_OCEAN_PATH,
    likes: 289,
    liked: true,
    roomId: 'room-51115',
  },
  {
    id: 'post-3',
    authorId: '200016',
    authorName: 'الوكيل أحمد',
    authorAvatar: AVATAR_AHMED_PATH,
    authorFlag: '🇸🇦',
    authorLevel: 74,
    time: 'منذ ساعة',
    content: 'مبارك لأبطال جولات الـ PK اليوم، استمروا بالتفاعل لرفع مستواكم في الساحة!',
    likes: 164,
    liked: false,
    roomId: 'room-882001',
  },
];

export const SquareView: React.FC = () => {
  const { currentUser, setActiveTab, setActiveRoomId, openWallet, showToast } = useApp();
  const [posts, setPosts] = useState<SquarePost[]>(INITIAL_POSTS);
  const [newPostText, setNewPostText] = useState('');

  const handleToggleLike = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handlePublishPost = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPostText.trim();
    if (!clean) return;
    const post: SquarePost = {
      id: `post-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      authorFlag: currentUser.flag,
      authorLevel: currentUser.level,
      time: 'الآن',
      content: clean,
      likes: 1,
      liked: true,
    };
    setPosts((prev) => [post, ...prev]);
    setNewPostText('');
    showToast('تم نشر مشاركتك في الساحة بنجاح!', 'success');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header & Quick Shortcuts */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-display font-extrabold text-slate-900">ساحة اللحظات والتفاعل</h1>
          </div>
          <span className="text-xs font-semibold text-emerald-600">مباشر</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => openWallet('gold')}
            className="rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 cursor-pointer"
          >
            <Diamond className="w-4 h-4 text-amber-500" />
            <span>المحفظة والشحن</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('agencies')}
            className="rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>تحويل الأموال</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className="rounded-xl bg-violet-50 hover:bg-violet-100/80 border border-violet-200 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold text-violet-800 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-violet-600" />
            <span>المتجر الملكي</span>
          </button>
        </div>

        {/* Compose Post */}
        <form onSubmit={handlePublishPost} className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
          />
          <input
            type="text"
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="شارك لحظتك أو أعلن عن غرفتك في الساحة..."
            className="flex-1 h-10 px-3.5 rounded-full bg-slate-100 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-full bg-[#15D16B] hover:bg-[#12B95E] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>نشر</span>
          </button>
        </form>
      </div>

      {/* Moments Feed */}
      <div className="space-y-3.5">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-sm text-slate-900 truncate">
                      {post.authorName}
                    </span>
                    <span>{post.authorFlag}</span>
                    <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-mono-num text-[10px] font-bold">
                      Lv.{post.authorLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ID:{post.authorId} · {post.time}
                  </div>
                </div>
              </div>

              {post.roomId && (
                <button
                  type="button"
                  onClick={() => setActiveRoomId(post.roomId!)}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Flame className="w-3.5 h-3.5 text-emerald-500" />
                  <span>دخول الغرفة</span>
                </button>
              )}
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>

            {post.image && (
              <img
                src={post.image}
                alt={post.authorName}
                referrerPolicy="no-referrer"
                className="w-full max-h-64 object-cover rounded-2xl border border-slate-100"
              />
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleToggleLike(post.id)}
                  className={`flex items-center gap-1.5 font-semibold cursor-pointer ${
                    post.liked ? 'text-rose-500' : 'hover:text-rose-500'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.liked ? 'fill-rose-500' : ''}`} />
                  <span className="font-mono-num">{formatCompactNumber(post.likes)}</span>
                </button>
                <span className="flex items-center gap-1 text-slate-400">
                  <MessageCircle className="w-4 h-4" />
                  <span>تفاعل مباشر</span>
                </span>
              </div>
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Crown className="w-3.5 h-3.5" />
                <span>ساحة رياض</span>
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
