import { useState, useEffect } from 'react';
import WorkspacePage from './components/WorkspacePage';
import type { Workspace, GeneratedContent } from './types';
import { api } from './apiClient';

function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    loadAllWorkspaces();
  }, []);

  // 현재 워크스페이스 변경 시 데이터 로드 및 localStorage에 저장
  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspace(currentWorkspaceId);
      // 현재 워크스페이스 ID를 localStorage에 저장
      localStorage.setItem('lastWorkspaceId', currentWorkspaceId);
    }
  }, [currentWorkspaceId]);

  const loadAllWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await api.getAllWorkspaces();
      setWorkspaces(data.workspaces);

      if (data.workspaces.length > 0) {
        // localStorage에서 마지막으로 선택한 워크스페이스 ID 가져오기
        const lastWorkspaceId = localStorage.getItem('lastWorkspaceId');

        // 해당 워크스페이스가 존재하면 선택, 없으면 첫 번째 워크스페이스 선택
        const workspaceExists = lastWorkspaceId && data.workspaces.some((w) => w.id === lastWorkspaceId);

        if (workspaceExists) {
          setCurrentWorkspaceId(lastWorkspaceId);
          console.log('✓ 이전 워크스페이스 복원:', lastWorkspaceId);
        } else {
          setCurrentWorkspaceId(data.workspaces[0].id);
          console.log('✓ 첫 번째 워크스페이스 선택:', data.workspaces[0].id);
        }
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError('워크스페이스 목록을 불러오는데 실패했습니다.');
      setLoading(false);
    }
  };

  const loadWorkspace = async (id: string) => {
    try {
      setLoading(true);
      const data = await api.getWorkspace(id);
      setWorkspace(data.workspace);
      setGeneratedContents(data.generatedContents);
      setError(null);
    } catch (err) {
      console.error('Failed to load workspace:', err);
      setError('워크스페이스를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (name: string) => {
    try {
      const data = await api.createWorkspace(name);
      setWorkspaces((prev) => [...prev, data.workspace]);
      setCurrentWorkspaceId(data.workspace.id);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      alert('워크스페이스 생성에 실패했습니다.');
    }
  };

  const renameWorkspace = async (id: string, newName: string) => {
    try {
      const data = await api.updateWorkspace(id, { name: newName });
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? data.workspace : w))
      );
      if (currentWorkspaceId === id) {
        setWorkspace(data.workspace);
      }
    } catch (err) {
      console.error('Failed to rename workspace:', err);
      alert('워크스페이스 이름 변경에 실패했습니다.');
    }
  };

  const deleteWorkspace = async (id: string) => {
    try {
      await api.deleteWorkspace(id);
      const updatedWorkspaces = workspaces.filter((w) => w.id !== id);
      setWorkspaces(updatedWorkspaces);

      // 삭제된 워크스페이스가 현재 선택된 것이면 다른 것으로 전환
      if (currentWorkspaceId === id) {
        if (updatedWorkspaces.length > 0) {
          setCurrentWorkspaceId(updatedWorkspaces[0].id);
        } else {
          setCurrentWorkspaceId(null);
          setWorkspace(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      alert('워크스페이스 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-lg text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-4">워크스페이스가 없습니다.</div>
          <button
            onClick={() => {
              const name = prompt('워크스페이스 이름을 입력하세요:');
              if (name) createWorkspace(name);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + 새 워크스페이스 만들기
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkspacePage
      workspaces={workspaces}
      currentWorkspaceId={currentWorkspaceId!}
      onWorkspaceChange={setCurrentWorkspaceId}
      onWorkspaceCreate={createWorkspace}
      onWorkspaceRename={renameWorkspace}
      onWorkspaceDelete={deleteWorkspace}
      workspace={workspace}
      setWorkspace={setWorkspace}
      generatedContents={generatedContents}
      setGeneratedContents={setGeneratedContents}
    />
  );
}

export default App;
