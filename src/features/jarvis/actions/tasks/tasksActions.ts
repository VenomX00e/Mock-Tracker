import { JarvisAction } from '../types';
import { jarvisEventBus } from '../../utils/eventBus';

export const addGeneralTaskAction: JarvisAction = {
  id: 'ADD_GENERAL_TASK',
  description: 'Adds a new general action item/task to the user list',
  requiredParams: ['text'],
  optionalParams: ['priority', 'category'],
  targetRoute: 'tasks',
  feedbackMessage: (params) => `Added task: "${params.text}"`,
  execute: async (params) => {
    console.log('Adding general task:', params.text);
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'ADD_GENERAL_TASK',
      payload: params,
    });
    return true;
  },
};

export const viewCompletedTasksAction: JarvisAction = {
  id: 'VIEW_COMPLETED_TASKS',
  description: 'Filters the task view to show completed action items',
  requiredParams: [],
  targetRoute: 'tasks',
  feedbackMessage: () => 'Showing completed tasks.',
  execute: async () => {
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'VIEW_COMPLETED_TASKS',
    });
    return true;
  },
};

export const viewIncompleteTasksAction: JarvisAction = {
  id: 'VIEW_INCOMPLETE_TASKS',
  description: 'Filters the task view to show active/incomplete action items',
  requiredParams: [],
  targetRoute: 'tasks',
  feedbackMessage: () => 'Showing active tasks.',
  execute: async () => {
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'VIEW_INCOMPLETE_TASKS',
    });
    return true;
  },
};

export const toggleTaskAction: JarvisAction = {
  id: 'TOGGLE_TASK',
  description: 'Marks a task as completed or incomplete by matching task text',
  requiredParams: ['taskText'],
  optionalParams: ['completed'],
  targetRoute: 'tasks',
  feedbackMessage: (params) => `Updated status for task: "${params.taskText}"`,
  execute: async (params) => {
    jarvisEventBus.dispatch({
      type: 'EXECUTE_INTENT',
      intent: 'TOGGLE_TASK',
      payload: params,
    });
    return true;
  },
};

export const tasksActions: JarvisAction[] = [
  addGeneralTaskAction,
  viewCompletedTasksAction,
  viewIncompleteTasksAction,
  toggleTaskAction,
];
