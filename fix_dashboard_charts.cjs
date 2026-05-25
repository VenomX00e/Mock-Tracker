const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// Replace the renderCustomBarLabel
const renderCustomBarLabelRegex = /const renderCustomBarLabel \= \(props: any\) \=\> \{[\s\S]*?\};\n\n/;
content = content.replace(renderCustomBarLabelRegex, '');

// Replace the charts body
const chartsRegex = /\{\/\* Chart: Percentile Trend \*\/\}([\s\S]*?)\{\/\* Smart Insights \*\/\}/;

const replacement = `<DashboardCharts
              activeTrendId={activeTrendId}
              setActiveTrendId={setActiveTrendId}
              selectedTrendPeriod={selectedTrendPeriod}
              setSelectedTrendPeriod={setSelectedTrendPeriod}
              subjects={subjects}
              chartView={chartView}
              setChartView={setChartView}
              activeTrendFilteredChronologicalMocks={activeTrendFilteredChronologicalMocks}
              overallTrendAveragesData={overallTrendAveragesData}
              averageTrendLineValue={averageTrendLineValue}
              flattenedData={flattenedData}
              displayedMocks={displayedMocks}
              stats={stats}
              getSub={getSub}
              getSubjectColor={getSubjectColor}
              parseLocalDate={parseLocalDate}
            />\n\n          {/* Smart Insights */}`;

content = content.replace(chartsRegex, replacement);

if (!content.includes("import { DashboardCharts }")) {
  content = content.replace(
    `import { ReflectionEditor } from './ReflectionEditor';`,
    `import { ReflectionEditor } from './ReflectionEditor';\nimport { DashboardCharts } from './dashboard/DashboardCharts';`
  );
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
