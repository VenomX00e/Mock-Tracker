export const getSub = (mock: any, id: string, subjects: any[] = []) => {
  if (['quant', 'reasoning', 'english', 'ga', 'computer'].includes(id)) return mock[id];
  if (mock.dynamicSubjects?.[id] != null) return mock.dynamicSubjects[id];
  
  const subj = subjects.find((s: any) => s.id === id);
  if (subj) {
     const n = subj.name.toLowerCase();
     const sh = (subj.short || '').toLowerCase();
     if (n.includes('quant') || sh === 'q') return mock.quant;
     if (n.includes('reason') || sh === 'r') return mock.reasoning;
     if (n.includes('english') || sh === 'e') return mock.english;
     if (n.includes('ga') || n.includes('general') || sh === 'ga') return mock.ga;
     if (n.includes('computer') || sh === 'c') return mock.computer;
  }
  return null;
};

export const getSubjectColor = (subjectId: string, subjects: any[] = []) => {
  if (subjectId === 'overall') return '#6366f1';
  if (subjectId === 'full') return '#ec4899';
  const sIdx = subjects.findIndex(sub => sub.id === subjectId);
  if (sIdx !== -1) {
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
    return colors[sIdx % colors.length];
  }
  return '#6366f1';
};
