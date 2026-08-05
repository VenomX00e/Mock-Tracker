import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const openCommunityHubAction: JarvisAction = {
  id: 'OPEN_COMMUNITY_HUB',
  description: 'Navigates to the main Community Hub tab',
  requiredParams: [],
  targetRoute: 'community',
  feedbackMessage: () => 'Opening Community Hub.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'community' });
    }
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'OPEN_COMMUNITY_HUB',
    });
    return true;
  },
};

export const openLeaderboardAction: JarvisAction = {
  id: 'OPEN_LEADERBOARD',
  description: 'Navigates to Community and switches active tab to Leaderboard',
  requiredParams: [],
  targetRoute: 'community',
  feedbackMessage: () => 'Opening Community Leaderboard.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'community' });
    }
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'OPEN_LEADERBOARD',
    });
    return true;
  },
};

export const openCommunityLogAction: JarvisAction = {
  id: 'OPEN_COMMUNITY_LOG',
  description: 'Navigates to Community and switches active tab to Community Activity Log',
  requiredParams: [],
  targetRoute: 'community',
  feedbackMessage: () => 'Opening Community Activity Log.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'community' });
    }
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'OPEN_COMMUNITY_LOG',
    });
    return true;
  },
};

export const openCommunityChatAction: JarvisAction = {
  id: 'OPEN_COMMUNITY_CHAT',
  description: 'Navigates to Community and switches active tab to Community Chat',
  requiredParams: [],
  targetRoute: 'community',
  feedbackMessage: () => 'Opening Community Chat.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    } else {
      jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'community' });
    }
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'OPEN_COMMUNITY_CHAT',
    });
    return true;
  },
};

export const sendCommunityChatAction: JarvisAction = {
  id: 'SEND_COMMUNITY_CHAT',
  description: 'Sends a chat message to the Community Chat',
  requiredParams: ['text'],
  targetRoute: 'community',
  feedbackMessage: (params) => `Sent message: "${params.text}"`,
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    }
    await new Promise((r) => setTimeout(r, 150));
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'SEND_COMMUNITY_CHAT',
      payload: params,
    });
    return true;
  },
};

export const createCommunityPollAction: JarvisAction = {
  id: 'CREATE_COMMUNITY_POLL',
  description: 'Creates a new poll in Community Chat. Use correctOption or answer to specify which option is the correct answer.',
  requiredParams: ['question', 'options'],
  optionalParams: ['correctOption', 'answer', 'correctAnswer', 'isMulti'],
  targetRoute: 'community',
  feedbackMessage: (params) => `Created poll: "${params.question}"`,
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    }
    await new Promise((r) => setTimeout(r, 150));
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'CREATE_COMMUNITY_POLL',
      payload: params,
    });
    return true;
  },
};

export const voteCommunityPollAction: JarvisAction = {
  id: 'VOTE_COMMUNITY_POLL',
  description: 'Votes on a poll option in Community Chat',
  requiredParams: ['messageId', 'optionIndex'],
  targetRoute: 'community',
  feedbackMessage: () => 'Vote submitted to poll.',
  execute: async (params, context) => {
    if (context?.navigate) {
      context.navigate('community');
    }
    await new Promise((r) => setTimeout(r, 150));
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'VOTE_COMMUNITY_POLL',
      payload: params,
    });
    return true;
  },
};

export const communityActions: JarvisAction[] = [
  openCommunityHubAction,
  openLeaderboardAction,
  openCommunityLogAction,
  openCommunityChatAction,
  sendCommunityChatAction,
  createCommunityPollAction,
  voteCommunityPollAction,
];

