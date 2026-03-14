import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { init } from "@instantdb/react";

const db = init({ appId: "3c2e2979-96d6-4410-a4b4-62d753035a19" });

type ChatKind = "direct" | "group" | "channel";
type GroupRole = "owner" | "admin" | "member";
type ChannelKind = "chat" | "announcement";
type MessageKind = "text" | "image" | "file" | "poll" | "voice" | "audio";

type Profile = {
  id: string;
  userId: string;
  email: string;
  name: string;
  username: string;
  bio: string;
  status: string;
  avatar?: string;
  onboardingComplete?: boolean;
  createdAt: number;
  updatedAt: number;
};

type Friendship = {
  id: string;
  aUserId: string;
  bUserId: string;
  createdAt: number;
};

type Group = {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  joinCode: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
};

type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: number;
};

type Channel = {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  avatar?: string;
  kind: ChannelKind;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
};

type Message = {
  id: string;
  kind: MessageKind;
  chatType: ChatKind;
  chatId: string;
  fromUserId: string;
  text?: string;
  textColor?: string;
  fileName?: string;
  fileData?: string;
  fileType?: string;
  pollId?: string;
  deleted?: boolean;
  editedAt?: number;
  createdAt: number;
};

type Poll = {
  id: string;
  chatType: ChatKind;
  chatId: string;
  question: string;
  options: string[];
  createdBy: string;
  createdAt: number;
};

type PollVote = {
  id: string;
  pollId: string;
  userId: string;
  optionIndex: number;
};

type Activity = {
  id: string;
  chatType: ChatKind;
  chatId: string;
  userId: string;
  name: string;
  typing: boolean;
  uploading: boolean;
  updatedAt: number;
};

type Reaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: number;
};

type MessageView = {
  id: string;
  messageId: string;
  userId: string;
  seenAt: number;
};

type DirectModeration = {
  id: string;
  ownerUserId: string;
  targetUserId: string;
  banned: boolean;
  reportCount: number;
  lastReportReason?: string;
  updatedAt: number;
};

type GroupBan = {
  id: string;
  groupId: string;
  userId: string;
  bannedBy: string;
  createdAt: number;
};

type ChatPin = {
  id: string;
  chatType: ChatKind;
  chatId: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: number;
};

type ChatItem = {
  id: string;
  kind: ChatKind;
  title: string;
  subtitle: string;
  avatar?: string;
  groupId?: string;
};

const QUICK_EMOJIS = ["❤️", "🔥", "😂", "👍", "😮"];
const BETA_APPROVER_EMAILS = ["emaildotcome12@gmail.com", "emaildotcome13@gmail.com", "imoldestone@gmail.com"];
const BETA_ACCESS_CODE = "VAULT-QWER4-TYUI5";

type UiSettings = {
  theme: "light" | "warm" | "slate" | "ocean" | "rose";
  scale: number;
  labelScale: number;
  language: "ar" | "en";
  messageTextColor: string;
  autoScroll: boolean;
};

const DEFAULT_STABLE_SETTINGS: UiSettings = {
  theme: "light",
  scale: 106,
  labelScale: 112,
  language: "ar",
  messageTextColor: "#000000",
  autoScroll: true,
};

const DEFAULT_BETA_SETTINGS: UiSettings = {
  theme: "light",
  scale: 106,
  labelScale: 112,
  language: "ar",
  messageTextColor: "#000000",
  autoScroll: true,
};

function pairChatId(a: string, b: string) {
  return [a, b].sort().join("__");
}

function formatTime(ts: number) {
  return new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

function makeJoinCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function sanitizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getInitialUsername(userId: string) {
  return `user_${userId.slice(0, 6).toLowerCase()}`;
}

function isDefaultUsername(userId: string, username: string) {
  return sanitizeUsername(username) === getInitialUsername(userId);
}

function shouldReplaceProfile(current: Profile | undefined, candidate: Profile) {
  if (!current) {
    return true;
  }
  const currentScore =
    (current.onboardingComplete ? 4 : 0) +
    (current.name.trim() ? 2 : 0) +
    (current.avatar ? 1 : 0) +
    (isDefaultUsername(current.userId, current.username) ? 0 : 2);
  const candidateScore =
    (candidate.onboardingComplete ? 4 : 0) +
    (candidate.name.trim() ? 2 : 0) +
    (candidate.avatar ? 1 : 0) +
    (isDefaultUsername(candidate.userId, candidate.username) ? 0 : 2);
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore;
  }
  return candidate.updatedAt > current.updatedAt;
}

function readAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

function compressImageAsDataURL(file: File, maxSide = 1280, quality = 0.84) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const ratio = Math.min(maxSide / image.width, maxSide / image.height, 1);
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("تعذر تجهيز الصورة"));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = () => reject(new Error("تعذر تحميل الصورة"));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Avatar({ src, alt, size = "h-8 w-8" }: { src?: string; alt: string; size?: string }) {
  if (src) {
    return <img src={src} alt={alt} className={`${size} rounded-full border border-slate-200 object-cover`} />;
  }
  return <div className={`${size} rounded-full border border-slate-200 bg-slate-100`} aria-hidden="true" />;
}

function ChatKindGlyph({ kind }: { kind: ChatKind }) {
  if (kind === "group") {
    return <Icon className="h-3.5 w-3.5" path="M7.5 8.25a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0zm6.75 1.5a1.875 1.875 0 10-1.875-1.875M4.5 16.5a4.5 4.5 0 019 0m3 0a3.75 3.75 0 00-1.58-3.08" />;
  }
  if (kind === "channel") {
    return <Icon className="h-3.5 w-3.5" path="M4.5 7.5h15M4.5 12h15M4.5 16.5h9" />;
  }
  return <Icon className="h-3.5 w-3.5" path="M6.75 6.75h10.5v8.25H9.75L6.75 18V6.75z" />;
}

