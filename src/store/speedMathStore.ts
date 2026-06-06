import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Operation } from '../utils/mathEngine';

export type PracticeMode = "TIME" | "QUESTIONS";
export type TimeUnit = "MIN" | "SEC";
export type DifficultyLevel = "BEGINNER" | "EASY" | "MEDIUM" | "HARD" | "CHALLENGING" | "EXPERT";
export type NumpadAlignment = 'center' | 'left' | 'right';

export interface BaseSettings {
  mode: PracticeMode;
  duration?: number;
  timeUnit?: TimeUnit;
  questionCount?: number;
  configMode?: "GLOBAL" | "INDIVIDUAL";
  shuffle?: boolean;
}

export interface OperationSettings {
  difficulty?: DifficultyLevel;
  customRanges?: string;
  isReverse?: boolean;
  mode?: PracticeMode;
  duration?: number;
  questionCount?: number;
  mixIncludesFractions?: boolean;
  mixIncludesPowers?: boolean;
  mixIncludesRoots?: boolean;
}

export interface MathPreset {
  id: string;
  name: string;
  operations: Operation[];
  baseSettings: BaseSettings;
  overrides: Partial<Record<Operation, OperationSettings>>;
  isDefault: boolean;
}

export interface GameResult {
  id: string;
  date: string;
  score: number;
  total: number;
  presetName: string;
}

interface SpeedMathState {
  presets: MathPreset[];
  tileSettings: Partial<Record<Operation, BaseSettings & OperationSettings>>;
  history: GameResult[];
  useVirtualKeyboard: boolean;
  numpadAlignment: NumpadAlignment;
  addPreset: (preset: MathPreset) => void;
  removePreset: (id: string) => void;
  updatePreset: (id: string, updates: Partial<MathPreset>) => void;
  updateTileSettings: (op: Operation, settings: BaseSettings & OperationSettings) => void;
  saveGameResult: (result: Omit<GameResult, 'id' | 'date'>) => void;
  toggleVirtualKeyboard: () => void;
  cycleNumpadAlignment: () => void;
}

const defaultPresets: MathPreset[] = [
  {
    id: 'default-1',
    name: 'Basic Warmup',
    operations: ['+', '-'],
    baseSettings: {
      mode: "TIME",
      duration: 60,
      timeUnit: "SEC",
      questionCount: 30,
      configMode: "GLOBAL",
      shuffle: false
    },
    overrides: {
      '+': { difficulty: 'EASY' },
      '-': { difficulty: 'EASY' }
    },
    isDefault: true,
  },
  {
    id: 'default-2',
    name: 'Clerk Quant',
    operations: ['+', '-', '*', '/'],
    baseSettings: {
      mode: "TIME",
      duration: 120,
      timeUnit: "SEC",
      questionCount: 50,
      configMode: "GLOBAL",
      shuffle: false
    },
    overrides: {
      '+': { difficulty: 'MEDIUM' },
      '-': { difficulty: 'MEDIUM' },
      '*': { difficulty: 'EASY' },
      '/': { difficulty: 'EASY' }
    },
    isDefault: true,
  },
  {
    id: 'default-3',
    name: 'Square & Cube Sprint',
    operations: ['sq', 'cube'],
    baseSettings: {
      mode: "TIME",
      duration: 60,
      timeUnit: "SEC",
      questionCount: 20,
      configMode: "GLOBAL",
      shuffle: false
    },
    overrides: {
      'sq': { customRanges: "2-30" },
      'cube': { customRanges: "2-15" }
    },
    isDefault: true,
  },
  {
    id: 'default-4',
    name: 'Fractions Percentage',
    operations: ['frac'],
    baseSettings: {
      mode: "TIME",
      duration: 60,
      timeUnit: "SEC",
      questionCount: 20,
      configMode: "GLOBAL",
      shuffle: false
    },
    overrides: {
      'frac': { customRanges: "1-11" } // Usually denominators 2-11
    },
    isDefault: true,
  },
  {
    id: 'default-5',
    name: 'Multiplication Tables',
    operations: ['table'],
    baseSettings: {
      mode: "TIME",
      duration: 60,
      timeUnit: "SEC",
      questionCount: 20,
      configMode: "GLOBAL",
      shuffle: false
    },
    overrides: {
      'table': { customRanges: "12-20" }
    },
    isDefault: true,
  },
  {
    id: 'default-6',
    name: 'Mixture Challenge',
    operations: ['mix'],
    baseSettings: {
      mode: "TIME",
      duration: 120,
      timeUnit: "SEC",
      questionCount: 20,
      configMode: "GLOBAL",
      shuffle: true
    },
    overrides: {
      'mix': { difficulty: 'MEDIUM' }
    },
    isDefault: true,
  }
];

export const useSpeedMathStore = create<SpeedMathState>()(
  persist(
    (set) => ({
      presets: defaultPresets,
      tileSettings: {},
      history: [],
      useVirtualKeyboard: true,
      numpadAlignment: 'center',
      
      addPreset: (preset) => set((state) => ({ 
        presets: [...state.presets, preset] 
      })),
      
      removePreset: (id) => set((state) => ({ 
        presets: state.presets.filter(p => p.id !== id)
      })),

      updatePreset: (id, updates) => set((state) => ({
        presets: state.presets.map(p => p.id === id ? { ...p, ...updates } : p)
      })),

      updateTileSettings: (op, settings) => set((state) => ({
        tileSettings: { 
            ...state.tileSettings, 
            [op]: { ...(state.tileSettings[op] || {}), ...settings } 
        }
      })),
      
      saveGameResult: (result) => set((state) => ({
        history: [{ 
          ...result, 
          id: Math.random().toString(36).substring(2, 9),
          date: new Date().toISOString() 
        }, ...state.history]
      })),

      toggleVirtualKeyboard: () => set((state) => ({
        useVirtualKeyboard: !state.useVirtualKeyboard
      })),

      cycleNumpadAlignment: () => set((state) => {
        let next: NumpadAlignment = 'center';
        if (state.numpadAlignment === 'center') next = 'right';
        else if (state.numpadAlignment === 'right') next = 'left';
        else next = 'center';
        return { numpadAlignment: next };
      }),
    }),
    {
      name: 'speed-math-storage',
      partialize: (state) => ({
        presets: state.presets,
        tileSettings: state.tileSettings,
        history: state.history,
        useVirtualKeyboard: state.useVirtualKeyboard,
        numpadAlignment: state.numpadAlignment,
      }),
    }
  )
);
