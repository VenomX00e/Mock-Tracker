import { JarvisAction } from '../types';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../../../../services/firebase';
import { jarvisEventBus } from '../../utils/eventBus';

export const addLiveMockAction: JarvisAction = {
  id: 'add_live_mock',
  description: 'Allows the user to quickly create an active live mock. examType should be the broad category (e.g., SBI, IBPS, RRB). targetRole should be the role (e.g., PO, Clerk). platform is the provider (e.g., Guidely, Oliveboard, Smartkeeda, PracticeMock).',
  requiredParams: ['examType', 'targetRole', 'platform'],
  optionalParams: ['phase', 'scope', 'mockName'],
  feedbackMessage: (params) => {
    const { examType, targetRole, platform } = params;
    if (!examType || !targetRole || !platform) {
      return 'Please provide the exam type, target role, and platform to create the live mock.';
    }
    return `Successfully created a live mock for ${examType} ${targetRole} on ${platform}.`;
  },
  execute: async (params, context) => {
    const { examType, targetRole, platform, phase = 'Prelims', scope = 'Full', mockName = 'Live' } = params;

    if (!examType || !targetRole || !platform) {
      return true; // Return true so Jarvis can say the feedback message to ask for missing params
    }

    try {
      let catId = params.categoryId;
      const catList = (context as any).categories || (context.pageContext as any)?.categories || [];

      if (!catId) {
        if (examType) {
          const lowerExam = examType.toLowerCase();
          const match = catList.find((c: any) =>
            c.id?.toLowerCase() === lowerExam ||
            c.name?.toLowerCase().includes(lowerExam) ||
            (c.id === 'banking' && ['sbi', 'ibps', 'rrb', 'rbi', 'nabard', 'bank', 'po', 'clerk', 'so'].some(k => lowerExam.includes(k)))
          );
          if (match) catId = match.id;
        }
        if (!catId) {
          catId = (context.pageContext as any)?.profile?.categoryId || (catList.length > 0 ? catList[0].id : 'banking');
        }
      }

      let idPrefix = 'liveMock';
      if (catId) {
        const currentCat = catList.find((c: any) => c.id === catId);
        const prefix = currentCat?.subjectPrefix || catId;
        idPrefix = `${prefix.replace(/_$/, '').toUpperCase()}_LIVEMOCK`;
      }

      const newId = `${idPrefix}_${Date.now()}`;
      await setDoc(
        doc(db, "system", newId),
        {
          type: "liveMock",
          examType,
          examRole: targetRole,
          examPhase: phase,
          examScope: scope,
          mockName,
          platform,
          date: "", // Default to empty
          categoryId: catId || 'banking',
          title: `Live: ${mockName}`,
          description: `Join the community in taking the ${examType} ${targetRole} ${phase} mock on ${platform}.`,
          link: "",
          updatedAt: new Date().toISOString(),
        }
      );

      // Navigate to Dashboard's "Live Mocks" section (using sub_navigate)
      jarvisEventBus.dispatch({
        type: 'SUB_NAVIGATE',
        payload: {
          mainTab: 'dashboard',
          subTab: 'live-mocks',
          section: 'live-mocks' // using this as a hash fallback in listener
        }
      });
      
      // Also ensure main navigation is set to dashboard
      if (context.navigate) {
          context.navigate('/dashboard#live-mocks');
      }

      return true;
    } catch (error) {
      console.error("Error creating live mock via Jarvis", error);
      throw error;
    }
  }
};


