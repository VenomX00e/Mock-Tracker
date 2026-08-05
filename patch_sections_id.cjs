const fs = require('fs');

let countdowns = fs.readFileSync('src/components/views/CountdownsSection.tsx', 'utf8');
if (!countdowns.includes('id="countdowns"')) {
    countdowns = countdowns.replace(/<div className="relative mb-6">/, '<div id="countdowns" className="relative mb-6 scroll-mt-24">');
    fs.writeFileSync('src/components/views/CountdownsSection.tsx', countdowns);
    console.log("Patched CountdownsSection.tsx");
}

let challenges = fs.readFileSync('src/components/views/ChallengesSection.tsx', 'utf8');
if (!challenges.includes('id="challenges"')) {
    challenges = challenges.replace(/<div className="mb-8 relative">/, '<div id="challenges" className="mb-8 relative scroll-mt-24">');
    fs.writeFileSync('src/components/views/ChallengesSection.tsx', challenges);
    console.log("Patched ChallengesSection.tsx");
}
