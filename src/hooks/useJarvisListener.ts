import { useEffect } from 'react';
import { jarvisEventBus, JarvisActionEvent } from '../features/jarvis/utils/eventBus';
import { useUIStore } from '../store/uiStore';
import { useVersionStore } from '../store/versionStore';
import { executeAction } from '../features/jarvis/actions';
import { useJarvisStore } from '../features/jarvis/store/jarvisStore';
import { useSystemDataCtx, useUserProfileCtx } from '../context/AppContext';
import { getCurrentPageContext } from '../features/jarvis/services/jarvisContextService';

export function useJarvisListener() {
  const { setTheme, setDarkMode, darkMode, theme, setActiveTab, setLearningTab } = useUIStore();
  const { categories } = useSystemDataCtx();
  const { profile } = useUserProfileCtx();

  const setAccentColor = (colorName: string, targetMode?: 'light' | 'dark') => {
    const isLight = targetMode ? targetMode === 'light' : (theme.includes('-light') || !darkMode);
    const lower = colorName.toLowerCase();
    switch (lower) {
      case 'blue':
        setTheme(isLight ? 'cyber-light' : 'cyber');
        break;
      case 'emerald':
      case 'green':
        setTheme(isLight ? 'cyber-green-light' : 'cyber-green');
        break;
      case 'purple':
      case 'lavender':
        setTheme(isLight ? 'cyber-lavender-light' : 'cyber-lavender');
        break;
      case 'rose':
      case 'pink':
        setTheme(isLight ? 'cyber-pink-light' : 'cyber-pink');
        break;
      case 'amber':
      case 'orange':
        setTheme(isLight ? 'cyber-orange-light' : 'cyber-orange');
        break;
      case 'spiderman':
      case 'hero-miles':
        setTheme('hero-miles');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handleJarvisAction = async (action: JarvisActionEvent) => {
      console.log('Jarvis Action Received:', action);
      
      switch (action.type) {
        case 'CHANGE_THEME': {
          const payload = action.payload;
          const VALID_COLORS = ['blue', 'emerald', 'purple', 'rose', 'amber', 'spiderman'];
          const VALID_MODES = ['light', 'dark'];

          if (typeof payload === 'string') {
            const lower = payload.toLowerCase();
            if (VALID_MODES.includes(lower)) {
              if (lower === 'dark') {
                setDarkMode(true);
              } else if (lower === 'light') {
                setDarkMode(false);
              } else {
                setTheme(lower as any);
              }
            } else if (VALID_COLORS.includes(lower)) {
              setAccentColor(lower);
            } else {
              setTheme(lower as any);
            }
          } else if (typeof payload === 'object' && payload !== null) {
            const { mode, color, accentColor, theme: rawTheme } = payload;
            
            // Handle Mode (Light/Dark)
            const targetMode = mode || (VALID_MODES.includes(rawTheme) ? rawTheme : null);

            // Handle Accent Color (Blue, Emerald, Purple, Rose, Amber, Spiderman)
            const targetColor = color || accentColor || (!VALID_MODES.includes(rawTheme) ? rawTheme : null);

            if (targetColor && VALID_COLORS.includes(targetColor.toLowerCase())) {
              setAccentColor(targetColor.toLowerCase(), targetMode as any);
            } else if (targetMode && VALID_MODES.includes(targetMode)) {
              if (targetMode === 'dark') {
                setDarkMode(true);
              } else if (targetMode === 'light') {
                setDarkMode(false);
              } else {
                setTheme(targetMode as any);
              }
            }
          }
          break;
        }
        case 'NAVIGATE':
          if (action.payload) {
            let [fullPath, hash] = action.payload.split('#');
            fullPath = fullPath.replace(/^\//, '').toLowerCase();
            
            // Fuzzy mapping for robust navigation
            if (fullPath.includes('math')) fullPath = 'learning/math';
            else if (fullPath.includes('vocab')) fullPath = 'learning/vocab';
            else if (fullPath.includes('practice')) fullPath = 'learning/practice';
            else if (fullPath.includes('ai tutor') || fullPath === 'learning') fullPath = 'learning/ai';
            else if (fullPath.includes('leaderboard')) fullPath = 'community/leaderboard';
            else if (fullPath.includes('community log') || fullPath.includes('community-log')) fullPath = 'community/log';
            else if (fullPath.includes('community chat') || fullPath.includes('community-chat')) fullPath = 'community/chat';
            else if (fullPath.includes('home')) fullPath = 'dashboard';
            else if (fullPath.includes('setting')) fullPath = 'profile';
            else if (fullPath.includes('changelog') || fullPath.includes('release') || fullPath.includes('whats-new') || fullPath.includes('update')) {
              useVersionStore.getState().setUpdateModalOpen(true);
              break;
            }
            else if (fullPath.includes('add-mock') || fullPath.includes('add mock') || fullPath.includes('add_mock') || fullPath.includes('mock score')) fullPath = 'add-mock';

            const parts = fullPath.split('/');
            const mainTab = parts[0];
            const subTab = parts[1];
            const section = parts[2];
            
            // Set the main view in ViewManager
            setActiveTab(mainTab as any);
            
            if (mainTab === 'learning') {
              if (fullPath.includes('math')) setLearningTab('math');
              else if (fullPath.includes('vocab')) setLearningTab('vocab');
              else if (fullPath.includes('practice')) setLearningTab('practice');
              else setLearningTab('ai');
            }
            
            if (subTab || section || hash) {
               setTimeout(() => {
                 if (hash) {
                   const element = document.getElementById(hash);
                   if (element) {
                     element.scrollIntoView({ behavior: 'smooth' });
                   }
                 }
                 if (subTab || section) {
                   jarvisEventBus.dispatch({ type: 'SUB_NAVIGATE', payload: { mainTab, subTab, section } });
                 }
               }, 300); 
            }
          }
          break;
        case 'OPEN_SETTINGS':
          setActiveTab('profile');
          break;
        case 'OPEN_CHANGELOG':
          useVersionStore.getState().setUpdateModalOpen(true);
          break;
        case 'DISPATCH_INTENT':
          if (action.intent) {
            const activeCategory = (categories || []).find((c: any) => c.id === profile?.categoryId) || categories?.[0];
            const subjects = activeCategory?.subjects && activeCategory.subjects.length > 0 ? activeCategory.subjects : [
              { id: 'quant', name: 'Quant', short: 'Q' },
              { id: 'reasoning', name: 'Reasoning', short: 'R' },
              { id: 'english', name: 'English', short: 'E' },
              { id: 'ga', name: 'GA', short: 'GA' }
            ];

            const pageContext = getCurrentPageContext(profile, { categories });

            const context = {
              currentPath: '/' + useUIStore.getState().activeTab,
              navigate: (path: string) => {
                jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: path });
              },
              subjects,
              pageContext,
              categories,
            };
            
            const parameters = action.payload || {};
            if (action.operation && !parameters.operation) {
                parameters.operation = action.operation;
            }

            const result = await executeAction(action.intent, parameters, context);
            
            jarvisEventBus.dispatch({
              type: 'ACTION_RESULT',
              intent: action.intent,
              success: result.success,
              message: result.message
            });
          }
          break;
        case 'ACTION_RESULT':
          if (action.message) {
            useJarvisStore.getState().addMessage({ role: 'assistant', content: action.message });
          }
          break;
        default:
          if (action.type !== 'EXECUTE_INTENT') {
             console.warn('Unknown Jarvis action type:', action.type);
          }
      }
    };

    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    
    return () => {
      unsubscribe();
    };
  }, [setDarkMode, setActiveTab, setLearningTab, categories, profile]);
}
