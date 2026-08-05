import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

function normalizeSubject(input?: string): string {
  if (!input) return 'All';
  const val = input.toLowerCase().trim();
  if (['quant', 'math', 'maths', 'aptitude', 'quantitative aptitude'].includes(val)) return 'Quant';
  if (['reasoning', 'logic', 'logical reasoning'].includes(val)) return 'Reasoning';
  if (['english', 'verbal', 'english language'].includes(val)) return 'English';
  if (['ga', 'gk', 'general awareness', 'general knowledge', 'current affairs'].includes(val)) return 'GA';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export const filterPracticeSubject: JarvisAction = {
  id: 'FILTER_PRACTICE_SUBJECT',
  description: 'Filter Practice Library quizzes or materials by subject (Quant, Reasoning, English, GA), topic, or search query.',
  requiredParams: [],
  optionalParams: ['subject', 'topic', 'searchQuery'],
  targetRoute: 'learning?tab=practice-library',
  feedbackMessage: (params) => {
    const subject = normalizeSubject(params.subject);
    if (subject && subject !== 'All') return `Opening ${subject} practice library.`;
    if (params.topic) return `Filtering practice library for topic: ${params.topic}.`;
    if (params.searchQuery) return `Searching practice library for "${params.searchQuery}".`;
    return `Opening Practice Library.`;
  },
  execute: async (params, context) => {
    const mappedSubject = normalizeSubject(params.subject);
    jarvisEventBus.emit({
      type: 'EXECUTE_INTENT',
      intent: 'FILTER_PRACTICE_SUBJECT',
      payload: {
        subject: mappedSubject,
        topic: params.topic,
        searchQuery: params.searchQuery
      }
    });
    return true;
  }
};

// 2.4 Practice Library Actions
export const practiceLibraryActions: JarvisAction[] = [
  filterPracticeSubject,
];

