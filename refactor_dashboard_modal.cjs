const fs = require('fs');
const path = require('path');

const dashboardPath = 'src/components/Dashboard.tsx';
let dCode = fs.readFileSync(dashboardPath, 'utf8');

// Find where states are
const statesStartRegex = /const \[showCompletedTasks/;
const lastStateRegex = /const \[expandedActionMocks, setExpandedActionMocks\] = useState<Record<string, boolean>>\(\{\}\);/;

const statesStartIdx = dCode.search(statesStartRegex);
const lastStateIdx = dCode.search(lastStateRegex);

// Extract the states:
const statesCode = dCode.substring(statesStartIdx, lastStateIdx + 'const [expandedActionMocks, setExpandedActionMocks] = useState<Record<string, boolean>>({});'.length);

// Extract the render block:
const renderStartStr = "{/* Action Items Modal */}\n          {showTasksModal && createPortal(";
const renderStartIdx = dCode.indexOf(renderStartStr);

let braceCount = 0;
let renderEndIdx = -1;

for(let i = renderStartIdx + 30; i < dCode.length; i++) {
   if (dCode[i] === '{') braceCount++;
   else if (dCode[i] === '}') {
      if (braceCount === 0 && dCode.substr(i, 20).includes('document.body)}')) {
          renderEndIdx = i + 'document.body)}'.length;
          break;
      } else {
          braceCount--;
      }
   }
}

if(renderEndIdx === -1) {
   console.error("Could not find end of ActionItemsModal render loop");
   process.exit(1);
}

const renderCodeStart = dCode.substring(renderStartIdx, renderEndIdx);

// It has a trailing parenthesis maybe? Let's fix that.
let actualRenderCode = renderCodeStart;
// Remove leading "{showTasksModal && createPortal(" and trailing ", document.body)}"
// It is embedded in JSX. So actual component should just return the first argument of createPortal
// Or wait, we can compose ActionItemsModal with createPortal in its render!
// Just return actualRenderCode?
// we don't return "{...}" directly, we just return the JSX. 

const modalComponentCode = `import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { CheckSquare, X, Check, Edit2, Trash2, CalendarDays } from 'lucide-react';
import { MockScore, UserProfile, ReflectionTask } from '../../types';
import { getPlatformShort, parseLocalDate } from '../../lib/utils';
import { InlineTaskEditor } from './InlineTaskEditor';
import { TaskProgressDisk } from '../TasksTile';

interface ActionItemsModalProps {
   showTasksModal: boolean;
   setShowTasksModal: (show: boolean) => void;
   mocks: MockScore[];
   profile?: UserProfile;
   onUpdateProfileTasks?: (tasks: ReflectionTask[]) => Promise<void>;
   onUpdateReflection?: (id: string, updates: Partial<MockScore>) => Promise<void>;
}

export function ActionItemsModal({
   showTasksModal,
   setShowTasksModal,
   mocks,
   profile,
   onUpdateProfileTasks,
   onUpdateReflection
}: ActionItemsModalProps) {
  ${statesCode}

  if (!showTasksModal) return null;

  return createPortal(
    ${actualRenderCode.substring('{/* Action Items Modal */}\n          {showTasksModal && createPortal('.length).replace(/, document\.body\)}$/, ', document.body')}
  );
}
`;

fs.writeFileSync('src/components/dashboard/ActionItemsModal.tsx', modalComponentCode);

// Remove the extracted parts from Dashboard
let newDcode = dCode.substring(0, statesStartIdx) + dCode.substring(lastStateIdx + 'const [expandedActionMocks, setExpandedActionMocks] = useState<Record<string, boolean>>({});'.length);

const renderStartIdx2 = newDcode.indexOf(renderStartStr);
let braceCount2 = 0;
let renderEndIdx2 = -1;

for(let i = renderStartIdx2 + 30; i < newDcode.length; i++) {
   if (newDcode[i] === '{') braceCount2++;
   else if (newDcode[i] === '}') {
      if (braceCount2 === 0 && newDcode.substr(i, 20).includes('document.body)}')) {
          renderEndIdx2 = i + 'document.body)}'.length;
          break;
      } else {
          braceCount2--;
      }
   }
}

newDcode = newDcode.substring(0, renderStartIdx2) + 
`{/* Action Items Modal */}
          <ActionItemsModal 
            showTasksModal={showTasksModal}
            setShowTasksModal={setShowTasksModal}
            mocks={mocks}
            profile={profile}
            onUpdateProfileTasks={onUpdateProfileTasks}
            onUpdateReflection={onUpdateReflection}
          />` 
+ newDcode.substring(renderEndIdx2);

// Add import
const importIdx = newDcode.indexOf('import { TaskProgressDisk');
newDcode = newDcode.substring(0, importIdx) + `import { ActionItemsModal } from './dashboard/ActionItemsModal';\n` + newDcode.substring(importIdx);

fs.writeFileSync(dashboardPath, newDcode);
console.log('ActionItemsModal extracted!');
