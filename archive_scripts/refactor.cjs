const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDialog.tsx', 'utf8');

function extractAndReplace(tabName, functionName) {
  const startMarker = `{activeTab === '${tabName}' && (isOwner || adminPermissions?.canManage${tabName === 'liveMock' ? 'LiveMocks' : tabName === 'notice' ? 'Notices' : tabName === 'countdown' ? 'Countdowns' : 'Challenges'}) && (`;
  const idxStart = code.indexOf(startMarker);
  if(idxStart === -1) {
    console.error("Could not find start for", tabName);
    return;
  }
  
  let braceCount = 0;
  let parenCount = 0;
  let endIdx = -1;
  const matchStr = startMarker;
  for(let i = idxStart + matchStr.length - 1; i < code.length; i++) {
    if(code[i] === '(') parenCount++;
    if(code[i] === ')') {
        parenCount--;
        if(parenCount === 0) {
           endIdx = i;
           break;
        }
    }
  }
  
  if(endIdx === -1) {
      console.error("Could not match parens for", tabName);
      return;
  }
  
  const content = code.substring(idxStart + matchStr.length, endIdx);
  
  code = code.substring(0, idxStart) + `{activeTab === '${tabName}' && !adminCategoryScope && (isOwner || adminPermissions?.canManage${tabName === 'liveMock' ? 'LiveMocks' : tabName === 'notice' ? 'Notices' : tabName === 'countdown' ? 'Countdowns' : 'Challenges'}) && (\n            ${functionName}()\n          )}` + code.substring(endIdx + 1);
  
  const returnIdx = code.indexOf('const content = (');
  code = code.substring(0, returnIdx) + `  const ${functionName} = () => (${content});\n\n` + code.substring(returnIdx);
}

extractAndReplace('liveMock', 'renderLiveMockContent');
extractAndReplace('notice', 'renderNoticeContent');
extractAndReplace('countdown', 'renderCountdownContent');
extractAndReplace('challenge', 'renderChallengeContent');

code = code.replace(
  `          {activeTab === 'categories' && isOwner && (
            <AdminCategoriesTab onManageSection={(sec, catId) => {
               setAdminCategoryScope(catId);
               setActiveTab(sec as any);
            }} />
          )}`,
  `          {activeTab === 'categories' && isOwner && (
            <AdminCategoriesTab
              onManageSection={(sec, catId) => {
                 setAdminCategoryScope(catId);
                 setActiveTab(sec as any);
              }}
              onCategorySelect={(catId) => {
                 setAdminCategoryScope(catId);
              }}
              renderLiveMock={() => (isOwner || adminPermissions?.canManageLiveMocks) ? renderLiveMockContent() : <div className="p-4 text-slate-500">Access Denied</div>}
              renderNotice={() => (isOwner || adminPermissions?.canManageNotices) ? renderNoticeContent() : <div className="p-4 text-slate-500">Access Denied</div>}
              renderCountdown={() => (isOwner || adminPermissions?.canManageCountdowns) ? renderCountdownContent() : <div className="p-4 text-slate-500">Access Denied</div>}
              renderChallenge={() => (isOwner || adminPermissions?.canManageChallenges) ? renderChallengeContent() : <div className="p-4 text-slate-500">Access Denied</div>}
            />
          )}`
);

code = code.replace(
  `const renderCategoryPills = () => (`,
  `const renderCategoryPills = () => {\n    if (adminCategoryScope) return null;\n    return (`
);
code = code.replace(
  `    </div>\n  );`,
  `    </div>\n  );\n  };`
);

fs.writeFileSync('src/components/AdminDialog.tsx', code);
console.log('done');
