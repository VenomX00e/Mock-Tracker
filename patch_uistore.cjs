const fs = require('fs');
let code = fs.readFileSync('src/store/uiStore.ts', 'utf8');

if (!code.includes('learningTab:')) {
    code = code.replace(/activeTab:.*?\n.*?(?:[^;]+);/s, match => {
        return match + '\n  learningTab: "ai" | "vocab" | "math" | "practice";\n  setLearningTab: (tab: "ai" | "vocab" | "math" | "practice") => void;';
    });
    code = code.replace(/activeTab: "home",/, 'learningTab: "ai",\n  setLearningTab: (tab) => set({ learningTab: tab }),\n  activeTab: "home",');
    fs.writeFileSync('src/store/uiStore.ts', code);
    console.log("Patched uiStore");
} else {
    console.log("Already patched");
}