function MessageKindLabel({ kind }: { kind: MessageKind }) {
  if (kind === "text") {
    return null;
  }
  const meta =
    kind === "image"
      ? { text: "صورة", path: "M4.5 6.75h15v10.5h-15zM8.25 10.5h.008M19.5 14.25l-3.75-3.75-4.5 4.5-2.25-2.25-4.5 4.5" }
      : kind === "file"
        ? { text: "ملف", path: "M7.5 3.75h6l3 3v13.5h-9a3 3 0 01-3-3v-10.5a3 3 0 013-3zM13.5 3.75v3h3" }
        : kind === "poll"
          ? { text: "تصويت", path: "M4.5 6h15M4.5 12h15M4.5 18h9" }
          : kind === "audio"
            ? { text: "MP3", path: "M9 18V6.75l9-1.5V16.5M9 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm9-1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" }
            : { text: "صوت", path: "M12 4.5a2.25 2.25 0 012.25 2.25v4.5a2.25 2.25 0 11-4.5 0v-4.5A2.25 2.25 0 0112 4.5zM6.75 10.5a5.25 5.25 0 0010.5 0M12 15.75v3.75" };
  return (
    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
      <Icon className="h-3 w-3" path={meta.path} />
      {meta.text}
    </span>
  );
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("اكتب بريدك الإلكتروني أولاً");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await db.auth.sendMagicCode({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال الكود");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError("أدخل كود التحقق");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "الكود غير صحيح");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4" dir="rtl">
      <section className="w-full max-w-sm border border-slate-200 p-6 animate-panel-in">
        <h1 className="text-2xl font-semibold text-slate-900">Vault - ڤولت</h1>
        <p className="mt-1 text-sm text-slate-500">دخول بالبريد الإلكتروني عبر كود سحري.</p>

        <form className="mt-6 space-y-3" onSubmit={sendCode}>
          <label className="flex items-center gap-1 text-sm text-slate-700" htmlFor="email">
            <Icon path="M3.75 6.75h16.5v10.5H3.75zM3.75 8.25l8.25 5.25 8.25-5.25" />
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            placeholder="name@email.com"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "جاري الإرسال..." : "إرسال الكود"}
          </button>
        </form>

        {sent ? (
          <form className="mt-5 space-y-3" onSubmit={verifyCode}>
            <label className="flex items-center gap-1 text-sm text-slate-700" htmlFor="code">
              <Icon path="M15.75 7.5h-7.5A2.25 2.25 0 006 9.75v6A2.25 2.25 0 008.25 18h7.5A2.25 2.25 0 0018 15.75v-6A2.25 2.25 0 0015.75 7.5zM9.75 7.5V6a2.25 2.25 0 114.5 0v1.5" />
              كود التحقق
            </label>
            <input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              placeholder="123456"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {busy ? "جاري التحقق..." : "دخول"}
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}

function ProfileSetup({
  name,
  username,
  bio,
  status,
  avatar,
  busy,
  error,
  onChangeName,
  onChangeUsername,
  onChangeBio,
  onChangeStatus,
  onChangeAvatar,
  onSubmit,
}: {
  name: string;
  username: string;
  bio: string;
  status: string;
  avatar: string;
  busy: boolean;
  error: string;
  onChangeName: (value: string) => void;
  onChangeUsername: (value: string) => void;
  onChangeBio: (value: string) => void;
  onChangeStatus: (value: string) => void;
  onChangeAvatar: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4" dir="rtl">
      <section className="w-full max-w-lg border border-slate-200 p-6 animate-panel-in">
        <h2 className="text-xl font-semibold">إكمال الملف الشخصي - Vault - ڤولت</h2>
        <p className="mt-1 text-sm text-slate-500">يجب تخصيص الحساب قبل الدخول للتطبيق.</p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <div className="flex items-center gap-3">
            <Avatar src={avatar} alt="صورة الملف" size="h-14 w-14" />
            <label className="border border-slate-300 px-3 py-2 text-xs">
              رفع صورة الملف
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  try {
                    const imageData = await compressImageAsDataURL(file, 720, 0.8);
                    onChangeAvatar(imageData);
                  } catch {
                    onChangeAvatar(avatar);
                  } finally {
                    event.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          <input
            value={name}
            onChange={(event) => onChangeName(event.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-sm"
            placeholder="الاسم"
          />
          <input
            value={username}
            onChange={(event) => onChangeUsername(event.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-sm"
            placeholder="اسم المستخدم"
          />
          <input
            value={status}
            onChange={(event) => onChangeStatus(event.target.value)}
            className="w-full border border-slate-300 px-3 py-2 text-sm"
            placeholder="الحالة"
          />
          <textarea
            value={bio}
            onChange={(event) => onChangeBio(event.target.value)}
            className="h-24 w-full border border-slate-300 px-3 py-2 text-sm"
            placeholder="نبذة قصيرة"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "جاري الحفظ..." : "حفظ وفتح التطبيق"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function ChatApp({ userId, email }: { userId: string; email: string }) {
  const tx = db.tx as any;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [showBetaInfo, setShowBetaInfo] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatKind, setActiveChatKind] = useState<ChatKind>("direct");
  const [messageText, setMessageText] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelMode, setChannelMode] = useState<ChannelKind>("chat");
  const [channelGroupId, setChannelGroupId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileStatus, setProfileStatus] = useState("متاح");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [uiMessage, setUiMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const [schoolClassName, setSchoolClassName] = useState("");
  const [schoolTask, setSchoolTask] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [manageName, setManageName] = useState("");
  const [manageDescription, setManageDescription] = useState("");
  const [manageAvatar, setManageAvatar] = useState("");
  const [betaUnlockOpen, setBetaUnlockOpen] = useState(false);
  const [betaAccessInput, setBetaAccessInput] = useState("");
  const [betaUnlocked, setBetaUnlocked] = useState(false);
  const [stableSettings, setStableSettings] = useState<UiSettings>(DEFAULT_STABLE_SETTINGS);
  const [betaSettings, setBetaSettings] = useState<UiSettings>(DEFAULT_BETA_SETTINGS);
  const typingTimeout = useRef<number | undefined>(undefined);
  const lastProfileSyncRef = useRef(0);
  const profileCreateStartedRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const notificationPermissionAskedRef = useRef(false);
  const lastMessagesTimestampRef = useRef(0);
  const lastTypingStateRef = useRef(false);
  const manageSyncRef = useRef("");
  const lastChatMessageMetaRef = useRef<{ chatKey: string; count: number; lastId: string | null }>({
    chatKey: "",
    count: 0,
    lastId: null,
  });

  const activeSettings = betaEnabled ? betaSettings : stableSettings;
  const isArabic = activeSettings.language === "ar";
  const isBetaApprover = BETA_APPROVER_EMAILS.includes(email.toLowerCase());

  const { data, isLoading } = db.useQuery({
    profiles: {},
    friendships: {},
    groups: {},
    groupMembers: {},
    channels: {},
    messages: {},
    polls: {},
    pollVotes: {},
    activities: {},
    reactions: {},
    messageViews: {},
    directModerations: {},
    groupBans: {},
    chatPins: {},
  } as any);

  const rawProfiles = ((data as any)?.profiles ?? []) as Profile[];
  const friendships = ((data as any)?.friendships ?? []) as Friendship[];
  const groups = ((data as any)?.groups ?? []) as Group[];
  const groupMembers = ((data as any)?.groupMembers ?? []) as GroupMember[];
  const channels = ((data as any)?.channels ?? []) as Channel[];
  const messages = ((data as any)?.messages ?? []) as Message[];
  const polls = ((data as any)?.polls ?? []) as Poll[];
  const pollVotes = ((data as any)?.pollVotes ?? []) as PollVote[];
  const activities = ((data as any)?.activities ?? []) as Activity[];
  const reactions = ((data as any)?.reactions ?? []) as Reaction[];
  const messageViews = ((data as any)?.messageViews ?? []) as MessageView[];
  const directModerations = ((data as any)?.directModerations ?? []) as DirectModeration[];
  const groupBans = ((data as any)?.groupBans ?? []) as GroupBan[];
  const chatPins = ((data as any)?.chatPins ?? []) as ChatPin[];

  const profiles = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const profile of rawProfiles) {
      const existing = map.get(profile.userId);
      if (shouldReplaceProfile(existing, profile)) {
        map.set(profile.userId, profile);
      }
    }
    return Array.from(map.values());
  }, [rawProfiles]);

  const myProfile = profiles.find((profile) => profile.userId === userId);

  useEffect(() => {
    if (isLoading || myProfile || profileCreateStartedRef.current) {
      return;
    }
    profileCreateStartedRef.current = true;
    const now = Date.now();
    const profileId = crypto.randomUUID();
    void db
      .transact(
        tx.profiles[profileId].update({
          userId,
          email,
          name: "",
          username: getInitialUsername(userId),
          bio: "",
          status: "متاح",
          avatar: "",
          onboardingComplete: false,
          createdAt: now,
          updatedAt: now,
        })
      )
      .catch(() => {
        profileCreateStartedRef.current = false;
      });
  }, [email, isLoading, myProfile, tx, userId]);

  useEffect(() => {
    if (!myProfile) {
      return;
    }
    if (lastProfileSyncRef.current === myProfile.updatedAt) {
      return;
    }
    setProfileName(myProfile.name || "");
    setProfileUsername(myProfile.username || "");
    setProfileBio(myProfile.bio || "");
    setProfileStatus(myProfile.status || "متاح");
    setProfileAvatar(myProfile.avatar || "");
    lastProfileSyncRef.current = myProfile.updatedAt;
  }, [myProfile]);

  useEffect(() => {
    try {
      const stableRaw = window.localStorage.getItem("vault_stable_settings_v1");
      const betaRaw = window.localStorage.getItem("vault_beta_settings_v1");
      const unlockedRaw = window.localStorage.getItem("vault_beta_unlocked_v1");
      if (stableRaw) {
        setStableSettings({ ...DEFAULT_STABLE_SETTINGS, ...(JSON.parse(stableRaw) as Partial<UiSettings>) });
      }
      if (betaRaw) {
        setBetaSettings({ ...DEFAULT_BETA_SETTINGS, ...(JSON.parse(betaRaw) as Partial<UiSettings>) });
      }
      if (unlockedRaw === "1") {
        setBetaUnlocked(true);
      }
    } catch {
      // Ignore malformed local values.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("vault_stable_settings_v1", JSON.stringify(stableSettings));
  }, [stableSettings]);

  useEffect(() => {
    window.localStorage.setItem("vault_beta_settings_v1", JSON.stringify(betaSettings));
  }, [betaSettings]);

  useEffect(() => {
    window.localStorage.setItem("vault_beta_unlocked_v1", betaUnlocked ? "1" : "0");
  }, [betaUnlocked]);

  const profilesByUserId = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.userId, profile]));
  }, [profiles]);

  const myMembershipByGroup = useMemo(() => {
    const map = new Map<string, GroupMember>();
    for (const member of groupMembers) {
      if (member.userId === userId) {
        map.set(member.groupId, member);
      }
    }
    return map;
  }, [groupMembers, userId]);

  const friends = useMemo(() => {
    const friendIds = friendships
      .filter((friendship) => friendship.aUserId === userId || friendship.bUserId === userId)
      .map((friendship) => (friendship.aUserId === userId ? friendship.bUserId : friendship.aUserId));
    return profiles.filter((profile) => friendIds.includes(profile.userId));
  }, [friendships, profiles, userId]);

  const myGroups = useMemo(() => {
    const groupIds = new Set(groupMembers.filter((member) => member.userId === userId).map((member) => member.groupId));
    const bannedGroupIds = new Set(groupBans.filter((ban) => ban.userId === userId).map((ban) => ban.groupId));
    return groups.filter((group) => groupIds.has(group.id) && !bannedGroupIds.has(group.id));
  }, [groupBans, groupMembers, groups, userId]);

  const groupChannels = useMemo(() => {
    const allowedGroupIds = new Set(myGroups.map((group) => group.id));
    return channels.filter((channel) => allowedGroupIds.has(channel.groupId));
  }, [channels, myGroups]);

  const chatItems = useMemo(() => {
    const directItems: ChatItem[] = friends.map((friend) => ({
      id: pairChatId(userId, friend.userId),
      kind: "direct",
      title: friend.name || friend.username,
      subtitle: `@${friend.username}`,
      avatar: friend.avatar,
    }));
    const groupItems: ChatItem[] = myGroups.map((group) => ({
      id: group.id,
      kind: "group",
      title: group.name,
      subtitle: `مجموعة - رمز ${group.joinCode}`,
      avatar: group.avatar,
    }));
    const channelItems: ChatItem[] = groupChannels.map((channel) => {
      const group = groups.find((item) => item.id === channel.groupId);
      return {
        id: channel.id,
        kind: "channel",
        title: `${group?.name || "مجموعة"} / ${channel.name}`,
        subtitle: channel.kind === "announcement" ? "قناة إعلان" : "قناة نقاش",
        avatar: channel.avatar,
        groupId: channel.groupId,
      };
    });
    return [...directItems, ...groupItems, ...channelItems];
  }, [friends, groupChannels, groups, myGroups, userId]);

  useEffect(() => {
    if (!activeChatId && chatItems.length > 0) {
      setActiveChatId(chatItems[0].id);
      setActiveChatKind(chatItems[0].kind);
    }
  }, [activeChatId, chatItems]);

  useEffect(() => {
    if (!channelGroupId && myGroups.length > 0) {
      setChannelGroupId(myGroups[0].id);
    }
  }, [channelGroupId, myGroups]);

  const currentChat = chatItems.find((item) => item.id === activeChatId && item.kind === activeChatKind) ?? null;

  const activeMessages = useMemo(() => {
    if (!activeChatId) {
      return [];
    }
    return messages
      .filter((message) => message.chatType === activeChatKind && message.chatId === activeChatId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [activeChatId, activeChatKind, messages]);

  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const reaction of reactions) {
      const current = map.get(reaction.messageId) ?? [];
      current.push(reaction);
      map.set(reaction.messageId, current);
    }
    return map;
  }, [reactions]);

  const viewersByMessageId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const view of messageViews) {
      const current = map.get(view.messageId) ?? [];
      const viewer = profilesByUserId.get(view.userId);
      current.push(viewer?.name || viewer?.username || "مستخدم");
      map.set(view.messageId, current);
    }
    return map;
  }, [messageViews, profilesByUserId]);

  const activePolls = useMemo(() => {
    if (!activeChatId) {
      return [];
    }
    return polls.filter((poll) => poll.chatType === activeChatKind && poll.chatId === activeChatId);
  }, [activeChatId, activeChatKind, polls]);

  const pollVotesByPollId = useMemo(() => {
    const map = new Map<string, PollVote[]>();
    for (const vote of pollVotes) {
      const current = map.get(vote.pollId) ?? [];
      current.push(vote);
      map.set(vote.pollId, current);
    }
    return map;
  }, [pollVotes]);

  const activeChannel = useMemo(() => {
    if (activeChatKind !== "channel" || !activeChatId) {
      return null;
    }
    return channels.find((channel) => channel.id === activeChatId) ?? null;
  }, [activeChatId, activeChatKind, channels]);

  const activeGroupId = activeChatKind === "group" ? activeChatId : activeChannel?.groupId || null;
  const activeGroup = activeGroupId ? groups.find((group) => group.id === activeGroupId) ?? null : null;

  const myRoleInActiveChannelGroup = useMemo(() => {
    if (!activeChannel) {
      return null;
    }
    return myMembershipByGroup.get(activeChannel.groupId)?.role ?? null;
  }, [activeChannel, myMembershipByGroup]);

  const myRoleInActiveGroup = activeGroupId ? myMembershipByGroup.get(activeGroupId)?.role ?? null : null;
  const isGroupOwner = myRoleInActiveGroup === "owner" || (activeGroup?.createdBy === userId && activeGroupId !== null);
  const isGroupAdmin = myRoleInActiveGroup === "admin";
  const canManageGroup = isGroupOwner || isGroupAdmin;
  const canManageCurrentChannel = activeChatKind === "channel" && activeChannel ? canManageGroup || activeChannel.createdBy === userId : false;
  const canModerateActive = activeChatKind === "channel" ? canManageCurrentChannel : canManageGroup;

  const activeMembers = useMemo(() => {
    if (!activeGroupId) {
      return [];
    }
    return groupMembers
      .filter((member) => member.groupId === activeGroupId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }, [activeGroupId, groupMembers]);

  const activeGroupBans = useMemo(() => {
    if (!activeGroupId) {
      return [];
    }
    return groupBans.filter((ban) => ban.groupId === activeGroupId);
  }, [activeGroupId, groupBans]);

  const activeDirectPeerId = useMemo(() => {
    if (activeChatKind !== "direct" || !activeChatId) {
      return null;
    }
    const [a, b] = activeChatId.split("__");
    return a === userId ? b : b === userId ? a : null;
  }, [activeChatId, activeChatKind, userId]);

  const activeDirectPeer = activeDirectPeerId ? profilesByUserId.get(activeDirectPeerId) ?? null : null;
  const directModerationMine = directModerations.find(
    (item) => item.ownerUserId === userId && item.targetUserId === activeDirectPeerId
  );
  const directModerationByPeer = directModerations.find(
    (item) => item.ownerUserId === activeDirectPeerId && item.targetUserId === userId
  );
  const isDirectBlocked = Boolean(directModerationMine?.banned || directModerationByPeer?.banned);

  const activePin = activeChatId
    ? chatPins.find((pin) => pin.chatType === activeChatKind && pin.chatId === activeChatId) ?? null
    : null;

  const canSendMessage =
    !isDirectBlocked &&
    (activeChatKind !== "channel" ||
      !activeChannel ||
      myRoleInActiveChannelGroup === "owner" ||
      myRoleInActiveChannelGroup === "admin");

  const canSendToChat = useCallback(
    (kind: ChatKind, chatId: string) => {
      if (kind === "direct") {
        const [a, b] = chatId.split("__");
        const peerId = a === userId ? b : b === userId ? a : null;
        if (!peerId) {
          return false;
        }
        const mine = directModerations.find((item) => item.ownerUserId === userId && item.targetUserId === peerId);
        const peer = directModerations.find((item) => item.ownerUserId === peerId && item.targetUserId === userId);
        return !(mine?.banned || peer?.banned);
      }
      if (kind === "group") {
        return groupMembers.some((member) => member.groupId === chatId && member.userId === userId);
      }
      const channel = channels.find((item) => item.id === chatId);
      if (!channel) {
        return false;
      }
      const role = myMembershipByGroup.get(channel.groupId)?.role;
      const groupOwner = groups.find((group) => group.id === channel.groupId)?.createdBy === userId;
      return role === "owner" || role === "admin" || groupOwner;
    },
    [channels, directModerations, groupMembers, groups, myMembershipByGroup, userId]
  );

  const peerActivity = useMemo(() => {
    if (!activeChatId) {
      return [];
    }
    const now = Date.now();
    return activities.filter(
      (entry) =>
        entry.chatType === activeChatKind &&
        entry.chatId === activeChatId &&
        entry.userId !== userId &&
        now - entry.updatedAt < 6500 &&
        (entry.typing || entry.uploading)
    );
  }, [activeChatId, activeChatKind, activities, userId]);

  const typingNames = peerActivity.filter((entry) => entry.typing).map((entry) => entry.name);
  const uploadingNames = peerActivity.filter((entry) => entry.uploading).map((entry) => entry.name);

  const hasCompletedOnboarding = Boolean(
    myProfile?.onboardingComplete && myProfile.name.trim() && myProfile.username.trim()
  );

  const safeSyncActivity = async (typing: boolean, uploading: boolean) => {
    if (!activeChatId || !myProfile) {
      return;
    }
    try {
      const activityId = `${activeChatKind}_${activeChatId}_${userId}`;
      await db.transact(
        tx.activities[activityId].update({
          chatType: activeChatKind,
          chatId: activeChatId,
          userId,
          name: myProfile.name || myProfile.username,
          typing,
          uploading,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // Keep chat usable even if activity writes fail.
    }
  };

  const saveProfile = async (event: FormEvent, completeOnboarding: boolean) => {
    event.preventDefault();
    if (!myProfile) {
      return;
    }

    const username = sanitizeUsername(profileUsername);
    if (!profileName.trim() || !username) {
      setUiMessage("الاسم واسم المستخدم مطلوبان");
      return;
    }
    const clash = profiles.some(
      (profile) => profile.userId !== userId && sanitizeUsername(profile.username) === username
    );
    if (clash) {
      setUiMessage("اسم المستخدم مستخدم بالفعل");
      return;
    }

    try {
      setSavingProfile(true);
      const now = Date.now();
      const nextValues = {
        name: profileName.trim(),
        username,
        bio: profileBio.trim(),
        status: profileStatus.trim() || "متاح",
        avatar: profileAvatar,
        onboardingComplete: completeOnboarding ? true : myProfile.onboardingComplete || false,
        updatedAt: now,
      };
      const ownProfileDocs = rawProfiles.filter((profile) => profile.userId === userId);
      const txSteps = ownProfileDocs.length
        ? ownProfileDocs.map((profile) => tx.profiles[profile.id].update(nextValues))
        : [tx.profiles[myProfile.id].update(nextValues)];
      await db.transact(txSteps);
      setProfileName(nextValues.name);
      setProfileUsername(nextValues.username);
      setProfileBio(nextValues.bio);
      setProfileStatus(nextValues.status);
      setUiMessage("تم حفظ الملف الشخصي");
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر حفظ الملف الشخصي");
    } finally {
      setSavingProfile(false);
    }
  };

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    if (audioContextRef.current) {
      return audioContextRef.current;
    }
    const audioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioCtor) {
      return null;
    }
    audioContextRef.current = new audioCtor();
    return audioContextRef.current;
  }, []);

  const playUiTone = useCallback(
    (frequency: number, duration = 0.05, volume = 0.035) => {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }
      if (context.state === "suspended") {
        void context.resume();
      }
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(context.destination);
      const now = context.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    },
    [ensureAudioContext]
  );

  const playClickSound = useCallback(() => {
    playUiTone(540, 0.04, 0.02);
  }, [playUiTone]);

  const playIncomingMessageSound = useCallback(() => {
    playUiTone(780, 0.06, 0.03);
    window.setTimeout(() => playUiTone(980, 0.06, 0.025), 70);
  }, [playUiTone]);

  const addFriendByUser = async (target: Profile) => {
    if (target.userId === userId) {
      return;
    }
    const exists = friendships.some(
      (friendship) =>
        (friendship.aUserId === userId && friendship.bUserId === target.userId) ||
        (friendship.bUserId === userId && friendship.aUserId === target.userId)
    );
    if (exists) {
      setUiMessage("هذا المستخدم ضمن الأصدقاء بالفعل");
      return;
    }
    await db.transact(
      tx.friendships[crypto.randomUUID()].update({
        aUserId: userId,
        bUserId: target.userId,
        createdAt: Date.now(),
      })
    );
    setUiMessage(`تمت إضافة ${target.name || target.username} كصديق`);
  };

  const addFriendByUsername = async (event: FormEvent) => {
    event.preventDefault();
    const username = sanitizeUsername(friendUsername);
    const target = profiles.find((profile) => sanitizeUsername(profile.username) === username);
    if (!target) {
      setUiMessage("المستخدم غير موجود");
      return;
    }
    await addFriendByUser(target);
    setFriendUsername("");
  };

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!groupName.trim()) {
      return;
    }
    try {
      const now = Date.now();
      const groupId = crypto.randomUUID();
      const join = makeJoinCode();
      const generalChannelId = crypto.randomUUID();
      const announceChannelId = crypto.randomUUID();
      await db.transact([
        tx.groups[groupId].update({
          name: groupName.trim(),
          description: "",
          avatar: "",
          joinCode: join,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        }),
        tx.groupMembers[crypto.randomUUID()].update({
          groupId,
          userId,
          role: "owner",
          joinedAt: now,
        }),
        tx.channels[generalChannelId].update({
          groupId,
          name: "عام",
          description: "",
          avatar: "",
          kind: "chat",
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        }),
        tx.channels[announceChannelId].update({
          groupId,
          name: "إعلانات",
          description: "",
          avatar: "",
          kind: "announcement",
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        }),
      ]);
      setGroupName("");
      setUiMessage(`تم إنشاء المجموعة. رمز الانضمام: ${join}`);
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر إنشاء المجموعة");
    }
  };

  const joinGroup = async (event: FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    const target = groups.find((group) => group.joinCode === code);
    if (!target) {
      setUiMessage("رمز الانضمام غير صحيح");
      return;
    }
    const isBanned = groupBans.some((ban) => ban.groupId === target.id && ban.userId === userId);
    if (isBanned) {
      setUiMessage("تم حظرك من هذه المجموعة");
      return;
    }
    const already = groupMembers.some((member) => member.groupId === target.id && member.userId === userId);
    if (already) {
      setUiMessage("أنت منضم بالفعل لهذه المجموعة");
      return;
    }
    try {
      await db.transact(
        tx.groupMembers[crypto.randomUUID()].update({
          groupId: target.id,
          userId,
          role: "member",
          joinedAt: Date.now(),
        })
      );
      setJoinCode("");
      setUiMessage(`تم الانضمام إلى ${target.name}`);
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر الانضمام للمجموعة");
    }
  };

  const createChannel = async (event: FormEvent) => {
    event.preventDefault();
    if (!channelName.trim() || !channelGroupId) {
      setUiMessage("اختر مجموعة واكتب اسم القناة أولاً");
      return;
    }
    const myRole = myMembershipByGroup.get(channelGroupId)?.role;
    const selectedGroup = groups.find((group) => group.id === channelGroupId);
    const derivedRole: GroupRole | null = myRole || (selectedGroup?.createdBy === userId ? "owner" : null);
    if (derivedRole !== "owner" && derivedRole !== "admin") {
      setUiMessage("فقط المالك أو المشرف يمكنه إنشاء قناة");
      return;
    }
    try {
      const now = Date.now();
      await db.transact(
        tx.channels[crypto.randomUUID()].update({
          groupId: channelGroupId,
          name: channelName.trim(),
          description: channelDescription.trim(),
          avatar: "",
          kind: channelMode,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        })
      );
      setUiMessage("تم إنشاء القناة");
      setChannelName("");
      setChannelDescription("");
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر إنشاء القناة");
    }
  };

  const startDirectChat = (targetUserId: string) => {
    setActiveChatKind("direct");
    setActiveChatId(pairChatId(userId, targetUserId));
    setPeopleOpen(false);
  };

  useEffect(() => {
    if (activeChatKind === "group" && activeGroup) {
      const syncKey = `group:${activeGroup.id}:${activeGroup.updatedAt || activeGroup.createdAt}`;
      if (manageSyncRef.current === syncKey) {
        return;
      }
      setManageName(activeGroup.name || "");
      setManageDescription(activeGroup.description || "");
      setManageAvatar(activeGroup.avatar || "");
      manageSyncRef.current = syncKey;
      return;
    }
    if (activeChatKind === "channel" && activeChannel) {
      const syncKey = `channel:${activeChannel.id}:${activeChannel.updatedAt || activeChannel.createdAt}`;
      if (manageSyncRef.current === syncKey) {
        return;
      }
      setManageName(activeChannel.name || "");
      setManageDescription(activeChannel.description || "");
      setManageAvatar(activeChannel.avatar || "");
      manageSyncRef.current = syncKey;
      return;
    }
    setManageName("");
    setManageDescription("");
    setManageAvatar("");
    manageSyncRef.current = "";
  }, [activeChannel, activeChatKind, activeGroup]);

  const handleBetaToggle = () => {
    if (betaEnabled) {
      setBetaEnabled(false);
      return;
    }
    if (betaUnlocked) {
      setBetaEnabled(true);
      return;
    }
    setBetaUnlockOpen(true);
  };

  const unlockBetaWithCode = () => {
    if (betaAccessInput.trim().toUpperCase() !== BETA_ACCESS_CODE) {
      setUiMessage("كود بيتا غير صحيح");
      return;
    }
    setBetaUnlocked(true);
    setBetaEnabled(true);
    setBetaUnlockOpen(false);
    setBetaAccessInput("");
    setUiMessage("تم فتح بيتا بنجاح");
  };

  const reportDirectUser = async () => {
    if (!activeDirectPeerId) {
      return;
    }
    const reason = window.prompt("سبب الإبلاغ", "إساءة أو محتوى غير مناسب") || "بلاغ بدون تفاصيل";
    const id = `${userId}_${activeDirectPeerId}`;
    await db.transact(
      tx.directModerations[id].update({
        ownerUserId: userId,
        targetUserId: activeDirectPeerId,
        banned: directModerationMine?.banned || false,
        reportCount: (directModerationMine?.reportCount || 0) + 1,
        lastReportReason: reason,
        updatedAt: Date.now(),
      })
    );
    setUiMessage("تم إرسال البلاغ");
  };

  const setDirectBan = async (value: boolean) => {
    if (!activeDirectPeerId) {
      return;
    }
    const id = `${userId}_${activeDirectPeerId}`;
    await db.transact(
      tx.directModerations[id].update({
        ownerUserId: userId,
        targetUserId: activeDirectPeerId,
        banned: value,
        reportCount: directModerationMine?.reportCount || 0,
        lastReportReason: directModerationMine?.lastReportReason || "",
        updatedAt: Date.now(),
      })
    );
    setUiMessage(value ? "تم حظر المستخدم في المحادثة الخاصة" : "تم فك الحظر");
  };

  const saveCurrentChatProfile = async () => {
    if (!activeChatId || !manageName.trim()) {
      setUiMessage("الاسم مطلوب");
      return;
    }
    try {
      if (activeChatKind === "group") {
        if (!canManageGroup) {
          setUiMessage("فقط المالك أو المشرف يمكنه تعديل المجموعة");
          return;
        }
        await db.transact(
          tx.groups[activeChatId].update({
            name: manageName.trim(),
            description: manageDescription.trim(),
            avatar: manageAvatar,
            updatedAt: Date.now(),
          })
        );
        setUiMessage("تم تحديث بيانات المجموعة");
        return;
      }
      if (activeChatKind === "channel" && activeChannel) {
        const canEditChannel = canManageGroup || activeChannel.createdBy === userId;
        if (!canEditChannel) {
          setUiMessage("لا تملك صلاحية تعديل القناة");
          return;
        }
        await db.transact(
          tx.channels[activeChannel.id].update({
            name: manageName.trim(),
            description: manageDescription.trim(),
            avatar: manageAvatar,
            updatedAt: Date.now(),
          })
        );
        setUiMessage("تم تحديث بيانات القناة");
      }
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر حفظ بيانات المجموعة/القناة");
    }
  };

  const setMemberRole = async (member: GroupMember, role: GroupRole) => {
    if (!activeGroupId || !isGroupOwner || member.userId === userId) {
      return;
    }
    await db.transact(tx.groupMembers[member.id].update({ role }));
  };

  const kickMember = async (member: GroupMember) => {
    if (!activeGroupId || !canModerateActive || member.role === "owner") {
      return;
    }
    await db.transact(tx.groupMembers[member.id].delete());
    setUiMessage("تم طرد العضو");
  };

  const banMember = async (member: GroupMember) => {
    if (!activeGroupId || !canModerateActive || member.role === "owner") {
      return;
    }
    await db.transact([
      tx.groupBans[`${activeGroupId}_${member.userId}`].update({
        groupId: activeGroupId,
        userId: member.userId,
        bannedBy: userId,
        createdAt: Date.now(),
      }),
      tx.groupMembers[member.id].delete(),
    ]);
    setUiMessage("تم حظر العضو من المجموعة");
  };

  const unbanGroupUser = async (targetUserId: string) => {
    if (!activeGroupId || !canModerateActive) {
      return;
    }
    await db.transact(tx.groupBans[`${activeGroupId}_${targetUserId}`].delete());
    setUiMessage("تم فك الحظر عن المستخدم");
  };

  const togglePinMessage = async (messageId: string) => {
    if (!activeChatId) {
      return;
    }
    const canPin = activeChatKind === "direct" || canManageGroup;
    if (!canPin) {
      setUiMessage("تثبيت الرسائل متاح للمشرفين/المالك هنا");
      return;
    }
    const pinId = `${activeChatKind}_${activeChatId}`;
    if (activePin?.messageId === messageId) {
      await db.transact(tx.chatPins[pinId].delete());
      return;
    }
    await db.transact(
      tx.chatPins[pinId].update({
        chatType: activeChatKind,
        chatId: activeChatId,
        messageId,
        pinnedBy: userId,
        pinnedAt: Date.now(),
      })
    );
  };

  const onTyping = (value: string) => {
    setMessageText(value);
    if (!activeChatId) {
      return;
    }
    void safeSyncActivity(value.length > 0, false);
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = window.setTimeout(() => {
      void safeSyncActivity(false, false);
    }, 1400);
  };

  const sendTextMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeChatId || !messageText.trim()) {
      return;
    }
    if (!canSendMessage) {
      setUiMessage(activeChatKind === "direct" ? "لا يمكنك الإرسال في هذه المحادثة الخاصة حالياً" : "في القنوات: الكتابة للمالك والمشرفين فقط.");
      return;
    }
    try {
      const rawText = messageText.trim();
      if (rawText === "/help") {
        setUiMessage("الأوامر: /mention username النص");
        return;
      }
      let finalText = rawText;
      if (rawText.startsWith("/mention ")) {
        const parts = rawText.split(/\s+/);
        const mentionUser = sanitizeUsername(parts[1] || "");
        const mentionBody = rawText.replace(/^\/mention\s+\S+\s*/i, "").trim();
        const mentionedProfile = profiles.find((profile) => sanitizeUsername(profile.username) === mentionUser);
        if (!mentionedProfile || !mentionBody) {
          setUiMessage("صيغة الأمر: /mention username النص");
          return;
        }
        finalText = `@${mentionedProfile.username} ${mentionBody}`;
      }

      await db.transact(
        tx.messages[crypto.randomUUID()].update({
          kind: "text",
          chatType: activeChatKind,
          chatId: activeChatId,
          fromUserId: userId,
          text: finalText,
          textColor: activeSettings.messageTextColor,
          deleted: false,
          createdAt: Date.now(),
        })
      );
      setMessageText("");
      await safeSyncActivity(false, false);
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر إرسال الرسالة");
    }
  };

  const sendUpload = async (event: ChangeEvent<HTMLInputElement>, uploadKind: "image" | "file" | "audio") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeChatId) {
      if (!activeChatId) {
        setUiMessage("اختر محادثة أولاً ثم ارفع الملف");
      }
      return;
    }
    if (!canSendMessage) {
      setUiMessage("في القنوات: الرفع للمالك والمشرفين فقط");
      return;
    }
    if (uploadBusy) {
      return;
    }
    try {
      setUploadBusy(true);
      setUiMessage("");
      await safeSyncActivity(false, true);

      let fileData = "";
      if (uploadKind === "image") {
        if (!file.type.startsWith("image/")) {
          throw new Error("هذا الملف ليس صورة");
        }
        if (file.size > 8_000_000) {
          throw new Error("الصورة كبيرة جداً");
        }
        fileData = await compressImageAsDataURL(file, 1024, 0.8);
        if (fileData.length > 2_600_000) {
          throw new Error("الصورة ما زالت كبيرة، جرب صورة أصغر");
        }
      } else if (uploadKind === "audio") {
        const isMp3 = file.type === "audio/mpeg" || file.type === "audio/mp3" || file.name.toLowerCase().endsWith(".mp3");
        if (!isMp3) {
          throw new Error("يرجى اختيار ملف MP3 فقط");
        }
        if (file.size > 5_000_000) {
          throw new Error("ملف MP3 كبير. الحد 5MB تقريباً");
        }
        fileData = await readAsDataURL(file);
        if (fileData.length > 7_500_000) {
          throw new Error("تعذر رفع ملف MP3 بسبب الحجم");
        }
      } else {
        if (file.size > 1_200_000) {
          throw new Error("الملف كبير. الحد 1.2MB تقريباً");
        }
        fileData = await readAsDataURL(file);
        if (fileData.length > 2_000_000) {
          throw new Error("تعذر رفع الملف بسبب الحجم");
        }
      }

      if (!fileData) {
        throw new Error("فشل تجهيز الملف قبل الإرسال");
      }

      await db.transact(
        tx.messages[crypto.randomUUID()].update({
          kind: uploadKind,
          chatType: activeChatKind,
          chatId: activeChatId,
          fromUserId: userId,
          fileName: file.name,
          fileType: file.type,
          fileData,
          deleted: false,
          createdAt: Date.now(),
        })
      );
      setUiMessage(uploadKind === "image" ? "تم إرسال الصورة" : uploadKind === "audio" ? "تم إرسال ملف MP3" : "تم إرسال الملف");
    } catch (err) {
      setUiMessage(err instanceof Error ? err.message : "تعذر رفع الملف");
    } finally {
      setUploadBusy(false);
      void safeSyncActivity(false, false);
    }
  };

  const sendPoll = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeChatId) {
      return;
    }
    if (!canSendMessage) {
      setUiMessage("في القنوات: إنشاء التصويت للمالك والمشرفين فقط");
      return;
    }
    const options = pollOptions.map((option) => option.trim()).filter((option) => option.length > 0);
    if (!pollQuestion.trim() || options.length < 2) {
      setUiMessage("سؤال التصويت يحتاج خيارين على الأقل");
      return;
    }
    const pollId = crypto.randomUUID();
    await db.transact([
      tx.polls[pollId].update({
        chatType: activeChatKind,
        chatId: activeChatId,
        question: pollQuestion.trim(),
        options,
        createdBy: userId,
        createdAt: Date.now(),
      }),
      tx.messages[crypto.randomUUID()].update({
        kind: "poll",
        chatType: activeChatKind,
        chatId: activeChatId,
        fromUserId: userId,
        pollId,
        deleted: false,
        createdAt: Date.now(),
      }),
    ]);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollOpen(false);
  };

  const votePoll = async (pollId: string, optionIndex: number) => {
    const mine = pollVotes.find((vote) => vote.pollId === pollId && vote.userId === userId);
    if (mine) {
      await db.transact(tx.pollVotes[mine.id].update({ optionIndex }));
      return;
    }
    await db.transact(
      tx.pollVotes[crypto.randomUUID()].update({
        pollId,
        userId,
        optionIndex,
      })
    );
  };

  const deleteOwnMessage = async (message: Message) => {
    if (message.fromUserId !== userId) {
      return;
    }
    await db.transact(
      tx.messages[message.id].update({
        deleted: true,
        text: "",
        fileData: "",
        fileName: "",
        fileType: "",
        editedAt: Date.now(),
      })
    );
    if (editMessageId === message.id) {
      setEditMessageId(null);
      setEditText("");
    }
  };

  const saveMessageEdit = async (messageId: string) => {
    if (!editText.trim()) {
      return;
    }
    await db.transact(
      tx.messages[messageId].update({
        text: editText.trim(),
        editedAt: Date.now(),
      })
    );
    setEditMessageId(null);
    setEditText("");
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const mine = reactions.find((reaction) => reaction.messageId === messageId && reaction.userId === userId);
    if (mine && mine.emoji === emoji) {
      await db.transact(tx.reactions[mine.id].delete());
      return;
    }
    if (mine) {
      await db.transact(tx.reactions[mine.id].update({ emoji, createdAt: Date.now() }));
      return;
    }
    await db.transact(
      tx.reactions[crypto.randomUUID()].update({
        messageId,
        userId,
        emoji,
        createdAt: Date.now(),
      })
    );
  };

  const forwardMessage = async (message: Message) => {
    const destinations = chatItems.filter((item) => !(item.kind === activeChatKind && item.id === activeChatId));
    if (destinations.length === 0) {
      setUiMessage("لا توجد محادثات أخرى للتحويل");
      return;
    }
    const listing = destinations.map((item, index) => `${index + 1}. ${item.title} (${item.kind})`).join("\n");
    const pick = window.prompt(`اختر رقم المحادثة للتحويل:\n${listing}`, "1");
    const index = Number(pick || "0") - 1;
    if (!Number.isInteger(index) || index < 0 || index >= destinations.length) {
      return;
    }
    const destination = destinations[index];
    if (!canSendToChat(destination.kind, destination.id)) {
      setUiMessage("لا تملك صلاحية الإرسال إلى المحادثة المحددة");
      return;
    }

    if (message.kind === "poll" && message.pollId) {
      const sourcePoll = polls.find((item) => item.id === message.pollId);
      if (!sourcePoll) {
        setUiMessage("تعذر العثور على التصويت الأصلي");
        return;
      }
      const pollId = crypto.randomUUID();
      await db.transact([
        tx.polls[pollId].update({
          chatType: destination.kind,
          chatId: destination.id,
          question: sourcePoll.question,
          options: sourcePoll.options,
          createdBy: userId,
          createdAt: Date.now(),
        }),
        tx.messages[crypto.randomUUID()].update({
          kind: "poll",
          chatType: destination.kind,
          chatId: destination.id,
          fromUserId: userId,
          pollId,
          deleted: false,
          createdAt: Date.now(),
        }),
      ]);
      setUiMessage("تم تحويل التصويت");
      return;
    }

    await db.transact(
      tx.messages[crypto.randomUUID()].update({
        kind: message.kind,
        chatType: destination.kind,
        chatId: destination.id,
        fromUserId: userId,
        text: message.text || (message.kind !== "text" ? `تم تحويل رسالة ${message.kind}` : ""),
        textColor: message.textColor || "#000000",
        fileName: message.fileName || "",
        fileType: message.fileType || "",
        fileData: message.fileData || "",
        deleted: false,
        createdAt: Date.now(),
      })
    );
    setUiMessage("تم تحويل الرسالة");
  };

  const renderMessageText = (text: string, color?: string) => {
    const parts = text.split(/(@[a-z0-9_]+)/gi);
    return (
      <p style={{ color: color || "#0f172a" }}>
        {parts.map((part, index) =>
          /^@[a-z0-9_]+$/i.test(part) ? (
            <span key={`${part}-${index}`} className="font-semibold text-blue-700">
              {part}
            </span>
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          )
        )}
      </p>
    );
  };

  const toggleVoiceRecord = async () => {
    if (!activeChatId || !canSendMessage) {
      setUiMessage("اختر محادثة متاحة للإرسال أولاً");
      return;
    }
    if (!recording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (evt) => {
          if (evt.data.size > 0) {
            audioChunksRef.current.push(evt.data);
          }
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (audioChunksRef.current.length === 0) {
            return;
          }
          try {
            setRecordBusy(true);
            await safeSyncActivity(false, true);
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            const fileData = await readAsDataURL(new File([blob], `voice_${Date.now()}.webm`, { type: "audio/webm" }));
            await db.transact(
              tx.messages[crypto.randomUUID()].update({
                kind: "voice",
                chatType: activeChatKind,
                chatId: activeChatId,
                fromUserId: userId,
                fileName: `voice_${Date.now()}.webm`,
                fileType: "audio/webm",
                fileData,
                deleted: false,
                createdAt: Date.now(),
              })
            );
            setUiMessage("تم إرسال المقطع الصوتي");
          } catch (err) {
            setUiMessage(err instanceof Error ? err.message : "تعذر إرسال المقطع الصوتي");
          } finally {
            setRecordBusy(false);
            await safeSyncActivity(false, false);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
      } catch {
        setUiMessage("تعذر الوصول للمايكروفون");
      }
      return;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  useEffect(() => {
    const chatKey = activeChatId ? `${activeChatKind}:${activeChatId}` : "";
    const container = messagesContainerRef.current;
    const lastMessage = activeMessages[activeMessages.length - 1];
    const lastId = lastMessage?.id ?? null;
    const prev = lastChatMessageMetaRef.current;
    const sameChat = prev.chatKey === chatKey;
    const hasNewMessage = Boolean(sameChat && activeMessages.length > prev.count && lastId && lastId !== prev.lastId);

    if (hasNewMessage && activeSettings.autoScroll && container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }

    if (hasNewMessage && lastMessage?.fromUserId && lastMessage.fromUserId !== userId) {
      playIncomingMessageSound();
    }

    lastChatMessageMetaRef.current = {
      chatKey,
      count: activeMessages.length,
      lastId,
    };
  }, [activeChatId, activeChatKind, activeMessages, activeSettings.autoScroll, playIncomingMessageSound, userId]);

  useEffect(() => {
    const onGlobalButtonClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("button")) {
        playClickSound();
      }
    };

    document.addEventListener("click", onGlobalButtonClick, true);
    return () => {
      document.removeEventListener("click", onGlobalButtonClick, true);
    };
  }, [playClickSound]);

  useEffect(() => {
    const nowTyping = typingNames.length > 0;
    if (nowTyping && !lastTypingStateRef.current) {
      playUiTone(640, 0.03, 0.012);
    }
    lastTypingStateRef.current = nowTyping;
  }, [playUiTone, typingNames]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    if (lastMessagesTimestampRef.current === 0) {
      lastMessagesTimestampRef.current = Math.max(...messages.map((item) => item.createdAt));
      return;
    }

    const incoming = messages
      .filter((item) => item.createdAt > lastMessagesTimestampRef.current && item.fromUserId !== userId)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (incoming.length === 0) {
      return;
    }

    lastMessagesTimestampRef.current = incoming[incoming.length - 1].createdAt;
    if (!document.hidden || !myProfile) {
      return;
    }

    const myMention = `@${sanitizeUsername(myProfile.username)}`;
    const notifyList = incoming.filter((message) => {
      const isDirectToMe = message.chatType === "direct" && message.chatId.includes(userId);
      const hasMention = Boolean(message.text && message.text.toLowerCase().includes(myMention));
      return isDirectToMe || hasMention;
    });
    if (notifyList.length === 0 || typeof Notification === "undefined") {
      return;
    }

    if (Notification.permission !== "granted" && !notificationPermissionAskedRef.current) {
      notificationPermissionAskedRef.current = true;
      void Notification.requestPermission();
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }

    const latest = notifyList[notifyList.length - 1];
    const sender = profilesByUserId.get(latest.fromUserId);
    const senderName = sender?.name || sender?.username || "مستخدم";
    const body = latest.chatType === "direct" ? `رسالة خاصة جديدة من ${senderName}` : `${senderName}: ${latest.text || "رسالة جديدة"}`;
    new Notification("Vault - ڤولت", { body, silent: false });
  }, [messages, myProfile, profilesByUserId, userId]);

  useEffect(() => {
    if (!activeChatId) {
      return;
    }
    const missingViews = activeMessages.filter(
      (message) => !message.deleted && !messageViews.some((view) => view.messageId === message.id && view.userId === userId)
    );
    if (missingViews.length === 0) {
      return;
    }
    const steps = missingViews.map((message) =>
      tx.messageViews[`${message.id}_${userId}`].update({ messageId: message.id, userId, seenAt: Date.now() })
    );
    void db.transact(steps).catch(() => {
      // Best-effort read receipts in beta.
    });
  }, [activeChatId, activeMessages, messageViews, tx, userId]);

  if (isLoading || !myProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-500" dir="rtl">
        جاري التحميل...
      </div>
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <ProfileSetup
        name={profileName}
        username={profileUsername}
        bio={profileBio}
        status={profileStatus}
        avatar={profileAvatar}
        busy={savingProfile}
        error={uiMessage}
        onChangeName={setProfileName}
        onChangeUsername={setProfileUsername}
        onChangeBio={setProfileBio}
        onChangeStatus={setProfileStatus}
        onChangeAvatar={setProfileAvatar}
        onSubmit={(event) => {
          void saveProfile(event, true);
        }}
      />
    );
  }

  const themeClasses =
    activeSettings.theme === "slate"
      ? "bg-slate-100 text-slate-900"
      : activeSettings.theme === "ocean"
        ? "bg-cyan-50 text-slate-900"
        : activeSettings.theme === "rose"
          ? "bg-rose-50 text-slate-900"
          : activeSettings.theme === "warm"
            ? "bg-amber-50 text-slate-900"
            : "bg-[#f7f9fc] text-slate-900";
  const surfaceClass = "border border-slate-200 bg-white/95 shadow-[0_8px_30px_-20px_rgba(15,23,42,0.45)]";
  const labelSizePx = `${Math.max(13, Math.round(activeSettings.labelScale * 0.13))}px`;

  return (
    <main
      className={`h-dvh w-screen overflow-hidden ${themeClasses}`}
      dir={isArabic ? "rtl" : "ltr"}
      style={{ fontSize: `${activeSettings.scale}%`, ["--label-scale" as string]: `${activeSettings.labelScale}%` }}
    >
      <button
        type="button"
        onClick={() => setSidebarOpen((value) => !value)}
        className="absolute left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-400"
        aria-label="فتح أو إغلاق الشريط الجانبي"
      >
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse bg-slate-600" />
          <span className="h-1.5 w-1.5 animate-pulse bg-slate-600 [animation-delay:140ms]" />
          <span className="h-1.5 w-1.5 animate-pulse bg-slate-600 [animation-delay:280ms]" />
        </span>
      </button>

      <div className="flex h-full w-full">
        <aside
          className={`absolute left-0 top-0 z-40 h-full w-[92vw] max-w-[380px] overflow-y-auto border-r border-slate-200 bg-white/95 p-4 backdrop-blur transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } soft-scrollbar`}
        >
          <div className="mt-12 space-y-4 pb-5 lg:mt-8">
            <header className="rounded-2xl border border-slate-200 bg-white p-3">
              <h1 className="text-xl font-semibold">Vault - ڤولت</h1>
              <p className="text-sm text-slate-700">{myProfile.name || "بدون اسم"}</p>
              <p className="text-xs text-slate-500">@{myProfile.username}</p>
              <p className="text-xs text-slate-500">{myProfile.status || "متاح"}</p>
              <button
                type="button"
                className="mt-2 w-full rounded-xl border border-slate-300 py-1.5 text-xs transition hover:bg-slate-50"
                onClick={handleBetaToggle}
              >
                {betaEnabled ? "تعطيل بيتا" : betaUnlocked ? "تفعيل بيتا" : "فتح بيتا بالكود"}
              </button>
            </header>

            <section>
              <h2 className="flex items-center gap-1 text-sm font-semibold" style={{ fontSize: labelSizePx }}>
                <Icon path="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
                الملف الشخصي
              </h2>
              <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Avatar src={profileAvatar} alt="صورة الملف" />
                  <div>
                    <p>{myProfile.name || "بدون اسم"}</p>
                    <p>@{myProfile.username}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-900 bg-slate-900 py-2 text-sm text-white transition hover:bg-slate-800"
                  onClick={() => setSettingsOpen(true)}
                >
                  الإعدادات (تعديل الملف)
                </button>
              </div>
            </section>

            <section>
              <h2 className="flex items-center gap-1 text-sm font-semibold" style={{ fontSize: labelSizePx }}>
                <Icon path="M7.5 7.5a3 3 0 116 0 3 3 0 01-6 0zm9.75 1.5a2.25 2.25 0 10-2.25-2.25M3.75 18a5.25 5.25 0 0110.5 0m3.75 0a4.5 4.5 0 00-2.02-3.74" />
                الأصدقاء
              </h2>
              <form className="mt-2 flex gap-2" onSubmit={(event) => void addFriendByUsername(event)}>
                <input
                  value={friendUsername}
                  onChange={(event) => setFriendUsername(event.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="@username"
                />
                <button className="rounded-xl border border-slate-900 px-3 text-sm" type="submit">
                  إضافة
                </button>
              </form>
            </section>

            <section>
              <h2 className="flex items-center gap-1 text-sm font-semibold" style={{ fontSize: labelSizePx }}>
                <Icon path="M4.5 7.5h15v12h-15zM9 7.5V5.25h6V7.5" />
                المجموعات
              </h2>
              <form className="mt-2 flex gap-2" onSubmit={(event) => void createGroup(event)}>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="اسم المجموعة"
                />
                <button className="rounded-xl border border-slate-900 px-3 text-sm" type="submit">
                  إنشاء
                </button>
              </form>
              <form className="mt-2 flex gap-2" onSubmit={(event) => void joinGroup(event)}>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="رمز الانضمام"
                />
                <button className="rounded-xl border border-slate-900 px-3 text-sm" type="submit">
                  دخول
                </button>
              </form>
            </section>

            <section>
              <h2 className="flex items-center gap-1 text-sm font-semibold" style={{ fontSize: labelSizePx }}>
                <Icon path="M3.75 6h16.5M3.75 12h16.5M3.75 18h16.5" />
                القنوات
              </h2>
              <form className="mt-2 space-y-2" onSubmit={(event) => void createChannel(event)}>
                <select
                  value={channelGroupId}
                  onChange={(event) => setChannelGroupId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {myGroups.length === 0 ? <option value="">لا توجد مجموعات متاحة</option> : null}
                  {myGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="اسم القناة"
                />
                <input
                  value={channelDescription}
                  onChange={(event) => setChannelDescription(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="وصف القناة"
                />
                <select
                  value={channelMode}
                  onChange={(event) => setChannelMode(event.target.value as ChannelKind)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="chat">قناة نقاش</option>
                  <option value="announcement">قناة إعلان</option>
                </select>
                <button className="w-full rounded-xl border border-slate-900 px-3 py-2 text-xs transition hover:bg-slate-50 disabled:opacity-50" type="submit" disabled={myGroups.length === 0}>
                  إنشاء قناة
                </button>
              </form>
            </section>

            <section className="border-t border-slate-200 pt-3">
              <h2 className="text-sm font-semibold" style={{ fontSize: labelSizePx }}>المحادثات</h2>
              <div className="soft-scrollbar mt-2 max-h-[220px] space-y-1 overflow-y-auto">
                {chatItems.map((chat) => (
                  <button
                    key={`${chat.kind}-${chat.id}`}
                    type="button"
                    className={`w-full rounded-2xl border px-3 py-2 text-right transition ${
                      activeChatId === chat.id && activeChatKind === chat.kind
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setActiveChatKind(chat.kind);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                        {chat.avatar ? <Avatar src={chat.avatar} alt={chat.title} size="h-9 w-9" /> : <ChatKindGlyph kind={chat.kind} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{chat.title}</p>
                        <p className="truncate text-xs text-slate-500">{chat.subtitle}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              className="w-full rounded-xl border border-slate-300 py-2 text-sm transition hover:bg-slate-50"
              onClick={() => setShowBetaInfo((value) => !value)}
            >
              {betaEnabled ? "وضع بيتا مفعل" : "تفعيل وضع بيتا"}
            </button>

            <button
              type="button"
              className="w-full rounded-xl border border-slate-300 py-2 text-sm transition hover:bg-slate-50"
              onClick={() => setSettingsOpen(true)}
            >
              الإعدادات
            </button>

            <button
              type="button"
              className="w-full rounded-xl border border-slate-300 py-2 text-sm transition hover:bg-slate-50"
              onClick={() => {
                void db.auth.signOut();
              }}
            >
              تسجيل خروج
            </button>

            {showBetaInfo ? (
              <div className="animate-panel-in rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <p className="font-semibold">ملاحظات نسخة بيتا</p>
                <p className="mt-1">ميزات غير منشورة:</p>
                <p>1. إعدادات المظهر واللغة والمقياس.</p>
                <p>2. تغيير لون نص الرسائل.</p>
                <p>3. أوامر mentions عبر /mention.</p>
                <p>4. تمرير الشريط الجانبي + النزول التلقائي لآخر رسالة.</p>
                <p>5. مشاهدات الرسائل + وضع المدرسة + إرسال صوتي.</p>
                <p>6. كود الوصول لبيتا: {BETA_ACCESS_CODE}</p>
                <p className="mt-1">إصلاحات في بيتا:</p>
                <p>1. تحسين رفع الصور والملفات.</p>
                <p>2. منع تعليق حالة الرفع + إصلاح إنشاء القنوات.</p>
                <p className="mt-1">قضايا حالية:</p>
                <p>1. أحجام الملفات الكبيرة قد تتجاوز حدود الخدمة.</p>
                <p>2. الواجهة الإنجليزية جزئية حالياً.</p>
                {isBetaApprover ? (
                  <button
                    type="button"
                    className="mt-2 w-full border border-slate-900 bg-slate-900 py-1.5 text-xs text-white"
                    onClick={() => {
                      setStableSettings(betaSettings);
                      setUiMessage("تم اعتماد تحديث بيتا ونقله للوضع العادي");
                    }}
                  >
                    اعتماد تحديث بيتا للتطبيق العادي
                  </button>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">الاعتماد متاح فقط لحسابات الموافقة المحددة.</p>
                )}
              </div>
            ) : null}

            {uiMessage ? <p className="text-xs text-slate-500">{uiMessage}</p> : null}

            {!betaEnabled ? (
              <section className="animate-panel-in rounded-2xl border border-slate-200 bg-white p-2 text-xs">
                <h3 className="font-semibold">Presets</h3>
                <p className="mt-1 text-[11px] text-slate-500">تجهيزات سريعة للتطبيق العادي.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="border border-slate-300 px-2 py-1"
                    onClick={() => setStableSettings((v) => ({ ...v, theme: "light", scale: 100, labelScale: 108 }))}
                  >
                    افتراضي
                  </button>
                  <button
                    type="button"
                    className="border border-slate-300 px-2 py-1"
                    onClick={() => setStableSettings((v) => ({ ...v, theme: "ocean", messageTextColor: "#0b3a75" }))}
                  >
                    Ocean
                  </button>
                  <button
                    type="button"
                    className="border border-slate-300 px-2 py-1"
                    onClick={() => setStableSettings((v) => ({ ...v, theme: "rose", messageTextColor: "#7f1d1d" }))}
                  >
                    Rose
                  </button>
                  <button
                    type="button"
                    className="border border-slate-300 px-2 py-1"
                    onClick={() => setStableSettings((v) => ({ ...v, scale: 106, labelScale: 115 }))}
                  >
                    تكبير مريح
                  </button>
                </div>
              </section>
            ) : null}

            {betaEnabled ? (
              <section className="animate-panel-in rounded-2xl border border-slate-200 bg-white p-2 text-xs">
                <h3 className="font-semibold">وضع المدرسة (بيتا)</h3>
                <input
                  value={schoolClassName}
                  onChange={(event) => setSchoolClassName(event.target.value)}
                  className="mt-2 w-full border border-slate-300 px-2 py-1"
                  placeholder="اسم الصف"
                />
                <input
                  value={schoolTask}
                  onChange={(event) => setSchoolTask(event.target.value)}
                  className="mt-2 w-full border border-slate-300 px-2 py-1"
                  placeholder="واجب سريع"
                />
                <button
                  type="button"
                  className="mt-2 w-full border border-slate-900 bg-slate-900 py-1.5 text-white"
                  onClick={() => setUiMessage(`وضع المدرسة مفعل: ${schoolClassName || "صف غير محدد"} - ${schoolTask || "بدون واجب"}`)}
                >
                  تفعيل وضع المدرسة
                </button>
              </section>
            ) : null}
          </div>
        </aside>

        <section className={`relative flex h-full min-w-0 flex-1 flex-col ${surfaceClass}`}>
          <header className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3">
            {currentChat ? (
              <div className="flex items-center gap-2">
                <Avatar
                  src={
                    currentChat.kind === "group"
                      ? activeGroup?.avatar || currentChat.avatar
                      : currentChat.kind === "channel"
                        ? activeChannel?.avatar || currentChat.avatar
                        : currentChat.avatar
                  }
                  alt={currentChat.title}
                />
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{currentChat.title}</h2>
                  <p className="text-xs text-slate-500">
                    {currentChat.subtitle}
                    {currentChat.kind === "group" && activeGroup?.description
                      ? ` - ${activeGroup.description}`
                      : null}
                    {currentChat.kind === "channel" && activeChannel?.description
                      ? ` - ${activeChannel.description}`
                      : null}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">اختر محادثة</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {activeChatKind === "direct" && activeDirectPeer ? (
                <>
                  <button
                    type="button"
                    className="rounded-xl border border-amber-300 px-2 py-1 text-xs text-amber-700"
                    onClick={() => void reportDirectUser()}
                  >
                    إبلاغ
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      directModerationMine?.banned ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"
                    }`}
                    onClick={() => void setDirectBan(!directModerationMine?.banned)}
                  >
                    {directModerationMine?.banned ? "فك الحظر" : "حظر"}
                  </button>
                </>
              ) : null}
              {activeChatKind === "group" || activeChatKind === "channel" ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                  onClick={() => setMembersOpen((value) => !value)}
                >
                  الأعضاء
                </button>
              ) : null}
              {(activeChatKind === "group" ? canManageGroup : canManageCurrentChannel) ? (
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                  onClick={() => setManageOpen((value) => !value)}
                >
                  إدارة
                </button>
              ) : null}
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs transition hover:bg-slate-50"
                onClick={() => setPeopleOpen((value) => !value)}
              >
                <Icon className="h-3.5 w-3.5" path="M7.5 7.5a3 3 0 116 0 3 3 0 01-6 0zm9.75 1.5a2.25 2.25 0 10-2.25-2.25M3.75 18a5.25 5.25 0 0110.5 0m3.75 0a4.5 4.5 0 00-2.02-3.74" />
                الناس
              </button>
            </div>
          </header>

          {activePin ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              رسالة مثبتة: {messages.find((item) => item.id === activePin.messageId)?.text || "رسالة وسائط"}
            </div>
          ) : null}

          <div className="h-9 border-b border-slate-100/80 bg-slate-50/60 px-4 text-xs text-slate-500">
            <div className="soft-scrollbar flex h-full items-center gap-3 overflow-x-auto whitespace-nowrap">
              {typingNames.length === 0 && uploadingNames.length === 0 ? <span>لا يوجد نشاط الآن</span> : null}
              {typingNames.length > 0 ? (
                <span className="inline-flex animate-activity items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-500" />
                  {typingNames.join("، ")} يكتب الآن...
                </span>
              ) : null}
              {uploadingNames.length > 0 ? (
                <span className="inline-flex animate-activity items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-blue-500" />
                  {uploadingNames.join("، ")} يرفع ملف...
                </span>
              ) : null}
            </div>
          </div>

          <div ref={messagesContainerRef} className="soft-scrollbar flex-1 overflow-y-auto px-4 py-4">
            {activeMessages.length === 0 ? (
              <p className="text-sm text-slate-500">ابدأ أول رسالة</p>
            ) : (
              <div className="space-y-3">
                {activeMessages.map((message) => {
                  const sender = profilesByUserId.get(message.fromUserId);
                  const mine = message.fromUserId === userId;
                  const selected = selectedMessageId === message.id;
                  const poll = message.pollId ? activePolls.find((item) => item.id === message.pollId) : undefined;
                  const messageReactions = reactionsByMessageId.get(message.id) ?? [];
                  const messageViewers = viewersByMessageId.get(message.id) ?? [];
                  const groupedReactions = Array.from(
                    messageReactions.reduce((map, reaction) => {
                      map.set(reaction.emoji, (map.get(reaction.emoji) ?? 0) + 1);
                      return map;
                    }, new Map<string, number>())
                  );

                  return (
                    <article
                      key={message.id}
                      className={`max-w-[92%] animate-bubble-in rounded-2xl border px-3 py-2 text-sm shadow-[0_4px_18px_-14px_rgba(15,23,42,0.6)] ${
                        mine ? "mr-auto border-sky-200 bg-sky-50/70" : "ml-auto border-slate-200 bg-white"
                      }`}
                      onClick={() => setSelectedMessageId(message.id)}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={sender?.avatar} alt={sender?.name || sender?.username || "مستخدم"} size="h-7 w-7" />
                          <p className="text-[11px] text-slate-500">
                            {sender?.name || sender?.username || "مستخدم"} - {formatTime(message.createdAt)}
                            {message.editedAt ? " (معدل)" : ""}
                          </p>
                        </div>
                        {mine && !message.deleted ? (
                          <div className="flex gap-1">
                            {message.kind === "text" ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-300 px-2 py-0.5 text-[11px]"
                                onClick={() => {
                                  setEditMessageId(message.id);
                                  setEditText(message.text || "");
                                }}
                              >
                                تعديل
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg border border-red-300 px-2 py-0.5 text-[11px] text-red-600"
                              onClick={() => void deleteOwnMessage(message)}
                            >
                              حذف
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {message.deleted ? <p className="text-xs text-slate-400">تم حذف الرسالة</p> : null}

                      {!message.deleted ? <MessageKindLabel kind={message.kind} /> : null}

                      {!message.deleted && editMessageId === message.id ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void saveMessageEdit(message.id);
                          }}
                        >
                          <input
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button type="submit" className="rounded-lg border border-slate-900 px-2 text-xs">
                            حفظ
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-slate-300 px-2 text-xs"
                            onClick={() => {
                              setEditMessageId(null);
                              setEditText("");
                            }}
                          >
                            إلغاء
                          </button>
                        </form>
                      ) : null}

                      {!message.deleted && editMessageId !== message.id && message.kind === "text" && message.text
                        ? renderMessageText(message.text, message.textColor)
                        : null}
                      {!message.deleted && message.kind === "image" && message.fileData ? (
                        <div className="space-y-1">
                          <img
                            className="max-h-60 w-auto cursor-zoom-in border border-slate-200"
                            src={message.fileData}
                            alt={message.fileName || "صورة"}
                            onClick={() => setPreviewImage({ src: message.fileData || "", name: message.fileName || "image" })}
                          />
                          <a className="inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs" href={message.fileData} download={message.fileName}>
                            تنزيل الصورة
                          </a>
                        </div>
                      ) : null}
                      {!message.deleted && message.kind === "file" && message.fileData ? (
                        <a className="inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs" href={message.fileData} download={message.fileName}>
                          تحميل {message.fileName}
                        </a>
                      ) : null}
                      {!message.deleted && message.kind === "audio" && message.fileData ? (
                        <div className="space-y-1">
                          <audio controls src={message.fileData} className="w-full" />
                          <a className="inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs" href={message.fileData} download={message.fileName}>
                            تنزيل MP3
                          </a>
                        </div>
                      ) : null}
                      {!message.deleted && message.kind === "voice" && message.fileData ? (
                        <div className="space-y-1">
                          <audio controls src={message.fileData} className="w-full" />
                          <a className="inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs" href={message.fileData} download={message.fileName}>
                            تنزيل الصوت
                          </a>
                        </div>
                      ) : null}
                      {!message.deleted && message.kind === "poll" && poll ? (
                        <div className="space-y-2">
                          <p className="font-semibold">{poll.question}</p>
                          {(() => {
                            const votesForPoll = pollVotesByPollId.get(poll.id) ?? [];
                            return poll.options.map((option, index) => {
                              const votes = votesForPoll.filter((vote) => vote.optionIndex === index).length;
                              const mineVote = votesForPoll.find((vote) => vote.userId === userId && vote.optionIndex === index);
                              return (
                                <button
                                  key={`${poll.id}-${option}`}
                                  type="button"
                                  className={`block w-full rounded-xl border px-2 py-1 text-right text-xs transition ${
                                    mineVote ? "border-sky-400 bg-sky-50" : "border-slate-300 hover:bg-slate-50"
                                  }`}
                                  onClick={() => {
                                    void votePoll(poll.id, index);
                                  }}
                                >
                                  {option} ({votes})
                                </button>
                              );
                            });
                          })()}
                        </div>
                      ) : null}

                      {!message.deleted && selected ? (
                        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 animate-fade-up">
                          {groupedReactions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {groupedReactions.map(([emoji, count]) => (
                                <button
                                  key={`${message.id}-${emoji}`}
                                  type="button"
                                  className="rounded-full border border-slate-300 px-2 py-0.5 text-xs"
                                  onClick={() => void toggleReaction(message.id, emoji)}
                                >
                                  {emoji} {count}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex gap-1">
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={`${message.id}-quick-${emoji}`}
                                type="button"
                                  className="rounded-full border border-slate-200 px-1.5 py-0.5 text-xs transition hover:border-slate-500"
                                onClick={() => void toggleReaction(message.id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="rounded-full border border-slate-300 px-2 py-0.5 text-xs"
                              onClick={() => void togglePinMessage(message.id)}
                            >
                              {activePin?.messageId === message.id ? "إلغاء التثبيت" : "تثبيت"}
                            </button>
                            {!message.deleted ? (
                              <button
                                type="button"
                                className="rounded-full border border-slate-300 px-2 py-0.5 text-xs"
                                onClick={() => void forwardMessage(message)}
                              >
                                تحويل
                              </button>
                            ) : null}
                          </div>
                          {betaEnabled ? (
                            <p className="text-[11px] text-slate-500">شوهدت بواسطة: {messageViewers.join("، ") || "لا أحد بعد"}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-3">
            {!canSendMessage ? <p className="mb-2 text-xs text-slate-500">في القنوات: المشرفون والمالك فقط يمكنهم الإرسال.</p> : null}
            {activeChatKind === "direct" && isDirectBlocked ? (
              <p className="mb-2 text-xs text-red-600">المحادثة الخاصة مقيدة بسبب الحظر.</p>
            ) : null}

            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void sendTextMessage(event)}>
              <input
                value={messageText}
                onChange={(event) => onTyping(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400"
                placeholder={canSendMessage ? "اكتب رسالة" : "الكتابة مقفلة في هذه القناة"}
                disabled={!canSendMessage}
              />
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs transition hover:bg-slate-50">
                  <Icon className="h-3.5 w-3.5" path="M4.5 6.75h15v10.5h-15zM8.25 10.5h.008M19.5 14.25l-3.75-3.75-4.5 4.5-2.25-2.25-4.5 4.5" />
                  صورة
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void sendUpload(event, "image")}
                    disabled={!canSendMessage}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs transition hover:bg-slate-50">
                  <Icon className="h-3.5 w-3.5" path="M9 18V6.75l9-1.5V16.5M9 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm9-1.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  MP3
                  <input
                    type="file"
                    accept=".mp3,audio/mpeg,audio/mp3"
                    className="hidden"
                    onChange={(event) => void sendUpload(event, "audio")}
                    disabled={!canSendMessage}
                  />
                </label>
                <label className="flex items-center gap-1 rounded-xl border border-slate-300 px-2 py-1 text-xs">
                  لون النص
                  <input
                    type="color"
                    value={activeSettings.messageTextColor}
                    onChange={(event) => {
                      const nextColor = event.target.value;
                      if (betaEnabled) {
                        setBetaSettings((current) => ({ ...current, messageTextColor: nextColor }));
                      } else {
                        setStableSettings((current) => ({ ...current, messageTextColor: nextColor }));
                      }
                    }}
                    className="h-7 w-8 rounded border border-slate-300"
                  />
                </label>
                {betaEnabled ? (
                  <label className="flex cursor-pointer items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs transition hover:bg-slate-50">
                    <Icon className="h-3.5 w-3.5" path="M7.5 3.75h6l3 3v13.5h-9a3 3 0 01-3-3v-10.5a3 3 0 013-3zM13.5 3.75v3h3" />
                    ملف
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => void sendUpload(event, "file")}
                      disabled={!canSendMessage}
                    />
                  </label>
                ) : null}
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-xs transition ${recording ? "border-red-500 text-red-600" : "border-slate-300 hover:bg-slate-50"}`}
                  onClick={() => void toggleVoiceRecord()}
                  disabled={!canSendMessage || recordBusy}
                >
                  {recording ? "إيقاف التسجيل" : recordBusy ? "معالجة الصوت..." : "تسجيل صوت"}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs transition hover:bg-slate-50"
                  onClick={() => setPollOpen((value) => !value)}
                  disabled={!canSendMessage}
                >
                  <Icon className="h-3.5 w-3.5" path="M4.5 6h15M4.5 12h15M4.5 18h10.5" />
                  تصويت
                </button>
                <button
                  type="submit"
                  className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:opacity-60"
                  disabled={uploadBusy || recordBusy || !canSendMessage}
                >
                  {uploadBusy ? "يرفع..." : recordBusy ? "صوت..." : "إرسال"}
                </button>
              </div>
            </form>

            {pollOpen ? (
              <form className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 animate-fade-up" onSubmit={(event) => void sendPoll(event)}>
                <input
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="سؤال التصويت"
                />
                {pollOptions.map((option, index) => (
                  <input
                    key={`poll-option-${index}`}
                    value={option}
                    onChange={(event) => {
                      const next = [...pollOptions];
                      next[index] = event.target.value;
                      setPollOptions(next);
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder={`خيار ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                  onClick={() => setPollOptions((items) => [...items, ""])}
                >
                  إضافة خيار
                </button>
                <button type="submit" className="block rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-xs text-white">
                  نشر التصويت
                </button>
              </form>
            ) : null}
          </footer>

          {previewImage ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
              <div className="max-h-full max-w-4xl space-y-2 rounded-2xl bg-white p-2 shadow-2xl">
                <img src={previewImage.src} alt={previewImage.name} className="max-h-[78vh] w-auto rounded-xl" />
                <div className="flex gap-2">
                  <a className="rounded-lg border border-slate-300 px-3 py-1 text-xs" href={previewImage.src} download={previewImage.name}>
                    تنزيل
                  </a>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1 text-xs text-white"
                    onClick={() => setPreviewImage(null)}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {betaUnlockOpen ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold">فتح ميزات بيتا</p>
                <p className="mt-1 text-xs text-slate-500">أدخل كود الوصول لتفعيل بيتا.</p>
                <input
                  value={betaAccessInput}
                  onChange={(event) => setBetaAccessInput(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="VAULT-XXXXX-XXXXX"
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" className="flex-1 rounded-xl border border-slate-900 bg-slate-900 py-2 text-xs text-white" onClick={unlockBetaWithCode}>
                    تفعيل
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-slate-300 py-2 text-xs"
                    onClick={() => {
                      setBetaUnlockOpen(false);
                      setBetaAccessInput("");
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {manageOpen ? (
            <aside className="absolute inset-y-0 right-0 z-30 w-[92vw] max-w-[360px] border-l border-slate-200 bg-white p-3 animate-panel-in soft-scrollbar overflow-y-auto">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">إدارة {activeChatKind === "group" ? "المجموعة" : "القناة"}</p>
                <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => setManageOpen(false)}>
                  إغلاق
                </button>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <Avatar src={manageAvatar} alt="صورة" size="h-10 w-10" />
                  <label className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                    رفع صورة
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) {
                          return;
                        }
                        try {
                          setManageAvatar(await compressImageAsDataURL(file, 720, 0.8));
                        } catch {
                          setUiMessage("تعذر تجهيز الصورة");
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  value={manageName}
                  onChange={(event) => setManageName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="الاسم"
                />
                <textarea
                  value={manageDescription}
                  onChange={(event) => setManageDescription(event.target.value)}
                  className="h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="الوصف"
                />
                <button type="button" className="w-full rounded-xl border border-slate-900 bg-slate-900 py-2 text-xs text-white" onClick={() => void saveCurrentChatProfile()}>
                  حفظ بيانات {activeChatKind === "group" ? "المجموعة" : "القناة"}
                </button>
              </div>
            </aside>
          ) : null}

          {membersOpen ? (
            <aside className="absolute inset-y-0 left-0 z-30 w-[92vw] max-w-[360px] border-r border-slate-200 bg-white p-3 animate-panel-in soft-scrollbar overflow-y-auto">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">المنضمون في {activeChatKind === "channel" ? "القناة" : "المجموعة"}</p>
                <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => setMembersOpen(false)}>
                  إغلاق
                </button>
              </div>
              <div className="space-y-2">
                {activeMembers.map((member) => {
                  const profile = profilesByUserId.get(member.userId);
                  const isBanned = activeGroupBans.some((item) => item.userId === member.userId);
                  return (
                    <div key={member.id} className="rounded-2xl border border-slate-200 p-2">
                      <div className="flex items-center gap-2">
                        <Avatar src={profile?.avatar} alt={profile?.name || profile?.username || "مستخدم"} />
                        <div>
                          <p className="text-sm font-semibold">{profile?.name || profile?.username || "مستخدم"}</p>
                          <p className="text-xs text-slate-500">@{profile?.username || "user"} - {member.role}</p>
                        </div>
                      </div>
                      {canModerateActive && member.userId !== userId ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {isGroupOwner && member.role !== "owner" ? (
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                              onClick={() => void setMemberRole(member, member.role === "admin" ? "member" : "admin")}
                            >
                              {member.role === "admin" ? "إزالة مشرف" : "ترقية مشرف"}
                            </button>
                          ) : null}
                          <button type="button" className="rounded-lg border border-amber-300 px-2 py-1 text-[11px] text-amber-700" onClick={() => void kickMember(member)}>
                            طرد
                          </button>
                          {!isBanned ? (
                            <button type="button" className="rounded-lg border border-red-300 px-2 py-1 text-[11px] text-red-700" onClick={() => void banMember(member)}>
                              حظر
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {activeGroupBans.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 p-2">
                    <p className="text-xs font-semibold">المحظورون</p>
                    <div className="mt-2 space-y-1">
                      {activeGroupBans.map((ban) => {
                        const profile = profilesByUserId.get(ban.userId);
                        return (
                          <div key={ban.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1">
                            <span className="text-xs">{profile?.name || profile?.username || ban.userId}</span>
                            {canModerateActive ? (
                              <button
                                type="button"
                                className="rounded-lg border border-emerald-300 px-2 py-0.5 text-[11px] text-emerald-700"
                                onClick={() => void unbanGroupUser(ban.userId)}
                              >
                                فك الحظر
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}

          {settingsOpen ? (
            <aside className="absolute inset-y-0 right-0 z-30 w-[92vw] max-w-[380px] border-l border-slate-200 bg-white p-3 animate-panel-in soft-scrollbar overflow-y-auto">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">الإعدادات</h3>
                <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => setSettingsOpen(false)}>
                  إغلاق
                </button>
              </div>

              <form className="space-y-2 rounded-2xl border border-slate-200 bg-white p-2" onSubmit={(event) => void saveProfile(event, false)}>
                <p className="text-xs font-semibold">الملف الشخصي</p>
                <div className="flex items-center gap-2">
                  <Avatar src={profileAvatar} alt="صورة الملف" size="h-10 w-10" />
                  <label className="rounded-lg border border-slate-300 px-2 py-1 text-[11px]">
                    رفع صورة الملف
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 block w-full text-[11px]"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) {
                          return;
                        }
                        try {
                          const imageData = await compressImageAsDataURL(file, 720, 0.8);
                          setProfileAvatar(imageData);
                        } catch {
                          setUiMessage("تعذر تجهيز الصورة");
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                   className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="الاسم"
                />
                <input
                  value={profileUsername}
                  onChange={(event) => setProfileUsername(event.target.value)}
                   className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="اسم المستخدم"
                />
                <input
                  value={profileStatus}
                  onChange={(event) => setProfileStatus(event.target.value)}
                   className="w-full rounded-xl border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="الحالة"
                />
                <textarea
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                   className="h-20 w-full rounded-xl border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="نبذة"
                />
                <button
                  type="submit"
                  disabled={savingProfile}
                   className="w-full rounded-xl border border-slate-900 bg-slate-900 py-1.5 text-xs text-white disabled:opacity-60"
                >
                  {savingProfile ? "جاري الحفظ..." : "حفظ الملف"}
                </button>
              </form>

              {betaEnabled ? (
                <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 text-xs">
                  <p className="font-semibold">إعدادات بيتا</p>
                  <label className="block">
                    الثيم
                    <select
                      value={betaSettings.theme}
                      onChange={(event) =>
                        setBetaSettings((current) => ({ ...current, theme: event.target.value as UiSettings["theme"] }))
                      }
                       className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                    >
                      <option value="light">Light</option>
                      <option value="warm">Warm</option>
                      <option value="slate">Slate</option>
                      <option value="ocean">Ocean</option>
                      <option value="rose">Rose</option>
                    </select>
                  </label>
                  <label className="block">
                    مقياس التطبيق: {betaSettings.scale}%
                    <input
                      type="range"
                      min={85}
                      max={120}
                      value={betaSettings.scale}
                      onChange={(event) =>
                        setBetaSettings((current) => ({ ...current, scale: Number(event.target.value) || 100 }))
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block">
                    حجم العناوين/الملصقات: {betaSettings.labelScale}%
                    <input
                      type="range"
                      min={95}
                      max={130}
                      value={betaSettings.labelScale}
                      onChange={(event) =>
                        setBetaSettings((current) => ({ ...current, labelScale: Number(event.target.value) || 108 }))
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block">
                    اللغة
                    <select
                      value={betaSettings.language}
                      onChange={(event) =>
                        setBetaSettings((current) => ({ ...current, language: event.target.value as UiSettings["language"] }))
                      }
                       className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label className="block">
                    لون نص الرسائل (بيتا)
                    <input
                      type="color"
                      value={betaSettings.messageTextColor}
                      onChange={(event) =>
                        setBetaSettings((current) => ({ ...current, messageTextColor: event.target.value }))
                      }
                       className="mt-1 h-8 w-full rounded-lg border border-slate-300"
                    />
                  </label>
                   <label className="flex items-center justify-between rounded-lg border border-slate-200 px-2 py-1">
                    <span>النزول التلقائي لآخر رسالة</span>
                    <input
                      type="checkbox"
                      checked={betaSettings.autoScroll}
                      onChange={(event) => setBetaSettings((current) => ({ ...current, autoScroll: event.target.checked }))}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">إعدادات الوضع العادي</p>
                  <label className="block">
                    الثيم
                    <select
                      value={stableSettings.theme}
                      onChange={(event) =>
                        setStableSettings((current) => ({ ...current, theme: event.target.value as UiSettings["theme"] }))
                      }
                       className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1"
                    >
                      <option value="light">Light</option>
                      <option value="warm">Warm</option>
                      <option value="slate">Slate</option>
                      <option value="ocean">Ocean</option>
                      <option value="rose">Rose</option>
                    </select>
                  </label>
                  <label className="block">
                    حجم العناوين/الملصقات: {stableSettings.labelScale}%
                    <input
                      type="range"
                      min={95}
                      max={130}
                      value={stableSettings.labelScale}
                      onChange={(event) =>
                        setStableSettings((current) => ({ ...current, labelScale: Number(event.target.value) || 108 }))
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <p>فعّل بيتا من أعلى القائمة لميزات الصوت والملفات ومشاهدات الرسائل.</p>
                </div>
              )}
            </aside>
          ) : null}

          {peopleOpen ? (
            <aside className="absolute inset-y-0 left-0 z-30 w-[88vw] max-w-[320px] border-r border-slate-200 bg-white p-3 animate-panel-in">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">الناس</h3>
                <button type="button" className="rounded-lg border border-slate-300 px-2 py-1 text-xs" onClick={() => setPeopleOpen(false)}>
                  إغلاق
                </button>
              </div>
              <div className="soft-scrollbar space-y-2 overflow-y-auto">
                {profiles
                  .filter((profile) => profile.userId !== userId)
                  .map((profile) => {
                    const isFriend = friendships.some(
                      (friendship) =>
                        (friendship.aUserId === userId && friendship.bUserId === profile.userId) ||
                        (friendship.bUserId === userId && friendship.aUserId === profile.userId)
                    );
                    const mutualGroups = groupMembers.filter(
                      (member) =>
                        member.userId === profile.userId &&
                        Array.from(myMembershipByGroup.keys()).some((groupId) => groupId === member.groupId)
                    ).length;
                    return (
                      <div key={profile.id} className="rounded-2xl border border-slate-200 p-2">
                        <div className="flex items-center gap-2">
                          <Avatar src={profile.avatar} alt={profile.name || profile.username} />
                          <div>
                            <p className="text-sm font-semibold">{profile.name || profile.username}</p>
                            <p className="text-xs text-slate-500">@{profile.username}</p>
                            <p className="text-xs text-slate-400">مجموعات مشتركة: {mutualGroups}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-slate-900 px-2 py-1 text-xs"
                            onClick={() => startDirectChat(profile.userId)}
                          >
                            مراسلة
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            disabled={isFriend}
                            onClick={() => void addFriendByUser(profile)}
                          >
                            {isFriend ? "صديق" : "إضافة صديق"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function App() {
  const { user, isLoading, error } = db.useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-500" dir="rtl">
        جاري التحقق من الجلسة...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-red-600" dir="rtl">
        خطأ في المصادقة: {error.message}
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <ChatApp userId={user.id} email={user.email || ""} />;
}
