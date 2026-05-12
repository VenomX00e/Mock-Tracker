const fs = require('fs');

function extractBlock(code, startMarker, endMarker, componentName) {
    const startIdx = code.indexOf(startMarker);
    const endIdx = code.indexOf(endMarker, startIdx);
    if (startIdx === -1 || endIdx === -1) {
        console.error('Could not find markers for', componentName);
        return null;
    }
    
    // We want the whole `div` or whatever is inside that region.
    // Actually, startMarker is literally `{/* FEED */}`.
    const blockText = code.substring(startIdx, endIdx);
    
    return blockText;
}

let code = fs.readFileSync('src/components/CommunityHub.tsx', 'utf8');

const feedBlock = extractBlock(code, '{/* FEED */}', '{/* CHAT SECTION */}', 'Feed');
const chatBlock = extractBlock(code, '{/* CHAT SECTION */}', '{/* Challenge Requests Admin View */', 'Chat');

// Leaderboard is the first <div className="space-y-8 mt-6 lg:mt-8 mb-4"> ... </div> which contains Trophy.
// Let's find it.
const leaderStart = code.indexOf('<div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">');
const leaderEnd = code.indexOf('{/* FEED */}');

const leaderBlock = code.substring(leaderStart, leaderEnd);

// If I just extract them into components and pass all variables via a huge context or `props: any`.
console.log('Leader block size:', leaderBlock.length);
console.log('Feed block size:', feedBlock.length);
console.log('Chat block size:', chatBlock.length);
