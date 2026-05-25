import React, { useContext } from 'react';
import Dashboard from './Dashboard';
import CommunityHub from './CommunityHub';
import { TasksPage } from './TasksPage';
import AdminDialog from './AdminDialog';
import AddMockDialog from './AddMockDialog';
import ProfileDialog from './ProfileDialog';
import { CountdownsPage } from './views/CountdownsPage';
import { useUIStore } from '../store/uiStore';
import { AppStateCtx, SystemDataCtx } from '../context/AppContext';
import { useMocks } from '../hooks/useMocks';

export const ViewManager = () => {
  const { activeTab, setActiveTab, adminTab, theme, setTheme } = useUIStore();
  const { isOwner, isAdmin, adminPermissions } = useContext(AppStateCtx)!;
  const { mockToEdit, setMockToEdit, adminEditNotice, adminEditCountdown } = useUIStore();
  const { selectedCategory, categories } = useContext(SystemDataCtx)!;
  const { addMock, updateMock } = useMocks();

  const handleMockSave = async (mock: any) => {
    if (mockToEdit?.id) {
      await updateMock(mock);
    } else {
      await addMock(mock);
    }
    setActiveTab('dashboard');
    if (mockToEdit) {
      setTimeout(() => {
        document.getElementById('history-log')?.scrollIntoView({ behavior: 'smooth' });
        setMockToEdit(undefined);
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleMockClose = () => {
    setActiveTab('dashboard');
    if (mockToEdit) {
      setTimeout(() => {
        document.getElementById('history-log')?.scrollIntoView({ behavior: 'smooth' });
        setMockToEdit(undefined);
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'admin':
        if (!isAdmin) return null;
        return (
          <AdminDialog
            isOpen={true}
            isOwner={isOwner}
            adminPermissions={adminPermissions}
            currentCategory={selectedCategory}
            asPage={true}
            initialTab={adminTab || ((!isOwner && adminPermissions) ? (
                 adminPermissions.canManageUsers ? 'users' :
                 adminPermissions.canManageLiveMocks ? 'liveMock' :
                 adminPermissions.canManageNotices ? 'notice' :
                 adminPermissions.canManageCountdowns ? 'countdown' :
                 adminPermissions.canManageChallenges ? 'challenge' :
                 adminPermissions.canManageSettings ? 'settings' : 
                 adminPermissions.canManageQuotes ? 'quotes' : 'users'
            ) : 'users') as any}
            editNoticeData={adminEditNotice}
            editCountdownData={adminEditCountdown}
            categories={categories}
          />
        );
      case 'tasks':
        return <TasksPage />;
      case 'add-mock':
        return (
          <AddMockDialog
            isOpen={true}
            asPage={true}
            onClose={handleMockClose}
            categories={categories}
            initialMock={mockToEdit}
            categoryId={selectedCategory}
            onSave={handleMockSave}
          />
        );
      case 'profile':
        return (
          <ProfileDialog
            isOpen={true}
            asPage={true}
            onClose={() => setActiveTab('dashboard')}
            theme={theme}
            setTheme={setTheme}
            categories={categories}
          />
        );
      case 'community':
        return <CommunityHub />;
      case 'countdowns':
        return <CountdownsPage />;
      default:
        return null;
    }
  };

  return (
    <section className={`w-full flex-1 ${['admin', 'profile', 'countdowns'].includes(activeTab) ? 'min-h-0' : ''} flex flex-col`}>
      <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
        <div className="w-full">
          <Dashboard />
        </div>
      </div>

      {activeTab !== 'dashboard' && (
        <div className={`w-full flex-1 ${['admin', 'profile', 'countdowns'].includes(activeTab) ? 'min-h-0' : ''} flex flex-col`}>
          {renderActiveView()}
        </div>
      )}
    </section>
  );
};
