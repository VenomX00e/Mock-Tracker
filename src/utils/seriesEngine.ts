/**
 * Re-exports the modular Deterministic Number Series Engine from `./series`
 */
export {
  BUILTIN_EXAM_PATTERNS,
  parsePatternDescriptor,
  buildExamDifficultyProfile,
  mapSpeedMathDifficultyToLevel,
  generateMathematicalSequence,
  generateSeriesQuestion,
  generateSeriesSpeedMathQuestion,
  generateDistractorOptions,
  resolvePatternPool,
  getSavedVaultPatternsSync,
} from './series';

export type {
  PatternFamily,
  PatternDNA,
  ExamDifficultyProfile,
  GeneratedSequence,
} from './series';
