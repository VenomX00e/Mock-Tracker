const ts = require('typescript');
const fs = require('fs');

function extractVars(codeSnippet, globals) {
   const sourceFile = ts.createSourceFile('temp.tsx', codeSnippet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
   let usedVars = new Set();
   
   function visit(node) {
      if (ts.isIdentifier(node)) {
         // check if it's a variable usage and not a property access or declaration
         let isUsage = true;
         if (node.parent) {
             if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) {
                 isUsage = false;
             }
             if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
                 isUsage = false;
             }
             if (ts.isMethodDeclaration(node.parent) && node.parent.name === node) {
                 isUsage = false;
             }
             // ... there are more, but let's just get a rough list
         }
         if (isUsage) {
             usedVars.add(node.text);
         }
      }
      ts.forEachChild(node, visit);
   }
   visit(sourceFile);
   return Array.from(usedVars).filter(v => !globals.includes(v));
}

console.log(extractVars('<div onClick={() => setX(y + z.prop)}>{propC}</div>', ['div']));
