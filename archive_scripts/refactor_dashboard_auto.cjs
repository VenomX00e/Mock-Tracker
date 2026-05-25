const ts = require('typescript');
const fs = require('fs');

const reactGlobals = new Set(['any', 'React', 'Math', 'Date', 'parseInt', 'isNaN', 'console', 'window', 'document', 'setTimeout', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Error', 'undefined', 'event']);
const htmlTags = new Set(['div', 'span', 'p', 'a', 'button', 'input', 'img', 'svg', 'path', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li', 'ol', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'form', 'textarea', 'label', 'select', 'option', 'iframe']);
const jsxProps = new Set(['className', 'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onInput', 'onBlur', 'style', 'src', 'alt', 'type', 'value', 'placeholder', 'disabled', 'rows', 'maxLength', 'autoComplete', 'spellCheck', 'name', 'id', 'min', 'max', 'step', 'checked', 'key', 'colSpan', 'target', 'rel', 'href', 'drag', 'dragConstraints', 'dragElastic', 'onDragEnd', 'stroke', 'fill', 'cx', 'cy', 'r', 'width', 'height', 'viewBox', 'xmlns', 'viewBox']);

function getUsedVars(codeSnippet) {
   const sourceFile = ts.createSourceFile('temp.tsx', codeSnippet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
   let usedVars = new Set();
   let declaredVars = new Set();
   
   function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declaredVars.add(node.name.text);
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) declaredVars.add(node.name.text);

      if (ts.isIdentifier(node)) {
         let isUsage = true;
         if (node.parent && ts.isParameter(node.parent) && node.parent.name === node) isUsage = false;
         if (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name === node) isUsage = false;
         if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) isUsage = false;
         if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) isUsage = false;
         if (node.parent && ts.isMethodDeclaration(node.parent) && node.parent.name === node) isUsage = false;
         if (node.parent && ts.isTypeReferenceNode(node.parent)) isUsage = false;
         if (node.parent && ts.isInterfaceDeclaration(node.parent)) isUsage = false;
         
         // Fix for JSX attributes like `options={...}` being caught:
         if (node.parent && ts.isJsxAttribute(node.parent) && node.parent.name === node) isUsage = false;

         if (isUsage) usedVars.add(node.text);
      }
      ts.forEachChild(node, visit);
   }
   visit(sourceFile);
   
   return Array.from(usedVars).filter(v => 
      !reactGlobals.has(v) && 
      !htmlTags.has(v) && 
      !jsxProps.has(v) &&
      !declaredVars.has(v) &&
      !v.includes('-')
   );
}

function processDashboard() {
    let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

    // Stats
    const statsStart = code.indexOf('{/* Quick Stats Cards */}');
    const chartStart = code.indexOf('{/* Chart: Percentile Trend */}');
    const statsBlock = code.substring(statsStart, chartStart).trimEnd();
    
    // Percentile Trend Chart
    const secChartStart = code.indexOf('{/* Chart: Sectional Scores */}');
    const pcBlock = code.substring(chartStart, secChartStart).trimEnd();

    // Sectional Chart
    const insightStart = code.indexOf('{/* Smart Insights */}');
    const secBlock = code.substring(secChartStart, insightStart).trimEnd();

    const statsVars = getUsedVars(`const temp = () => { return <>${statsBlock}</> }`);
    const pcVars = getUsedVars(`const temp = () => { return <>${pcBlock}</> }`);
    const secVars = getUsedVars(`const temp = () => { return <>${secBlock}</> }`);

    const newComponents = `
// ==========================================
// Phase 9: Monolithic View Decomposition
// ==========================================

function DashboardStats(props: any) {
  const { ${statsVars.join(', ')} } = props;
  return <>
    ${statsBlock}
  </>
}

function DashboardPercentileTrend(props: any) {
  const { ${pcVars.join(', ')} } = props;
  return <>
    ${pcBlock}
  </>
}

function DashboardSectionalScores(props: any) {
  const { ${secVars.join(', ')} } = props;
  return <>
    ${secBlock}
  </>
}
`;

    let newRender = code;
    newRender = newRender.replace(statsBlock, `<DashboardStats ${statsVars.map(v => `${v}={${v}}`).join(' ')} />`);
    newRender = newRender.replace(pcBlock, `<DashboardPercentileTrend ${pcVars.map(v => `${v}={${v}}`).join(' ')} />`);
    newRender = newRender.replace(secBlock, `<DashboardSectionalScores ${secVars.map(v => `${v}={${v}}`).join(' ')} />`);

    newRender = newRender + '\\n' + newComponents;

    fs.writeFileSync('src/components/Dashboard.tsx', newRender);
    console.log('Successfully refactored Dashboard!');
}

processDashboard();
