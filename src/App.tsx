import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AddMockDialog from './components/AddMockDialog';
import { useMocks } from './hooks/useMocks';
import { useAuth } from './services/AuthContext';
import { MockScore } from './types';
import { Plus, Target, LayoutDashboard, DatabaseZap, LogOut, LogIn } from 'lucide-react';

export default function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const { mocks, loading: mocksLoading, addMock, updateMock, deleteMock } = useMocks();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [mockToEdit, setMockToEdit] = useState<MockScore | undefined>(undefined);
  const [lastDeletedMock, setLastDeletedMock] = useState<MockScore | null>(null);

  const handleEditMock = (mock: MockScore) => {
    setMockToEdit(mock);
    setIsAddModalOpen(true);
  };

  const handleDeleteMock = (id: string) => {
    const mockToDelete = mocks.find(m => m.id === id);
    if (mockToDelete) {
      setLastDeletedMock(mockToDelete);
      deleteMock(id);
      
      // Auto-clear the undo option after 15 seconds
      setTimeout(() => {
        setLastDeletedMock(current => current?.id === mockToDelete.id ? null : current);
      }, 15000);
    }
  };

  const handleRestoreMock = () => {
    if (lastDeletedMock) {
      addMock(lastDeletedMock);
      setLastDeletedMock(null);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setTimeout(() => setMockToEdit(undefined), 300); // Clear after animation
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                Bank Exam Mock Tracker
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-xs font-semibold text-slate-700">{user.displayName}</span>
                    <span className="text-[10px] text-slate-500">{user.email}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <Plus className="w-4 h-4 text-white sm:mr-1.5" />
                    <span className="hidden sm:inline">Add Mock</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {!user ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto px-4">
             <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-8 text-blue-600 shadow-inner">
              <DatabaseZap className="w-10 h-10" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Track Your Mock Exams Intelligently
            </h2>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed">
              Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
              Safely store your historical data across all sessions and track your sectional weak points.
            </p>
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In to Start Tracking
            </button>
          </div>
        ) : (
          <>
            {/* Banner */}
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <DatabaseZap className="w-48 h-48" />
              </div>
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-2xl font-semibold mb-2">Track your progress to crack the exam</h2>
                <p className="text-indigo-200 text-sm leading-relaxed mb-6">
                  Upload your mock test scorecard images. Our AI will automatically extract your scores and percentiles. 
                  Analyze your performance across different exams and identify your weak sections.
                </p>
                <div className="flex items-center gap-4 text-sm font-medium text-indigo-100">
                  <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                    <Target className="w-4 h-4" /> AI Data Extraction
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                    <LayoutDashboard className="w-4 h-4" /> Sectional Analytics
                  </div>
                </div>
              </div>
            </div>

            <section className="w-full">
              {mocksLoading ? (
                 <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : (
                <Dashboard 
                  mocks={mocks} 
                  onDeleteMock={handleDeleteMock} 
                  onEditMock={handleEditMock} 
                  lastDeletedMock={lastDeletedMock}
                  onRestoreMock={handleRestoreMock}
                />
              )}
            </section>
          </>
        )}
      </main>

      {/* Add Mock Modal */}
      {user && (
        <AddMockDialog 
          isOpen={isAddModalOpen} 
          onClose={handleCloseModal} 
          initialMock={mockToEdit}
          onSave={(mock) => {
            if (mock.id) {
              updateMock(mock);
            } else {
              addMock(mock);
            }
            handleCloseModal();
          }} 
        />
      )}
    </div>
  );
}
