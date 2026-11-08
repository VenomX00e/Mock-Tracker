import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CommunityHubTrashModal } from './community/CommunityHubTrashModal';
import { CommunityLeaderboard } from './community/CommunityLeaderboard';
import { CommunityFeed } from './community/CommunityFeed';
import { CommunityChat } from './community/CommunityChat';
import { useCommunityUI, createCommunityPoll } from './community/useCommunityPosts';
import { jarvisEventBus } from '../features/jarvis/utils/eventBus';
import { collection, query, orderBy, limit, getDocs, collectionGroup, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, addDoc, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { UserProfile, MockScore, CommunityLeaderboardProps, CommunityFeedProps, CommunityChatProps } from '../types';
import { Trophy, Flame, Target, Users, Calendar, ArrowRight, Trash2, ShieldAlert, ArchiveRestore, Send, MessageSquare, Pencil, X, Reply, BarChart2, CheckCircle2, CheckSquare, Pin, PinOff } from 'lucide-react';
import { CommunityViewProvider, useCommunityView, CommunityViewContextType } from "./community/CommunityContext";
import { getHeatmapColor, getPlatformShort, parseLocalDate } from '../lib/utils';
import { CustomDropdown } from './CustomDropdown';
import { getErrorMessage } from '../lib/errorUtils';
import { getSub } from '../lib/subjectUtils';
import { ChallengeCard } from './ChallengeCard';
import { Card } from './ui/Card';
import { useAuthCtx, useAppStateCtx, useSystemDataCtx, useChallengesManagerCtx } from '../context/AppContext';
import { useUIStore } from '../store/uiStore';

export default function CommunityHub() {

  const { user } = useAuthCtx();
  const { adminPermissions, isOwner, localCategory: categoryId } = useAppStateCtx();
  const { challenges, categories, pinnedChallenges } = useSystemDataCtx();
  const { setIsCreateChallengeOpen, setIsRequestsModalOpen, setIsAddModalOpen, setMockToEdit, setEditingChallenge, setActivePublicProfile } = useUIStore();
  const { handlePinChallenge, handleDeleteChallenge, dismissChallenge } = useChallengesManagerCtx();
  
  const onUserClick = setActivePublicProfile;
  const isAdmin = adminPermissions?.canManageLiveMocks;
  const onPinChallenge = handlePinChallenge;
  const onEditChallenge = (challenge: any) => {
    setIsRequestsModalOpen(false);
    setEditingChallenge(challenge);
    setIsCreateChallengeOpen(true);
  };
  const onDeleteChallenge = handleDeleteChallenge;
  const onDismissChallenge = dismissChallenge;


  
  const activeCategory = (categories || []).find(c => c.id === categoryId) || categories?.[0];
  const subjects = activeCategory?.subjects && activeCategory.subjects.length > 0 ? activeCategory.subjects : [
    { id: 'quant', name: 'Quant', short: 'Q' },
    { id: 'reasoning', name: 'Reasoning', short: 'R' },
    { id: 'english', name: 'English', short: 'E' },
    { id: 'ga', name: 'GA', short: 'GA' }
  ];


  const uiState = useCommunityUI(user, isAdmin, categoryId, activeCategory);
  
  const {
    allUsers, feedLogs, setFeedLogs, allFeedMocks, setAllFeedMocks, loadingTop, loadingFeed, userMap,
    deletedMocks, setDeletedMocks, chatMessages, sortConfig, setSortConfig, daysVisible, setDaysVisible,
    feedSort, setFeedSort, selectedPhase, setSelectedPhase, selectedPeriod, setSelectedPeriod, reactions, setReactions,
    showTrash, setShowTrash, newMessage, setNewMessage, editingMessageId, setEditingMessageId, replyingTo, setReplyingTo,
    activeMsgId, setActiveMsgId, activeActionsMsgId, setActiveActionsMsgId, showPollVotersForId, setShowPollVotersForId,
    chatError, setChatError, isSending, setIsSending, showPollMaker, setShowPollMaker, pollQuestion, setPollQuestion,
    pollOptions, setPollOptions, pollIsMulti, setPollIsMulti, activeReactionView, setActiveReactionView,
    customEmojiOpenForId, setCustomEmojiOpenForId, customEmojiInput, setCustomEmojiInput, chatBottomRef,
    
    handleSendMessage, handleDeleteMessage, handlePinMessage, handleChatReact, handlePollVote, handleSort, handleFeedSort,
    getFeedSortConfig, availablePhases, activeAllUsers, sortedLeaderboard, filteredFeedLogs, handleAdminRestore,
    handleAdminPermanentDelete, handleAdminChangeGlobalSort, handleReact
  } = uiState;

  useEffect(() => {
    const unsubscribe = jarvisEventBus.subscribe(async (action) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { subTab, section } = action.payload || {};
        const target = subTab || section;
        if (target === 'leaderboard' || target === 'OPEN_LEADERBOARD') {
          const el = document.getElementById('community-leaderboard');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (target === 'log' || target === 'OPEN_COMMUNITY_LOG') {
          const el = document.getElementById('community-log');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (target === 'chat' || target === 'OPEN_COMMUNITY_CHAT') {
          const el = document.getElementById('community-chat') || document.getElementById('community-chat-scroll');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      }

      if (action.type === 'EXECUTE_INTENT') {
        const intent = action.intent;
        const payload = action.payload;

        if (intent === 'OPEN_COMMUNITY_HUB') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (intent === 'OPEN_LEADERBOARD') {
          const el = document.getElementById('community-leaderboard');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (intent === 'OPEN_COMMUNITY_LOG') {
          const el = document.getElementById('community-log');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (intent === 'OPEN_COMMUNITY_CHAT') {
          const el = document.getElementById('community-chat') || document.getElementById('community-chat-scroll');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else if (intent === 'SEND_COMMUNITY_CHAT') {
          const text = payload?.text || payload?.message;
          if (text) {
            try {
              await handleSendMessage(undefined, text);
            } catch (err) {
              console.error('Error sending chat via JARVIS:', err);
            }
          }
        } else if (intent === 'CREATE_COMMUNITY_POLL') {
          const { question, options, isMulti } = payload || {};
          let parsedOptions: any[] = [];

          if (Array.isArray(options)) {
            parsedOptions = options;
          } else if (typeof options === 'string') {
            const rawStr = options.trim();
            if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
              try {
                parsedOptions = JSON.parse(rawStr);
              } catch {
                parsedOptions = rawStr.split(/[,;\n]/);
              }
            } else {
              parsedOptions = rawStr.split(/[,;\n]/);
            }
          }

          let targetAnswer = (
            payload?.correctOption ??
            payload?.correct_option ??
            payload?.answer ??
            payload?.correctAnswer ??
            payload?.correct_answer ??
            payload?.correctIndex ??
            payload?.correctOptionIndex ??
            payload?.solution ??
            payload?.correct ??
            ''
          ).toString().trim();

          if (!targetAnswer) {
            const payloadStr = JSON.stringify(payload || {});
            const fullTextToSearch = `${question || ''} ${payloadStr}`;

            const matchSetAsAnswer = fullTextToSearch.match(/(?:set|mark|choose|select)\s+(.+?)\s+as\s+(?:the\s+)?(?:correct\s+)?answer/i);
            const matchAnswerIs = fullTextToSearch.match(/(?:correct\s+answer|answer)\s*(?:is|=|:)\s*(.+?)(?:$|\s+with|\s+and|\.|\,)/i);
            const matchCorrect = fullTextToSearch.match(/correct\s*[:=]\s*(.+?)(?:$|\s+with|\s+and|\.|\,)/i);

            if (matchSetAsAnswer && matchSetAsAnswer[1]) {
              targetAnswer = matchSetAsAnswer[1].trim();
            } else if (matchAnswerIs && matchAnswerIs[1]) {
              targetAnswer = matchAnswerIs[1].trim();
            } else if (matchCorrect && matchCorrect[1]) {
              targetAnswer = matchCorrect[1].trim();
            }
          }

          const formattedOptionsForPoll = parsedOptions
            .map((opt, idx) => {
              let text = typeof opt === 'string' ? opt.trim() : (opt?.text || '').trim();
              if (!text) return null;

              let isCorrect = false;

              // 1. Check object property
              if (typeof opt === 'object' && opt !== null) {
                if (opt.isCorrect || opt.correct || opt.isAnswer || opt.answer) {
                  isCorrect = true;
                }
              }

              // 2. Check inline markers like "(correct)", "(answer)", "*", etc.
              if (/[\(\[](?:correct|answer)[\)\]]|\*/i.test(text)) {
                isCorrect = true;
                text = text.replace(/[\(\[](?:correct|answer)[\)\]]|\*/gi, '').trim();
              }

              // 3. Match against targetAnswer
              if (!isCorrect && targetAnswer) {
                const textLower = text.toLowerCase();
                const answerLower = targetAnswer.toLowerCase();

                if (
                  textLower === answerLower ||
                  textLower.includes(answerLower) ||
                  answerLower.includes(textLower)
                ) {
                  isCorrect = true;
                } else if (
                  answerLower === idx.toString() ||
                  answerLower === (idx + 1).toString() ||
                  answerLower === `option ${idx + 1}` ||
                  answerLower === `option${idx + 1}` ||
                  (answerLower === 'a' && idx === 0) ||
                  (answerLower === 'b' && idx === 1) ||
                  (answerLower === 'c' && idx === 2) ||
                  (answerLower === 'd' && idx === 3)
                ) {
                  isCorrect = true;
                }
              }

              return {
                id: (idx + 1).toString(),
                text,
                isCorrect,
              };
            })
            .filter((o): o is { id: string; text: string; isCorrect: boolean } => o !== null);

          if (question && formattedOptionsForPoll.length >= 2) {
            try {
              if (user) {
                await createCommunityPoll(user, question, formattedOptionsForPoll, !!isMulti);
                setShowPollMaker(false);
                setPollQuestion('');
                setPollOptions([
                  { id: '1', text: '', isCorrect: false },
                  { id: '2', text: '', isCorrect: false }
                ]);
              } else {
                setPollQuestion(question);
                setPollOptions(formattedOptionsForPoll);
                setShowPollMaker(true);
              }
            } catch (err) {
              console.error('Error creating poll via JARVIS:', err);
              setPollQuestion(question);
              setPollOptions(formattedOptionsForPoll);
              setShowPollMaker(true);
            }
          } else {
            if (question) setPollQuestion(question);
            if (formattedOptionsForPoll.length > 0) {
              setPollOptions(formattedOptionsForPoll);
            }
            setShowPollMaker(true);
          }
        } else if (intent === 'VOTE_COMMUNITY_POLL') {
          const { messageId, optionIndex, optionId } = payload || {};
          if (messageId) {
            let targetOptId = optionId;
            if (targetOptId == null && optionIndex != null && chatMessages) {
              const targetMsg = chatMessages.find((m: any) => m.id === messageId);
              if (targetMsg?.poll?.options?.[optionIndex]) {
                targetOptId = targetMsg.poll.options[optionIndex].id;
              }
            }
            if (targetOptId) {
              try {
                await handlePollVote(messageId, targetOptId);
              } catch (err) {
                console.error('Error voting poll via JARVIS:', err);
              }
            }
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, handleSendMessage, handlePollVote, setPollQuestion, setPollOptions, setShowPollMaker, chatMessages]);

  const contextValue: CommunityViewContextType = {
      Trophy, CustomDropdown, selectedPeriod, setSelectedPeriod, isAdmin, isOwner, sortConfig, handleAdminChangeGlobalSort, selectedPhase, availablePhases, setSelectedPhase, setDoc, doc, db, loadingTop, handleSort, subjects, sortedLeaderboard, parseLocalDate, onUserClick, getHeatmapColor, Flame,
      user, Users, loadingFeed, filteredFeedLogs, daysVisible, feedSort, handleFeedSort, getFeedSortConfig, getPlatformShort, getSub, handleReact, reactions, Calendar, setDaysVisible, ArrowRight,
      MessageSquare, chatMessages, Pin, handlePinMessage, X, setActiveMsgId, setCustomEmojiOpenForId, setActiveReactionView, setActiveActionsMsgId, setShowPollVotersForId, userMap, activeActionsMsgId, setReplyingTo, activeMsgId, handlePollVote, CheckCircle2, CheckSquare, showPollVotersForId, activeReactionView, handleChatReact, customEmojiOpenForId, customEmojiInput, setCustomEmojiInput, setEditingMessageId, setNewMessage, setShowPollMaker, setPollQuestion, setPollIsMulti, setPollOptions, Pencil, handleDeleteMessage, Trash2, PinOff, chatBottomRef, chatError, replyingTo, handleSendMessage, editingMessageId, showPollMaker, BarChart2, pollIsMulti, pollQuestion, pollOptions, newMessage, isSending, Send
    };

    return (
      <CommunityViewProvider value={contextValue}>
        <div className="space-y-8 mt-6 lg:mt-8 mb-4">
          <CommunityLeaderboard />
          <CommunityFeed />
          <CommunityChat />

      
      {showTrash && isAdmin && (
        <CommunityHubTrashModal
          showTrash={showTrash}
          setShowTrash={setShowTrash}
          deletedMocks={deletedMocks}
          userMap={userMap}
          handleAdminRestore={handleAdminRestore}
          handleAdminPermanentDelete={handleAdminPermanentDelete}
        />
      )}
    </div>
      </CommunityViewProvider>
  );
}

