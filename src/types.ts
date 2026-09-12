export interface SectionalScore {
  score?: number | null;
  percentile?: number | null;
  accuracy?: number | null;
}

export interface UserProfile {
  userId: string;
  email?: string;
  displayName: string;
  photoURL: string;
  targetedExam: string;
  avgPercentile: number;
  avgAccuracy?: number;
  avgQuantPercentile: number;
  avgReasoningPercentile: number;
  avgEnglishPercentile: number;
  avgGaPercentile?: number;
  dynamicAverages?: Record<string, number>;
  totalTests: number;
  categoryStats?: Record<string, any>;
  streak: number;
  streakActive?: boolean;
  updatedAt?: any;
  lastActiveAt?: any;
  isBanned?: boolean;
  isMuted?: boolean;
  mutedAt?: number;
  lastMockDate?: string;
  role?: string;
  adminCategories?: string[];
  categoryId?: string; // Add categoryId
  leaderboardRank?: number;
  periodContext?: string;
  bio?: string;
  yptNames?: string[];
  defaultYptHandle?: string;
  badges?: any[];
  stats7D?: any;
  stats30D?: any;
  completedPracticeFiles?: string[];
  favoriteVocabIds?: string[];
  permissions?: {
    canManageUsers?: boolean;
    canManageNotices?: boolean;
    canManageChallenges?: boolean;
    canManageLiveMocks?: boolean;
    canManageCountdowns?: boolean;
    canManageSettings?: boolean;
    canManageFeatures?: boolean;
    canManageQuotes?: boolean;
    canManageLearning?: boolean;
    canManageYpt?: boolean;
  };
  tasks?: ReflectionTask[];
}

export interface CustomVocabFolder {
  id: string;
  name: string;
  vocabIds: string[];
  createdAt?: any;
  updatedAt?: any;
}

export type CustomFolder = CustomVocabFolder;

export interface Vocabulary {
  id: string;
  type: 'vocab' | 'phrasal_verb' | 'idiom' | 'one_word_sub';
  word: string;
  meaning: string;
  pos?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
  mnemonic?: string;
  additional?: string;
  canvasId?: string;
  canvasTitle?: string;
  canvasDate?: string;
  isMastered?: boolean;
}

export interface ReflectionTask {
  id: string;
  text: string;
  completed: boolean;
  completedParts?: number;
  totalParts?: number;
  createdAt?: string;
  completedAt?: string;
}

export interface MockScore {
  id: string;
  userId?: string;
  createdAt?: any;
  examType: string;
  examRole?: string;
  examPhase?: string;
  examScope?: string;
  mockName: string;
  platform?: string;
  customPlatform?: string;
  date: string;
  score?: number | null;
  percentile?: number | null;
  percentage?: number | null;
  accuracy?: number | null;
  streakAtTime?: number | null;
  quant?: SectionalScore;
  reasoning?: SectionalScore;
  english?: SectionalScore;
  ga?: SectionalScore;
  computer?: SectionalScore;
  note?: string;
  tags?: string[];
  difficulty?: string;
  nervousness?: string;
  focus?: string;
  energy?: string;
  timeState?: string;
  tasks?: ReflectionTask[];
  categoryId?: string;
  dynamicSubjects?: Record<string, SectionalScore>;
  likes?: string[];
  isDeleted?: boolean;
  userName?: string;
  userPhoto?: string;
  userStreak?: number;
  userStreakActive?: boolean;
  userProfileRef?: UserProfile;
}

export interface ExamCategory {
  id: string;
  name: string;
  subjectPrefix?: string;
  exams?: string[];
  roles?: string[];
  phases?: string[];
  scopes?: string[];
  platforms?: string[];
  subjects?: { id: string; name: string; short?: string; phases?: string[] }[];
}

export interface CommunityLeaderboardProps {
  Trophy: any;
  CustomDropdown: any;
  selectedPeriod: string;
  setSelectedPeriod: (val: string) => void;
  isAdmin?: boolean;
  isOwner: boolean;
  sortConfig: { key: string | null; direction: "asc" | "desc" | null };
  handleAdminChangeGlobalSort: (key: string) => void;
  selectedPhase: string;
  availablePhases: string[];
  setSelectedPhase: (val: string) => void;
  setDoc: any /* Firebase */;
  doc: any /* Firebase */;
  db: any /* Firebase */;
  loadingTop: boolean;
  handleSort: (key: string) => void;
  subjects: { id: string; name: string; short?: string; phases?: string[] }[];
  sortedLeaderboard: UserProfile[];
  parseLocalDate: (dateString: string) => Date;
  onUserClick: (user: UserProfile) => void;
  getHeatmapColor: (val: number | null | undefined) => string;
  Flame: any;
}

