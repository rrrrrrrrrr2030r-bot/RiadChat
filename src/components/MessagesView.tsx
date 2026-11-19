import React, { useState } from 'react';
import { Bell, CheckCheck, MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AVATAR_AHMED_PATH, AVATAR_NAWAF_PATH, AVATAR_RIAD_PATH } from '../data/seedData';

interface ThreadMessage {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
}

interface ChatThread {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  role: string;
  unread: number;
  messages: ThreadMessage[];
}

const INITIAL_THREADS: ChatThread[] = [
  {
    id: 'th-1',
    userId: '10',
    name: 'إدارة رياض الرسمية',
    avatar: AVATAR_RIAD_PATH,
    role: 'إشعارات النظام',
    unread: 1,
    messages: [
      {
        id: 'tm-1',
        fromMe: false,
        text: 'مرحباً بك في تطبيق رياض شات! بونص الشحن +25% مفعّل الآن في قسم الوكالات.',
        time: '03:45 م',
      },
    ],
  },
  {
    id: 'th-2',
    userId: '200016',
    name: 'الوكيل أحمد',
    avatar: AVATAR_AHMED_PATH,
    role: 'وكيل شحن معتمد',
    unread: 2,
    messages: [
      {
        id: 'tm-2',
        fromMe: false,
        text: 'أهلاً، تم تفعيل باقات الشحن السريع لحسابك — تواصل معي لأي تحويل فوري.',
        time: '03:10 م',
      },
    ],
  },
  {
    id: 'th-3',
    userId: '51115',
    name: 'وكالة نواف للشحن',
    avatar: AVATAR_NAWAF_PATH,
    role: 'عميد الوكلاء',
    unread: 0,
    messages: [
      {
        id: 'tm-3',
        fromMe: false,
        text: 'تفضل بزيارة غرفتنا الصوتية للمشاركة في سحوبات الليلة!',
        time: 'أمس',
      },
    ],
  },
];

export const MessagesView: React.FC = () => {
  const { state, setActiveTab } = useApp();
  const [threads, setThreads] = useState<ChatThread[]>(INITIAL_THREADS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_THREADS[0].id);
  const [replyInput, setReplyInput] = useState('');

  const activeThread = threads.find((t) => t.id === selectedId) || threads[0];

  const handleSelectThread = (id: string) => {
    setSelectedId(id);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = replyInput.trim();
    if (!clean) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              messages: [
                ...t.messages,
                { id: `m-${Date.now()}`, fromMe: true, text: clean, time: 'الآن' },
              ],
            }
          : t
      )
    );
    setReplyInput('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Live System Banner */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-violet-600 via-white to-purple-500 shadow-[0_2px_10px_rgba(124,58,237,0.2)] flex items-center justify-center shrink-0">
            <span className="w-full h-full rounded-full bg-white text-violet-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900">إعلان النظام المباشر</div>
            <div className="text-xs text-slate-500 truncate">{state.globalAnnouncement}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('agencies')}
          className="px-3.5 py-2 rounded-full bg-[#15D16B] hover:bg-[#12B95E] text-white text-xs font-bold cursor-pointer shrink-0"
        >
          شحن الآن
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Threads List */}
        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/80 p-3 space-y-2 shadow-xs">
          <div className="px-2 py-1.5 flex items-center justify-between border-b border-slate-100">
            <h1 className="text-sm font-display font-extrabold text-slate-900 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <span>الرسائل والمحادثات</span>
            </h1>
            <span className="text-[11px] text-slate-400 font-mono-num">{threads.length} محادثات</span>
          </div>

          <div className="space-y-1">
            {threads.map((th) => {
              const active = th.id === activeThread.id;
              const lastMsg = th.messages[th.messages.length - 1];
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleSelectThread(th.id)}
                  className={`w-full rounded-xl p-2.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer ${
                    active ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={th.avatar}
                      alt={th.name}
                      referrerPolicy="no-referrer"
                      className={`w-11 h-11 rounded-full object-cover shrink-0 border-2 border-white ${
                        active ? 'ring-2 ring-violet-600' : 'ring-1 ring-violet-300'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {th.name}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {lastMsg?.text}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400">{lastMsg?.time}</span>
                    {th.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {th.unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Active Conversation */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/80 p-4 flex flex-col justify-between min-h-[340px] shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeThread.avatar}
                  alt={activeThread.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="font-display font-bold text-sm text-slate-900">
                    {activeThread.name}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold">
                    {activeThread.role} · ID:{activeThread.userId}
                  </div>
                </div>
              </div>
              <CheckCheck className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="py-4 space-y-3 max-h-[240px] overflow-y-auto">
              {activeThread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.fromMe ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed ${
                      m.fromMe
                        ? 'bg-[#15D16B] text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSendReply} className="pt-3 border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="flex-1 h-11 px-4 rounded-full bg-slate-100 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="submit"
              className="w-11 h-11 rounded-full bg-[#15D16B] hover:bg-[#12B95E] text-white flex items-center justify-center cursor-pointer shrink-0"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
