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

const renderEndIdx = dCode.indexOf('</div>, document.body)}') + '</div>, document.body)}'.length;

let renderCodeStart = dCode.substring(renderStartIdx, renderEndIdx);

let strippedRenderCode = renderCodeStart.substring('{/* Action Items Modal */}\n          {showTasksModal && createPortal('.length);
strippedRenderCode = strippedRenderCode.replace('</div>, document.body)}', '</div>, document.body)');

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
    ${strippedRenderCode}
  );
}
`;

fs.writeFileSync('src/components/dashboard/ActionItemsModal.tsx', modalComponentCode);

// Remove the extracted parts from Dashboard
let newDcode = dCode.substring(0, statesStartIdx) + dCode.substring(lastStateIdx + 'const [expandedActionMocks, setExpandedActionMocks] = useState<Record<string, boolean>>({});'.length);

const renderStartIdx2 = newDcode.indexOf(renderStartStr);
const renderEndIdx2 = newDcode.indexOf('</div>, document.body)}') + '</div>, document.body)}'.length;

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
