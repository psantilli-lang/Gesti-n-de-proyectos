/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SAPProject, StageAction, UserSession, AttachedFile, AppUser } from './types/project';
import { storageService } from './services/storageService';
import { Header } from './components/Header';
import { WeeklyReviewView } from './components/WeeklyReviewView';
import { ProjectsListView } from './components/ProjectsListView';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { ProjectFormModal } from './components/ProjectFormModal';
import { AddActionModal, EditActionModal } from './components/ActionModals';
import { ReportsView } from './components/ReportsView';
import { PendingTasksView } from './components/PendingTasksView';
import { PrioritizationView } from './components/PrioritizationView';
import { FilePreviewModal } from './components/FilePreviewModal';
import { LoginView } from './components/LoginView';
import { UserManagementModal } from './components/UserManagementModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { googleSheetsSyncService } from './services/googleSheetsSyncService';
import { initAuth, getAccessToken, getCurrentGoogleUser } from './services/googleAuthService';
import { isActionAssignedToUser, isPMO } from './utils/helpers';

export default function App() {
  const [projects, setProjects] = useState<SAPProject[]>(() => storageService.getProjects());
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => storageService.getCurrentUser());
  const [usersList, setUsersList] = useState<AppUser[]>(() => storageService.getUsers());

  const [activeTab, setActiveTab] = useState<'weekly' | 'tasks' | 'prioritization' | 'projects' | 'reports'>('weekly');

  // Google Sheets synchronization state
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [sheetsSyncState, setSheetsSyncState] = useState<{
    lastSyncAt: string | null;
    isSyncing: boolean;
    isConnected: boolean;
    spreadsheetUrl: string | null;
  }>(() => {
    const cfg = googleSheetsSyncService.getConfig();
    return {
      lastSyncAt: cfg.lastSyncAt,
      isSyncing: false,
      isConnected: !!getAccessToken() || !!getCurrentGoogleUser(),
      spreadsheetUrl: cfg.spreadsheetUrl,
    };
  });

  // Listen to Google Auth status
  useEffect(() => {
    const unsub = initAuth(
      (_user, token) => {
        const cfg = googleSheetsSyncService.getConfig();
        setSheetsSyncState((prev) => ({
          ...prev,
          isConnected: !!token,
          spreadsheetUrl: cfg.spreadsheetUrl,
        }));
      },
      () => {
        setSheetsSyncState((prev) => ({
          ...prev,
          isConnected: false,
        }));
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Debounced Auto-sync with Google Sheets whenever projects change
  useEffect(() => {
    const cfg = googleSheetsSyncService.getConfig();
    const token = getAccessToken();
    if (!cfg.autoSync || !token) return;

    const timer = setTimeout(async () => {
      setSheetsSyncState((prev) => ({ ...prev, isSyncing: true }));
      try {
        const res = await googleSheetsSyncService.syncProjects(projects, token);
        setSheetsSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncAt: res.syncedAt,
          spreadsheetUrl: res.spreadsheetUrl,
        }));
      } catch (err) {
        console.warn('Auto-sync with Google Sheets error:', err);
        setSheetsSyncState((prev) => ({ ...prev, isSyncing: false }));
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [projects]);

  // Guard: Prioritization and Reports are exclusive to PMO
  useEffect(() => {
    if (currentUser && !isPMO(currentUser) && (activeTab === 'prioritization' || activeTab === 'reports')) {
      setActiveTab('weekly');
    }
  }, [currentUser, activeTab]);

  // Modal states
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<SAPProject | null>(null);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState<boolean>(false);
  const [projectToEdit, setProjectToEdit] = useState<SAPProject | null>(null);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);

  const [actionModalState, setActionModalState] = useState<{
    type: 'add' | 'edit' | null;
    project: SAPProject | null;
    action?: StageAction;
    defaultStageId?: number;
  }>({ type: null, project: null });

  // Preview file state
  const [previewFileState, setPreviewFileState] = useState<{
    file: AttachedFile;
    projectTitle?: string;
  } | null>(null);

  const handlePreviewFile = (file: AttachedFile, projectTitle?: string) => {
    setPreviewFileState({ file, projectTitle });
  };

  // Keep state in sync with localStorage
  const handleUpdateProject = (updated: SAPProject) => {
    const updatedList = projects.map((p) => (p.id === updated.id ? updated : p));
    setProjects(updatedList);
    storageService.saveProjects(updatedList);

    // Keep active detail modal in sync
    if (selectedProjectForDetail && selectedProjectForDetail.id === updated.id) {
      setSelectedProjectForDetail(updated);
    }
  };

  const handleSaveProject = (
    savedProject: SAPProject,
    options?: { openAddAction?: boolean }
  ) => {
    const exists = projects.some((p) => p.id === savedProject.id);
    let updatedList: SAPProject[];
    if (exists) {
      updatedList = projects.map((p) => (p.id === savedProject.id ? savedProject : p));
    } else {
      updatedList = [savedProject, ...projects];
    }

    setProjects(updatedList);
    storageService.saveProjects(updatedList);
    setIsProjectFormOpen(false);
    setProjectToEdit(null);

    // If it was being viewed in detail, update it
    if (selectedProjectForDetail && selectedProjectForDetail.id === savedProject.id) {
      setSelectedProjectForDetail(savedProject);
    }

    // Open add action modal if requested
    if (options?.openAddAction) {
      setActionModalState({
        type: 'add',
        project: savedProject,
      });
    }
  };

  const handleDeleteProject = (projectId: string) => {
    const updatedList = projects.filter((p) => p.id !== projectId);
    setProjects(updatedList);
    storageService.saveProjects(updatedList);
    if (selectedProjectForDetail && selectedProjectForDetail.id === projectId) {
      setSelectedProjectForDetail(null);
    }
  };

  const handleUserChange = (user: UserSession) => {
    setCurrentUser(user);
    storageService.setCurrentUser(user);
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
  };

  const handleUsersChanged = () => {
    const refreshed = storageService.getUsers();
    setUsersList(refreshed);
    if (currentUser) {
      const myUser = refreshed.find(
        (u) => u.id === currentUser.id || u.username === currentUser.username
      );
      if (myUser) {
        setCurrentUser({
          id: myUser.id,
          name: myUser.name,
          username: myUser.username,
          email: myUser.email,
          role: myUser.role,
        });
      }
    }
  };

  const handleResetData = () => {
    const reset = storageService.resetDefaultData();
    setProjects(reset);
    setSelectedProjectForDetail(null);
  };

  // Add Action Handler
  const handleOpenAddAction = (project: SAPProject, defaultStageId?: number) => {
    setActionModalState({
      type: 'add',
      project,
      defaultStageId,
    });
  };

  const handleSaveNewAction = (newAction: StageAction, keepOpen?: boolean) => {
    if (!actionModalState.project) return;
    const project = actionModalState.project;
    const updatedProject: SAPProject = {
      ...project,
      actions: [...project.actions, newAction],
      updatedAt: new Date().toISOString(),
    };
    handleUpdateProject(updatedProject);
    if (keepOpen) {
      setActionModalState({
        type: 'add',
        project: updatedProject,
        defaultStageId: newAction.stageId,
      });
    } else {
      setActionModalState({ type: null, project: null });
    }
  };

  // Edit Action Handler
  const handleOpenEditAction = (project: SAPProject, action: StageAction) => {
    setActionModalState({
      type: 'edit',
      project,
      action,
    });
  };

  const handleSaveEditedAction = (updatedAction: StageAction) => {
    if (!actionModalState.project) return;
    const project = actionModalState.project;
    const updatedActions = project.actions.map((a) =>
      a.id === updatedAction.id ? updatedAction : a
    );
    const updatedProject: SAPProject = {
      ...project,
      actions: updatedActions,
      updatedAt: new Date().toISOString(),
    };
    handleUpdateProject(updatedProject);
    setActionModalState({ type: null, project: null });
  };

  const handleDeleteAction = (actionId: string) => {
    if (!actionModalState.project) return;
    const project = actionModalState.project;
    const updatedActions = project.actions.filter((a) => a.id !== actionId);
    const updatedProject: SAPProject = {
      ...project,
      actions: updatedActions,
      updatedAt: new Date().toISOString(),
    };
    handleUpdateProject(updatedProject);
    setActionModalState({ type: null, project: null });
  };

  // Total pending actions count (excluding cancelled projects)
  const pendingActionsCount = projects.reduce((acc, p) => {
    if (p.state.includes('Cancelado') || p.state.startsWith('8-') || p.state.startsWith('08-')) return acc;
    return acc + p.actions.filter((a) => a.status !== 'Finalizada').length;
  }, 0);

  // My pending tasks count for current user
  const myPendingTasksCount = currentUser
    ? projects.reduce((acc, p) => {
        if (p.state.includes('Cancelado') || p.state.startsWith('8-') || p.state.startsWith('08-')) return acc;
        const userActions = p.actions.filter(
          (a) => a.status !== 'Finalizada' && isActionAssignedToUser(currentUser, a)
        );
        return acc + userActions.length;
      }, 0)
    : 0;

  // If not authenticated, display Login screen
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setUsersList(storageService.getUsers());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 font-sans text-slate-800 flex flex-col">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        allUsers={usersList}
        onUserChange={handleUserChange}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onLogout={handleLogout}
        onOpenNewProject={() => {
          setProjectToEdit(null);
          setIsProjectFormOpen(true);
        }}
        onResetData={handleResetData}
        onOpenGoogleSheetsSync={() => setIsSheetsModalOpen(true)}
        sheetsSyncInfo={sheetsSyncState}
        totalProjects={projects.length}
        pendingActionsCount={pendingActionsCount}
        myPendingTasksCount={myPendingTasksCount}
      />

      {/* Main Tab Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 print:p-0 print:m-0 print:max-w-none">
        {activeTab === 'weekly' && (
          <WeeklyReviewView
            projects={projects}
            currentUser={currentUser}
            onUpdateProject={handleUpdateProject}
            onSelectProject={(p) => setSelectedProjectForDetail(p)}
            onOpenAddAction={(p) => handleOpenAddAction(p)}
            onOpenEditAction={(p, a) => handleOpenEditAction(p, a)}
            onPreviewFile={handlePreviewFile}
          />
        )}

        {activeTab === 'tasks' && (
          <PendingTasksView
            projects={projects}
            currentUser={currentUser}
            allUsers={usersList}
            onUpdateProject={handleUpdateProject}
            onSelectProject={(p) => setSelectedProjectForDetail(p)}
            onOpenEditAction={(p, a) => handleOpenEditAction(p, a)}
            onPreviewFile={handlePreviewFile}
          />
        )}

        {activeTab === 'prioritization' && (
          <PrioritizationView
            projects={projects}
            currentUser={currentUser}
            onUpdateProject={handleUpdateProject}
            onSelectProject={(p) => setSelectedProjectForDetail(p)}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsListView
            projects={projects}
            currentUser={currentUser}
            onSelectProject={(p) => setSelectedProjectForDetail(p)}
            onEditProject={(p) => {
              setProjectToEdit(p);
              setIsProjectFormOpen(true);
            }}
            onDeleteProject={handleDeleteProject}
            onOpenNewProject={() => {
              setProjectToEdit(null);
              setIsProjectFormOpen(true);
            }}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView projects={projects} />
        )}
      </main>

      {/* MODAL: Project Detail Modal (Plan vs Actual Schedule & Actions) */}
      {selectedProjectForDetail && (
        <ProjectDetailModal
          project={selectedProjectForDetail}
          currentUser={currentUser}
          onClose={() => setSelectedProjectForDetail(null)}
          onUpdateProject={handleUpdateProject}
          onOpenAddAction={(p, stId) => handleOpenAddAction(p, stId)}
          onOpenEditAction={(p, a) => handleOpenEditAction(p, a)}
          onPreviewFile={handlePreviewFile}
        />
      )}

      {/* MODAL: Create / Edit Project Form */}
      {isProjectFormOpen && (
        <ProjectFormModal
          projectToEdit={projectToEdit}
          existingProjects={projects}
          currentUser={currentUser}
          allUsers={usersList}
          onClose={() => {
            setIsProjectFormOpen(false);
            setProjectToEdit(null);
          }}
          onSave={handleSaveProject}
        />
      )}

      {/* MODAL: Add Action */}
      {actionModalState.type === 'add' && actionModalState.project && (
        <AddActionModal
          project={actionModalState.project}
          defaultStageId={actionModalState.defaultStageId}
          currentUser={currentUser}
          allUsers={usersList}
          onClose={() => setActionModalState({ type: null, project: null })}
          onAddAction={handleSaveNewAction}
          onPreviewFile={handlePreviewFile}
        />
      )}

      {/* MODAL: Edit Action */}
      {actionModalState.type === 'edit' &&
        actionModalState.project &&
        actionModalState.action && (
          <EditActionModal
            project={actionModalState.project}
            action={actionModalState.action}
            currentUser={currentUser}
            onClose={() => setActionModalState({ type: null, project: null })}
            onSaveAction={handleSaveEditedAction}
            onDeleteAction={handleDeleteAction}
            onPreviewFile={handlePreviewFile}
          />
        )}

      {/* MODAL: File Preview Modal */}
      {previewFileState && (
        <FilePreviewModal
          file={previewFileState.file}
          projectTitle={previewFileState.projectTitle}
          onClose={() => setPreviewFileState(null)}
        />
      )}

      {/* MODAL: User Management Modal */}
      {isUserManagementOpen && (
        <UserManagementModal
          currentUser={currentUser}
          onClose={() => setIsUserManagementOpen(false)}
          onUsersChanged={handleUsersChanged}
        />
      )}

      {/* MODAL: Google Sheets Sync Modal */}
      {isSheetsModalOpen && (
        <GoogleSheetsSyncModal
          projects={projects}
          isOpen={isSheetsModalOpen}
          onClose={() => setIsSheetsModalOpen(false)}
          onSyncCompleted={(lastSyncAt, spreadsheetUrl) => {
            setSheetsSyncState((prev) => ({
              ...prev,
              lastSyncAt,
              spreadsheetUrl: spreadsheetUrl || prev.spreadsheetUrl,
              isSyncing: false,
              isConnected: true,
            }));
          }}
        />
      )}
    </div>
  );
}
