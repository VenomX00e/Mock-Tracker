import { determineIntent } from './src/features/jarvis/services/jarvisIntentService';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Testing intent parser...");
        const result = await determineIntent("Jarvis, I want to practice 3 digit multiplication");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
