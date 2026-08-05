const fs = require('fs');
let code = fs.readFileSync('src/components/learning/LearningView.tsx', 'utf8');

const newEffect = `
  useEffect(() => {
    const handleSubNavigate = (action: any) => {
      if (action.type === 'SUB_NAVIGATE') {
        const { mainTab, subTab, section } = action.payload;
        if (mainTab === 'learning') {
          if (subTab === 'practice' && section) {
             setActiveTab('practice');
             // We need to pass the section down. 
             // Best way without context is to use a global store or dispatch another event inside PracticeLibrary.
             // For now we will rely on PracticeLibrary picking up the same event.
          }
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleSubNavigate);
    return () => unsubscribe();
  }, []);
`;

if (!code.includes("if (action.type === 'SUB_NAVIGATE')")) {
    code = code.replace(/const popoverRef = useRef<HTMLDivElement>\(null\);\s*const dropdownRef = useRef<HTMLDivElement>\(null\);\s*const setCanvases = useVocabularyStore\(state => state\.setCanvases\);/, "const popoverRef = useRef<HTMLDivElement>(null);\n  const dropdownRef = useRef<HTMLDivElement>(null);\n  const setCanvases = useVocabularyStore(state => state.setCanvases);\n" + newEffect);
    fs.writeFileSync('src/components/learning/LearningView.tsx', code);
    console.log("Patched LearningView to handle SUB_NAVIGATE");
} else {
    console.log("LearningView already handles SUB_NAVIGATE");
}
