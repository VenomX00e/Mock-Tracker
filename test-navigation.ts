import { jarvisEventBus } from './src/features/jarvis/utils/eventBus';

console.log("Dispatching test navigate event");
jarvisEventBus.dispatch({ type: 'NAVIGATE', payload: 'learning/math' });