export const filterPerformanceTrendAction: JarvisAction = {
  id: 'filter_performance_trend',
  description: 'Allows the user to filter the Performance Trend chart by subject or exam category. Use this if the user wants to see their performance or stats for a specific exam (like IBPS, SBI) or subject (like Quant, Reasoning).',
  requiredParams: [],
  optionalParams: ['subject', 'examCategory'],
  feedbackMessage: (params) => {
    const subject = params.subject || 'Overall';
    const examCategory = params.examCategory || 'All';
    return `Showing ${subject} performance for ${examCategory} exams.`;
  },
  execute: async (params, context) => {
    const { subject, examCategory } = params;
    
    // Import store dynamically or use window if available
    const { useCacheStore } = await import('../../../../store/analyticsStore');
    
    const mapSubject = (sub: string, subjects: any[] = []) => {
      if (!sub) return undefined;
      const s = sub.toLowerCase();
      if (s.includes('overall')) return 'overall';
      if (s.includes('full')) return 'full';
      
      const foundSubj = subjects.find(
        (sj) =>
          sj.name.toLowerCase().includes(s) ||
          (sj.short && sj.short.toLowerCase() === s) ||
          s.includes(sj.name.toLowerCase()) || 
          (sj.short && s.includes(sj.short.toLowerCase()))
      );
      if (foundSubj) return foundSubj.id;
      
      if (s.includes('quant')) {
         const match = subjects.find(sj => sj.id.includes('quant'));
         if (match) return match.id;
         return 'quant';
      }
      if (s.includes('reasoning') || s.includes('reas')) {
         const match = subjects.find(sj => sj.id.includes('reasoning'));
         if (match) return match.id;
         return 'reasoning';
      }
      if (s.includes('english') || s.includes('eng')) {
         const match = subjects.find(sj => sj.id.includes('english'));
         if (match) return match.id;
         return 'english';
      }
      if (s.includes('ga') || s.includes('general') || s.includes('aware')) {
         const match = subjects.find(sj => sj.id.includes('ga') || sj.id.includes('general'));
         if (match) return match.id;
         return 'ga';
      }
      return undefined;
    };

    const activeTrendId = mapSubject(subject, context.subjects || []) || 'overall';
    let selectedExam = 'All';
    if (examCategory) {
       const ec = examCategory.toUpperCase();
       if (ec.includes('IBPS')) selectedExam = 'IBPS';
       else if (ec.includes('RRB')) selectedExam = 'RRB';
       else if (ec.includes('SBI')) selectedExam = 'SBI';
    }

    useCacheStore.getState().updateDashboardCache({
      activeTrendId,
      selectedExam
    });

    // Navigate to Dashboard's Performance Trend section
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'performance-trend'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#performance-trend');
    }

    return true;
  }
};


export const viewHistoryLogAction: JarvisAction = {
  id: 'view_history_log',
  description: 'Scrolls to the History Log and filters the table to show mocks taken on a specific day.',
  requiredParams: ['date'],
  feedbackMessage: (params) => {
    return `Showing history log for ${params.date}.`;
  },
  execute: async (params, context) => {
    let dateStr = params.date;
    
    // Process "today" or "yesterday"
    if (dateStr) {
      const d = dateStr.toLowerCase();
      const today = new Date();
      if (d === 'today') {
        dateStr = today.toISOString().split('T')[0];
      } else if (d === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateStr = yesterday.toISOString().split('T')[0];
      }
    }

    const { useCacheStore } = await import('../../../../store/analyticsStore');
    
    if (dateStr) {
        useCacheStore.getState().updateDashboardCache({
            selectedHistoryDate: dateStr
        });
    }

    // Navigate to Dashboard's History Log section
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'history-log'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#history-log');
    }

    return true;
  }
};


export const viewCountdownsAction: JarvisAction = {
  id: 'view_countdowns',
  description: 'Navigates to the Dashboard and scrolls to the Countdowns section.',
  requiredParams: [],
  feedbackMessage: 'Showing your countdowns.',
  execute: async (params, context) => {
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'countdowns'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#countdowns');
    }
    return true;
  }
};

export const viewChallengesAction: JarvisAction = {
  id: 'view_active_challenges',
  description: 'Navigates to the Dashboard and scrolls to the Active Challenges section.',
  requiredParams: [],
  feedbackMessage: 'Showing your active challenges.',
  execute: async (params, context) => {
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'challenges'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#challenges');
    }
    return true;
  }
};

export const viewLiveMocksAction: JarvisAction = {
  id: 'view_live_mocks',
  description: 'Navigates to the user dashboard and views the Live Mocks & Test Series section',
  requiredParams: [],
  targetRoute: 'dashboard',
  feedbackMessage: 'Opening Live Mocks & Test Series.',
  execute: async (params, context) => {
    jarvisEventBus.dispatch({
      type: 'SUB_NAVIGATE',
      payload: {
        mainTab: 'dashboard',
        subTab: 'live-mocks',
        section: 'live-mocks'
      }
    });
    
    if (context.navigate) {
        context.navigate('/dashboard#live-mocks');
    }
    return true;
  }
};

export const dashboardActions: JarvisAction[] = [addLiveMockAction, filterPerformanceTrendAction, viewHistoryLogAction, viewCountdownsAction, viewChallengesAction, viewLiveMocksAction];
