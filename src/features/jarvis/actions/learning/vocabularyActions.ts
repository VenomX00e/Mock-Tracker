import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const filterVocabularyByDate: JarvisAction = {
  id: 'FILTER_VOCABULARY_BY_DATE',
  description: 'Filter vocabulary words or editorial posts by date, date range, or search query.',
  requiredParams: [],
  optionalParams: ['date', 'startDate', 'endDate', 'searchQuery'],
  targetRoute: 'learning?tab=vocabulary',
  feedbackMessage: (params) => {
    if (params.date) return `Filtering vocabulary for ${params.date}.`;
    if (params.startDate && params.endDate) return `Filtering vocabulary from ${params.startDate} to ${params.endDate}.`;
    if (params.searchQuery) return `Searching vocabulary for "${params.searchQuery}".`;
    return `Showing vocabulary entries.`;
  },
  execute: async (params, context) => {
    jarvisEventBus.emit({
      type: 'EXECUTE_INTENT',
      intent: 'FILTER_VOCAB_DATE',
      payload: {
        date: params.date,
        startDate: params.startDate,
        endDate: params.endDate,
        searchQuery: params.searchQuery
      }
    });
    return true;
  }
};

// 2.2 Vocabulary Actions
export const vocabularyActions: JarvisAction[] = [
  filterVocabularyByDate,
];

