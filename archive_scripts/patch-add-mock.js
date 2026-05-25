import fs from 'fs';
let code = fs.readFileSync('src/components/AddMockDialog.tsx', 'utf8');

const s1Target = `  const subjects = currentCategory?.subjects && currentCategory.subjects.length > 0 ? currentCategory.subjects : [
    { id: 'quant', name: 'Quant' },
    { id: 'reasoning', name: 'Reasoning' },
    { id: 'english', name: 'English' },
    { id: 'ga', name: 'GA' }
  ];`;
  
const s1Replacement = `  const allSubjects = currentCategory?.subjects && currentCategory.subjects.length > 0 ? currentCategory.subjects : [
    { id: 'quant', name: 'Quant' },
    { id: 'reasoning', name: 'Reasoning' },
    { id: 'english', name: 'English' },
    { id: 'ga', name: 'GA' }
  ];`;
  
code = code.replace(s1Target, s1Replacement);

const s2Target = `    ...Object.fromEntries(subjects.map(s => [s.id, { score: '', percentile: '', accuracy: '' }]))
  };

  const [formData, setFormData] = useState<any>(defaultFormData);`;
  
const s2Replacement = `    ...Object.fromEntries(allSubjects.map(s => [s.id, { score: '', percentile: '', accuracy: '' }]))
  };

  const [formData, setFormData] = useState<any>(defaultFormData);
  
  const subjects = allSubjects.filter((s: any) => {
    if (!s.phases || s.phases.length === 0) return true;
    return s.phases.includes(formData.examPhase);
  });`;
  
code = code.replace(s2Target, s2Replacement);

const s3Target = `      const activeSubjects = activeCat?.subjects && activeCat.subjects.length > 0 ? activeCat.subjects : [
        { id: 'quant', name: 'Quant' },
        { id: 'reasoning', name: 'Reasoning' },
        { id: 'english', name: 'English' },
        { id: 'ga', name: 'GA' }
      ];`;
      
const s3Replacement = `      const activeSubjects = activeCat?.subjects && activeCat.subjects.length > 0 ? activeCat.subjects : [
        { id: 'quant', name: 'Quant' },
        { id: 'reasoning', name: 'Reasoning' },
        { id: 'english', name: 'English' },
        { id: 'ga', name: 'GA' }
      ];`; // We can leave this one since activeSubjects is used to reset all fields. Wait, maybe leave it exactly as is.

const s4Target = `  const [selectedSection, setSelectedSection] = useState<string>(subjects.length > 0 ? subjects[0].id : 'quant');`;
const s4Replacement = `  const [selectedSection, setSelectedSection] = useState<string>(allSubjects.length > 0 ? allSubjects[0].id : 'quant');`;
code = code.replace(s4Target, s4Replacement);

const s5Target = `                            // Preserve inputs that match the new subjects if any, else blank
                           ...Object.fromEntries(activeSubjects.map(s => [s.id, prev[s.id] || { score: '', percentile: '', accuracy: '' }]))`;
                           
const s5Replacement = `                            // Preserve inputs that match the new subjects if any, else blank
                           ...Object.fromEntries(activeSubjects.map(s => [s.id, prev[s.id] || { score: '', percentile: '', accuracy: '' }]))`;

fs.writeFileSync('src/components/AddMockDialog.tsx', code);
console.log('patched AddMockDialog');
