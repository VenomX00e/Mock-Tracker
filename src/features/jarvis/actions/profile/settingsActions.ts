import { JarvisAction } from '../types';
import { domUtils } from '../../domUtils';
import { jarvisEventBus } from '../../utils/eventBus';

export const updateProfileNameAction: JarvisAction = {
  id: 'UPDATE_PROFILE_NAME',
  description: "Updates the user's profile display name",
  requiredParams: ['newName'],
  optionalParams: ['name'],
  feedbackMessage: (params) => `Updating display name to "${params.newName || params.name}".`,
  execute: async (params) => {
    const name = params.newName || params.name;
    if (!name) {
      throw new Error("A name is required to update display name.");
    }
    
    // Primary Execution (Pattern 2): Dispatch to event bus
    jarvisEventBus.dispatch({ 
       type: 'EXECUTE_INTENT', 
       intent: 'UPDATE_PROFILE_NAME', 
       payload: { newName: name } 
    });
    
    return true;
  },
  fallback: async (params) => {
    const name = params.newName || params.name;
    if (!name) return false;
    
    // Wait for the modal/page to animate in
    const input = await domUtils.waitForElement('[data-jarvis-target="profile-name-input"]', 2000);
    if (!input) return false;
    
    const typeSuccess = domUtils.simulateType('[data-jarvis-target="profile-name-input"]', name);
    
    // Give React state a tiny moment to update
    await new Promise(r => setTimeout(r, 100));
    
    const clickSuccess = domUtils.simulateClick('[data-jarvis-target="save-profile-btn"]');
    
    return typeSuccess && clickSuccess;
  }
};

export const changeUsername = updateProfileNameAction;

export const updateTargetExamAction: JarvisAction = {
  id: 'UPDATE_TARGET_EXAM',
  description: 'Changes targeted exam (e.g., "CAT 2026", "SBI PO", "IPMAT") and category',
  requiredParams: ['exam'],
  optionalParams: ['categoryId', 'targetExam'],
  feedbackMessage: (params) => `Updated target exam to "${params.exam || params.targetExam}".`,
  execute: async (params) => {
    const exam = params.exam || params.targetExam;
    if (!exam) {
      throw new Error("Target exam is required.");
    }
    
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'UPDATE_TARGET_EXAM',
      payload: { exam, categoryId: params.categoryId }
    });
    
    return true;
  }
};

export const updateProfileBioAction: JarvisAction = {
  id: 'UPDATE_PROFILE_BIO',
  description: 'Updates user study goal or bio text',
  requiredParams: ['bio'],
  optionalParams: ['studyGoal', 'goal'],
  feedbackMessage: () => `Updated profile study goal / bio.`,
  execute: async (params) => {
    const bio = params.bio || params.studyGoal || params.goal;
    if (!bio) {
      throw new Error("Bio or study goal text is required.");
    }
    
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'UPDATE_PROFILE_BIO',
      payload: { bio }
    });
    
    return true;
  }
};

export const updateProfileAvatarAction: JarvisAction = {
  id: 'UPDATE_PROFILE_AVATAR',
  description: 'Selects a profile avatar URL or predefined avatar icon',
  requiredParams: ['avatarUrl'],
  optionalParams: ['avatar', 'avatarId'],
  feedbackMessage: () => `Updated profile avatar.`,
  execute: async (params) => {
    const avatarUrl = params.avatarUrl || params.avatar || params.avatarId;
    if (!avatarUrl) {
      throw new Error("Avatar URL or avatar identifier is required.");
    }
    
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'UPDATE_PROFILE_AVATAR',
      payload: { avatarUrl }
    });
    
    return true;
  }
};

export const updateExamSectionAction: JarvisAction = {
  id: 'UPDATE_EXAM_SECTION',
  description: 'Updates the user exam section / sector / category (e.g. "SSC", "Banking", "Railways", "Insurance") without changing targeted exam',
  requiredParams: ['section'],
  optionalParams: ['category', 'categoryId'],
  feedbackMessage: (params) => `Updated exam section / sector to "${params.section || params.category || params.categoryId}".`,
  execute: async (params) => {
    const section = params.section || params.category || params.categoryId;
    if (!section) {
      throw new Error("Exam section / category is required.");
    }
    
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'UPDATE_EXAM_SECTION',
      payload: { section, category: section }
    });
    
    return true;
  }
};

export const profileActions: JarvisAction[] = [
  updateProfileNameAction,
  updateTargetExamAction,
  updateExamSectionAction,
  updateProfileBioAction,
  updateProfileAvatarAction,
];

