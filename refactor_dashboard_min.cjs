const fs = require('fs');
const path = require('path');

const dashboardPath = 'src/components/Dashboard.tsx';
let code = fs.readFileSync(dashboardPath, 'utf8');

// The strategy is to write out independent components from outside Dashboard

const componentsDir = 'src/components/dashboard';
if (!fs.existsSync(componentsDir)) {
  fs.mkdirSync(componentsDir, { recursive: true });
}

// Extract PortalContent
const pContentStart = code.indexOf('const PortalContent = ');
const pContentEndStr = code.indexOf('const CustomTooltip =');
let portalContentCode = code.substring(pContentStart, pContentEndStr);

// Extract CustomTooltip
const customTooltipStart = pContentEndStr;
const renderCustomBarLabelStart = code.indexOf('const renderCustomBarLabel =');
let customTooltipCode = code.substring(customTooltipStart, renderCustomBarLabelStart);

// Extract renderCustomBarLabel & InlineTaskEditor
const inlineTaskEditorStart = code.indexOf('function InlineTaskEditor');
const dashboardStart = code.indexOf('export default function Dashboard');
let inlineTaskEditorCode = code.substring(inlineTaskEditorStart, dashboardStart);

// Let's create these files.
const importsTooltip = `import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MockScore } from '../../types';
import { getHeatmapColor } from '../../lib/utils';
`;

fs.writeFileSync(path.join(componentsDir, 'TooltipComponents.tsx'), importsTooltip + '\n' + portalContentCode + '\n' + customTooltipCode);

fs.writeFileSync(path.join(componentsDir, 'InlineTaskEditor.tsx'), `import React, { useState } from 'react';

` + inlineTaskEditorCode);

// Remove them from Dashboard, and prepend imports
code = code.substring(0, pContentStart) + 
`import { PortalContent, CustomTooltip } from './dashboard/TooltipComponents';
import { InlineTaskEditor } from './dashboard/InlineTaskEditor';

const renderCustomBarLabel = ` + code.substring(renderCustomBarLabelStart + 'const renderCustomBarLabel = '.length, inlineTaskEditorStart) + code.substring(dashboardStart);

// Let's also export CustomTooltip and PortalContent
let tcFile = fs.readFileSync(path.join(componentsDir, 'TooltipComponents.tsx'), 'utf8');
tcFile = tcFile.replace('const PortalContent =', 'export const PortalContent =');
tcFile = tcFile.replace('const CustomTooltip =', 'export const CustomTooltip =');
fs.writeFileSync(path.join(componentsDir, 'TooltipComponents.tsx'), tcFile);

let iteFile = fs.readFileSync(path.join(componentsDir, 'InlineTaskEditor.tsx'), 'utf8');
iteFile = iteFile.replace('function InlineTaskEditor', 'export function InlineTaskEditor');
fs.writeFileSync(path.join(componentsDir, 'InlineTaskEditor.tsx'), iteFile);

fs.writeFileSync(dashboardPath, code);

console.log('Extracted tooltip and inline editor.');
