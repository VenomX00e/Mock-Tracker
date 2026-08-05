import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const startSpeedMathDrill: JarvisAction = {
  id: 'START_SPEED_MATH_DRILL',
  description: 'Start a single-operation Speed Math drill with optional custom duration, time unit, difficulty, and question count.',
  requiredParams: ['operation'],
  optionalParams: ['duration', 'timeUnit', 'difficulty', 'mode', 'questionCount'],
  targetRoute: 'learning?tab=speed-math',
  feedbackMessage: (params) => {
    const op = params.operation || 'Speed Math';
    const diff = params.difficulty ? ` on ${params.difficulty} level` : '';
    const dur = params.duration ? ` for ${params.duration}${params.timeUnit || ''}` : '';
    return `Starting ${op} drill${diff}${dur}.`;
  },
  execute: async (params, context) => {
    if (!params.operation) return false;

    let durationSec = 60;
    if (params.duration) {
      const parsed = parseInt(String(params.duration));
      if (!isNaN(parsed)) {
        if (
          params.timeUnit?.toUpperCase() === 'MIN' ||
          String(params.duration).toLowerCase().includes('min')
        ) {
          durationSec = parsed * 60;
        } else {
          durationSec = parsed;
        }
      }
    }

    jarvisEventBus.emit({
      type: 'EXECUTE_INTENT',
      intent: 'START_SPEED_MATH_DRILL',
      operation: params.operation,
      payload: {
        operation: params.operation,
        duration: durationSec,
        timeUnit: params.timeUnit || (durationSec >= 60 && durationSec % 60 === 0 ? 'MIN' : 'SEC'),
        difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
        mode: (params.mode || 'TIME').toUpperCase(),
        questionCount: params.questionCount ? parseInt(String(params.questionCount)) : 20,
      }
    });

    return true;
  }
};

export const startSpeedMathPreset: JarvisAction = {
  id: 'START_SPEED_MATH_PRESET',
  description: 'Start a Speed Math preset test by preset name (e.g. Addition Warmup, Multiplication Sprint).',
  requiredParams: ['presetName'],
  optionalParams: [],
  targetRoute: 'learning?tab=speed-math',
  feedbackMessage: (params) => `Launching Speed Math preset: ${params.presetName}.`,
  execute: async (params, context) => {
    if (!params.presetName) return false;

    jarvisEventBus.emit({
      type: 'EXECUTE_INTENT',
      intent: 'START_SPEED_MATH_PRESET',
      payload: {
        presetName: params.presetName
      }
    });

    return true;
  }
};

// 2.3 Speed Math Actions
export const speedMathActions: JarvisAction[] = [
  startSpeedMathDrill,
  startSpeedMathPreset,
];

