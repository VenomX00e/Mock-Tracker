export interface VocabExtractionSettings {
  defaultCustomInstructions: string;
  defaultTargetLevel?: string;
  defaultWordCount?: number;
  defaultNativeLanguage?: string;
}

export interface PlatformLearningSettings {
  vocabExtraction: VocabExtractionSettings;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const DEFAULT_VOCAB_EXTRACTION_SETTINGS: VocabExtractionSettings = {
  defaultCustomInstructions: '',
};

export const DEFAULT_PLATFORM_LEARNING_SETTINGS: PlatformLearningSettings = {
  vocabExtraction: DEFAULT_VOCAB_EXTRACTION_SETTINGS,
  updatedAt: null,
  updatedBy: null,
};
