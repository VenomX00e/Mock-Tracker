const ts = require('typescript');
const fs = require('fs');

const reactGlobals = new Set(['any', 'React', 'Math', 'Date', 'parseInt', 'isNaN', 'console', 'window', 'document', 'setTimeout', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Error', 'undefined', 'event']);
const htmlTags = new Set(['div', 'span', 'p', 'a', 'button', 'input', 'img', 'svg', 'path', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li', 'ol', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'form', 'textarea', 'label', 'select', 'option', 'iframe']);
const jsxProps = new Set(['className', 'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onInput', 'onBlur', 'style', 'src', 'alt', 'type', 'value', 'placeholder', 'disabled', 'rows', 'maxLength', 'autoComplete', 'spellCheck', 'name', 'id', 'min', 'max', 'step', 'checked', 'key', 'colSpan', 'target', 'rel', 'href', 'drag', 'dragConstraints', 'dragElastic', 'onDragEnd']);

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

         if (isUsage) usedVars.add(node.text);
      }
      ts.forEachChild(node, visit);
   }
   visit(sourceFile);
   
   return Array.from(usedVars).filter(v => 
      !reactGlobals.has(v) && 
      !htmlTags.has(v) && 
      !jsxProps.has(v) &&
      !declaredVars.has(v)
   );
}

function processCommunityHub() {
    let code = fs.readFileSync('src/components/CommunityHub.tsx', 'utf8');

    // Find boundaries
    const leaderStart = code.lastIndexOf('<div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">', code.indexOf('{/* FEED */}'));
    const leaderEnd = code.indexOf('{/* FEED */}');
    const leaderBlock = code.substring(leaderStart, leaderEnd).trimEnd();
    
    const feedStart = code.indexOf('{/* FEED */}');
    const feedEnd = code.indexOf('{/* CHAT SECTION */}');
    const feedBlock = code.substring(feedStart, feedEnd).trimEnd();
    
    const chatStart = code.indexOf('{/* CHAT SECTION */}');
    const trashModalStart = code.indexOf('{showTrash');
    const chatEnd = code.lastIndexOf('</div>', trashModalStart) + 6;
    const chatBlock = code.substring(chatStart, chatEnd).trimEnd();

    const leaderVars = getUsedVars(`const temp = () => { return ${leaderBlock} }`);
    const feedVars = getUsedVars(`const temp = () => { return <>${feedBlock}</> }`);
    const chatVars = getUsedVars(`const temp = () => { return <>${chatBlock}</> }`);

    console.log("Leader Vars count:", leaderVars.length);
    console.log("Feed Vars count:", feedVars.length);
    console.log("Chat Vars count:", chatVars.length);

    const newComponents = `
// ==========================================
// Phase 9: Monolithic View Decomposition
// ==========================================

function CommunityLeaderboard(props: any) {
  const { ${leaderVars.join(', ')} } = props;
  return ${leaderBlock}
}

function CommunityFeed(props: any) {
  const { ${feedVars.join(', ')} } = props;
  return <>
    ${feedBlock}
  </>
}

function CommunityChat(props: any) {
  const { ${chatVars.join(', ')} } = props;
  return <>
    ${chatBlock}
  </>
}
`;

    let newRender = code;
    newRender = newRender.replace(leaderBlock, `<CommunityLeaderboard ${leaderVars.map(v => `${v}={${v}}`).join(' ')} />`);
    newRender = newRender.replace(feedBlock, `<CommunityFeed ${feedVars.map(v => `${v}={${v}}`).join(' ')} />`);
    newRender = newRender.replace(chatBlock, `<CommunityChat ${chatVars.map(v => `${v}={${v}}`).join(' ')} />`);

    newRender = newRender + '\n' + newComponents;

    fs.writeFileSync('src/components/CommunityHub.tsx', newRender);
    console.log('Successfully refactored CommunityHub!');
}

processCommunityHub();
