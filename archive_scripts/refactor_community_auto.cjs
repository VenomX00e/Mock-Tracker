const ts = require('typescript');
const fs = require('fs');

const reactGlobals = new Set(['any', 'React', 'Math', 'Date', 'parseInt', 'isNaN', 'console', 'window', 'document', 'setTimeout', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Error', 'undefined', 'event']);
const htmlTags = new Set(['div', 'span', 'p', 'a', 'button', 'input', 'img', 'svg', 'path', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'li', 'ol', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'form', 'textarea', 'label', 'select', 'option', 'iframe']);
const jsxProps = new Set(['className', 'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onInput', 'onBlur', 'style', 'src', 'alt', 'type', 'value', 'placeholder', 'disabled', 'rows', 'maxLength', 'autoComplete', 'spellCheck', 'name', 'id', 'min', 'max', 'step', 'checked', 'key', 'colSpan', 'target', 'rel', 'href']);

function getUsedVars(codeSnippet) {
   const sourceFile = ts.createSourceFile('temp.tsx', codeSnippet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
   let usedVars = new Set();
   let declaredVars = new Set();
   
   function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          declaredVars.add(node.name.text);
      }
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
          declaredVars.add(node.name.text);
      }
      // handle destructured parameters/declarations roughly if needed, but usually we just want top-level

      if (ts.isIdentifier(node)) {
         let isUsage = true;
         // Exclude parameter names in declarations
         if (node.parent && ts.isParameter(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude variable declaration names
         if (node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude property accesses right side
         if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude object literal keys
         if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude method declaration names
         if (node.parent && ts.isMethodDeclaration(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude type references
         if (node.parent && ts.isTypeReferenceNode(node.parent)) isUsage = false;
         if (node.parent && ts.isInterfaceDeclaration(node.parent)) isUsage = false;

         if (isUsage) {
             usedVars.add(node.text);
         }
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

    const leaderStart = code.lastIndexOf('<div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">', code.indexOf('{/* FEED */}'));
    const leaderEnd = code.indexOf('{/* FEED */}');
    const leaderBlock = code.substring(leaderStart, leaderEnd);
    
    // There are some JSX boundaries. The last </div> of Leaderboard is right before {/* FEED */}.
    // Actually, Leaderboard is wrapped in a `<div className="space-y-8 mt-6 lg:mt-8 mb-4">` that wraps everything.
    // So the replacement needs to be careful.

    console.log("Found leader block length:", leaderBlock.length);
    console.log("Vars:", getUsedVars(`const temp = () => { return ${leaderBlock} }`));
}

processCommunityHub();
