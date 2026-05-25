const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const regex = /      \{\/\* Tabs \*\/\}\n      \{mocks\.length \> 0 && \([\s\S]*?\)\}\n\n      \{selectedExam \!\=\= \'All\' && \(availableRoles\.length \> 1 \|\| availablePhases\.length \> 1 \|\| availableScopes\.length \> 1\) && \([\s\S]*?      \)\}/;

const replacement = `      {/* Tabs */}
      <DashboardFilters
        examTypes={examTypes}
        selectedExam={selectedExam}
        setSelectedExam={setSelectedExam}
        availableRoles={availableRoles}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        availablePhases={availablePhases}
        selectedPhase={selectedPhase}
        setSelectedPhase={setSelectedPhase}
        availableScopes={availableScopes}
        selectedScope={selectedScope}
        setSelectedScope={setSelectedScope}
        hasMocks={mocks.length > 0}
      />`;

content = content.replace(regex, replacement);

if (!content.includes('import { DashboardFilters }')) {
  content = content.replace(
      `import { DashboardCharts } from './dashboard/DashboardCharts';`,
      `import { DashboardCharts } from './dashboard/DashboardCharts';\nimport { DashboardFilters } from './dashboard/DashboardFilters';`
  );
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
