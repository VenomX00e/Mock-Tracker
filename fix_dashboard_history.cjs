const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const replaceStart = '<div id="history-log" className="flex flex-wrap items-center mt-12 mb-6 gap-3 sm:gap-4 scroll-mt-24">';
const replaceEndMarker = '</div> &lt;70%ile</div>\n          </div>';

const startIndex = content.indexOf(replaceStart);
const endIndex = content.indexOf(replaceEndMarker) + replaceEndMarker.length;


if (startIndex !== -1 && endIndex > startIndex) {
   let newContent = content.substring(0, startIndex);
   newContent += `<MockHistoryGrid
          showRecycleBin={showRecycleBin}
          setShowRecycleBin={setShowRecycleBin}
          activeTrendFilteredMocks={activeTrendFilteredMocks}
          deletedMocks={deletedMocks}
          subjects={subjects}
          getSub={getSub}
          setActiveTab={setActiveTab}
          totalTasksCount={totalTasksCount}
          pendingTasksCount={pendingTasksCount}
          onDeleteMock={deleteMock}
          onEditMock={(mock) => {
            setMockToEdit(mock);
            setActiveTab('add-mock');
          }}
          onRestoreMock={restoreDeletedMock}
          onPermanentlyDeleteMock={permanentlyDeleteMock}
          onUpdateReflection={async (id, data) => {
             const currentMock = [...activeTrendFilteredMocks, ...deletedMocks].find(m => m.id === id);
             if (currentMock) {
                 await updateMock({ ...currentMock, ...data });
             }
          }}
        />`;
   newContent += content.substring(endIndex);
   content = newContent;
} else {
   console.log("Could not find start or end block.");
}


const statesRegex = /  const \[sortField, setSortField\] \= useState<string \| null>\(null\);\n  const \[sortDirection, setSortDirection\] \= useState\<\'asc\' \| \'desc\' \| null\>\(null\);\n\n  const \[chartView, setChartView\] \= useState\<\'bar\' \| \'radar\'\>\(\'bar\'\);\n  const \[showRecycleBin, setShowRecycleBin\] \= useState\(false\);\n  \n  const \[activeRowId, setActiveRowId\] \= useState<string \| null>\(null\);\n  const \[editingReflectionId, setEditingReflectionId\] \= useState<string \| null>\(null\);\n\n  const handleReflectionEditStart \= \(mock: MockScore\) \=\> \{\n    setActiveRowId\(mock\.id\);\n    setEditingReflectionId\(mock\.id\);\n  \};\n\n  const handleSort \= \(field: string\) \=\> \{\n    if \(sortField \=\=\= field\) \{\n      if \(sortDirection \=\=\= \'desc\'\) setSortDirection\(\'asc\'\);\n      else if \(sortDirection \=\=\= \'asc\'\) \{\n        setSortDirection\(null\);\n        setSortField\(null\);\n      \}\n    \} else \{\n      setSortField\(field\);\n      setSortDirection\(\'desc\'\);\n    \}\n  \};\n\n  const getSortConfig \= \(field: string\) \=\> \{\n    if \(sortField \!\=\= field\) return null;\n    return sortDirection \=\=\= \'desc\' \? \'⬇\' : \'⬆\';\n  \};\n\n/;


content = content.replace(statesRegex, "  const [chartView, setChartView] = useState<'bar' | 'radar'>('bar');\n  const [showRecycleBin, setShowRecycleBin] = useState(false);\n\n");


if (!content.includes('import { MockHistoryGrid }')) {
   content = content.replace(
      `import { DashboardCharts } from './dashboard/DashboardCharts';`,
      `import { DashboardCharts } from './dashboard/DashboardCharts';\nimport { MockHistoryGrid } from './dashboard/MockHistoryGrid';`
   );
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
