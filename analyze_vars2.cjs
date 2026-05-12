const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const reactGlobals = ['React', 'Math', 'Date', 'parseInt', 'isNaN', 'console', 'window', 'document', 'setTimeout', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise', 'Error', 'undefined'];

function extractVars(codeSnippet) {
   const sourceFile = ts.createSourceFile('temp.tsx', codeSnippet, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
   let usedVars = new Set();
   
   function visit(node) {
      if (ts.isIdentifier(node)) {
         let isUsage = true;
         // Exclude property accesses right side
         if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude object literal keys
         if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude method declaration names
         if (node.parent && ts.isMethodDeclaration(node.parent) && node.parent.name === node) isUsage = false;
         // Exclude interface/type declarations
         if (node.parent && ts.isTypeReferenceNode(node.parent)) isUsage = false;
         if (node.parent && ts.isInterfaceDeclaration(node.parent)) isUsage = false;
         // Exclude JSX element names (like div, span) but we will filter lowercase later
         if (isUsage) {
             usedVars.add(node.text);
         }
      }
      ts.forEachChild(node, visit);
   }
   visit(sourceFile);
   return Array.from(usedVars).filter(v => 
      !reactGlobals.includes(v) && 
      !/^[a-z][a-z0-9]*$/.test(v) && 
      v !== 'className' && v !== 'onClick' && v !== 'onChange' && v !== 'onSubmit'
   );
}
// wait, my lowercase filter `^[a-z][a-z0-9]*$` will filter out `userMap`, `sortConfig`, etc!! It should ONLY filter out HTML tags!
// I'll rewrite it.
