const fs = require('fs');
const path = require('path');

const adminDir = 'src/components/admin';
if (!fs.existsSync(adminDir)) {
  fs.mkdirSync(adminDir, { recursive: true });
}

let code = fs.readFileSync('src/components/AdminCategoriesTab.tsx', 'utf8');

const optStart = code.indexOf('function OptionManagerDropdown');
const subStart = code.indexOf('function SubjectManager');
const tabStart = code.indexOf('export function AdminCategoriesTab');

const optCode = code.substring(optStart, subStart);
const subCode = code.substring(subStart, tabStart);

const imports = `import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, X, Edit2, ChevronRight, ChevronDown, Check } from "lucide-react";
`;

fs.writeFileSync(path.join(adminDir, 'OptionManagerDropdown.tsx'), imports + optCode.replace('function OptionManagerDropdown', 'export function OptionManagerDropdown'));
fs.writeFileSync(path.join(adminDir, 'SubjectManager.tsx'), imports + subCode.replace('function SubjectManager', 'export function SubjectManager'));

const newCode = code.substring(0, optStart) + `import { OptionManagerDropdown } from './admin/OptionManagerDropdown';\nimport { SubjectManager } from './admin/SubjectManager';\n\n` + code.substring(tabStart);

fs.writeFileSync('src/components/AdminCategoriesTab.tsx', newCode);
console.log('Admin bits extracted!');