export interface CommunityFeedProps {
  user: any;
  Users: any;
  loadingFeed: boolean;
  filteredFeedLogs: any[];
  daysVisible: number;
  feedSort: { key: string | null; direction: "asc" | "desc" | null };
  handleFeedSort: (key: string) => void;
  getFeedSortConfig: (key: string) => "⬇" | "⬆" | null;
  subjects: { id: string; name: string; short?: string; phases?: string[] }[];
  sortedLeaderboard: UserProfile[];
  onUserClick: (user: UserProfile) => void;
  Flame: any;
  getPlatformShort: (plat: string) => string;
  getHeatmapColor: (val: number | null | undefined) => string;
  getSub: (m: any, subjectId: string, subjects: any) => any;
  handleReact: (e: any, mockId: string, mockUserId: string) => Promise<void>;
  reactions: Record<string, { count: number; hasReacted: boolean }>;
  Calendar: any;
  setDaysVisible: (val: any) => void;
  ArrowRight: any;
}

export interface CommunityChatProps {
  MessageSquare: any;
  chatMessages: any[];
  Pin: any;
  handlePinMessage: (msgId: string, pin: boolean) => Promise<void>;
  X: any;
  setActiveMsgId: (id: string | null) => void;
  setCustomEmojiOpenForId: (id: string | null) => void;
  setActiveReactionView: (id: string | null) => void;
  setActiveActionsMsgId: (id: string | null) => void;
  setShowPollVotersForId: (id: string | null) => void;
  userMap: Record<string, UserProfile>;
  user: any;
  activeActionsMsgId: string | null;
  setReplyingTo: (msg: any) => void;
  activeMsgId: string | null;
  handlePollVote: (msgId: string, optionId: string) => Promise<void>;
  CheckCircle2: any;
  CheckSquare: any;
  showPollVotersForId: string | null;
  activeReactionView: string | null;
  handleChatReact: (msgId: string, emoji: string) => Promise<void>;
  customEmojiOpenForId: string | null;
  customEmojiInput: string;
  setCustomEmojiInput: (val: string) => void;
  setEditingMessageId: (id: string | null) => void;
  setNewMessage: (val: string) => void;
  setShowPollMaker: (val: boolean) => void;
  setPollQuestion: (val: string) => void;
  setPollIsMulti: (val: boolean) => void;
  setPollOptions: (
    options: { id: string; text: string; isCorrect: boolean }[],
  ) => void;
  Pencil: any;
  isAdmin: boolean;
  handleDeleteMessage: (msgId: string, authorId: string) => Promise<void>;
  Trash2: any;
  PinOff: any;
  chatBottomRef: any;
  chatError: string;
  replyingTo: any;
  handleSendMessage: (e: any) => Promise<void>;
  editingMessageId: string | null;
  showPollMaker: boolean;
  BarChart2: any;
  pollIsMulti: boolean;
  pollQuestion: string;
  pollOptions: { id: string; text: string; isCorrect: boolean }[];
  newMessage: string;
  isSending: boolean;
  Send: any;
}

export interface PracticeFolder {
  id: string;
  subjectId: string;
  parentId: string | null;
  name: string;
  order: number;
  cloudFolderPath?: string;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface PracticeFile {
  id: string;
  folderId: string;
  subjectId?: string; // Added for recycle bin querying
  name: string;
  type: "firebase_file" | "external_link";
  fileMeta: {
    url: string;
    sizeBytes?: number;
    mimeType?: string;
    cloudPublicId?: string;
  };
  attribution?: {
    channelName: string;
    channelLink: string;
  };
  difficulty?: "Easy" | "Moderate" | "Hard";
  isHidden?: boolean;
  createdAt: any;
  isDeleted?: boolean;
  deletedAt?: any;
}

export interface LearningModuleModel {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string;
  modulesCount: number;
  modules?: LearningModuleModel[];
  createdAt?: any;
  createdBy?: string;
}

export interface LearningUserProgress {
  userId: string;
  courseId: string;
  completedModuleIds: string[];
  progressPercentage: number;
  lastAccessed?: any;
}

export interface CloudinaryWebhookLog {
  id: string;
  notificationType: string;
  publicId?: string;
  timestamp: any;
  createdAt?: any;
  status: string;
  rawPayload: string;
}

export interface GlobalGeminiFeatureConfig {
  enabled: boolean;          // Whether non-key users can use the global key for this feature
  defaultModel: string;      // Enforced model (e.g., 'gemini-2.5-flash', 'gemini-2.5-pro')
  allowCustomKeyOverride: boolean; // True by default (personal keys always override)
}

export interface GlobalGeminiSystemConfig {
  features: {
    ypt_screenshot_parser: GlobalGeminiFeatureConfig;
    ai_tutor: GlobalGeminiFeatureConfig;
    jarvis: GlobalGeminiFeatureConfig;
    mock_exam_generator: GlobalGeminiFeatureConfig;
    flashcards: GlobalGeminiFeatureConfig;
    general_chat: GlobalGeminiFeatureConfig;
  };
  updatedAt: number;
  updatedBy: string;
}

export * from './types/yptTypes';
export * from './types/extraction';

