import { useState, useRef, useEffect } from 'react';
import type { Workspace } from '../types';

interface HeaderProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onWorkspaceChange: (id: string) => void;
  onWorkspaceCreate: (name: string) => void;
  onWorkspaceDelete: (id: string) => void;
  onWorkspaceRename: (id: string, newName: string) => void;
  workspaceName: string;
  onSave: () => void;
  onRun: () => void;
  isRunning: boolean;
}

function Header({
  workspaces,
  currentWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreate,
  onWorkspaceDelete,
  onWorkspaceRename,
  workspaceName,
  onSave,
  onRun,
  isRunning,
}: HeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(workspaceName);
  const inputRef = useRef<HTMLInputElement>(null);

  // 편집 모드 진입 시 input에 포커스
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // 워크스페이스 변경 시 편집 중인 이름 업데이트
  useEffect(() => {
    setEditedName(workspaceName);
  }, [workspaceName]);

  const handleDoubleClick = () => {
    setIsEditingName(true);
    setEditedName(workspaceName);
  };

  const handleSaveName = () => {
    const trimmedName = editedName.trim();

    // 빈 이름 체크
    if (!trimmedName) {
      alert('워크스페이스 이름은 비워둘 수 없습니다.');
      setEditedName(workspaceName);
      setIsEditingName(false);
      return;
    }

    // 이름이 변경된 경우에만 저장
    if (trimmedName !== workspaceName) {
      onWorkspaceRename(currentWorkspaceId, trimmedName);
    }

    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 기본 동작(form submit) 방지
      handleSaveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditedName(workspaceName);
      setIsEditingName(false);
    }
  };

  const handleCreateWorkspace = () => {
    const name = prompt('새 워크스페이스 이름을 입력하세요:');
    if (name && name.trim()) {
      onWorkspaceCreate(name.trim());
    }
  };

  const handleDeleteWorkspace = () => {
    if (workspaces.length <= 1) {
      alert('마지막 워크스페이스는 삭제할 수 없습니다.');
      return;
    }

    if (confirm(`"${workspaceName}" 워크스페이스를 삭제하시겠습니까?`)) {
      onWorkspaceDelete(currentWorkspaceId);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Workspace selector */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              {/* 워크스페이스 이름 (더블클릭으로 편집) */}
              {isEditingName ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={handleKeyDown}
                  className="text-xl font-bold text-gray-900 bg-white border-2 border-blue-500 rounded px-2 py-1 focus:outline-none"
                  autoComplete="off"
                />
              ) : (
                <h1
                  onDoubleClick={handleDoubleClick}
                  className="text-xl font-bold text-gray-900 cursor-text hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                  title="더블클릭하여 이름 변경"
                >
                  {workspaceName}
                </h1>
              )}

              {/* 워크스페이스 전환 드롭다운 (워크스페이스가 2개 이상일 때만 표시) */}
              {workspaces.length > 1 && (
                <select
                  value={currentWorkspaceId}
                  onChange={(e) => onWorkspaceChange(e.target.value)}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="다른 워크스페이스로 전환"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={handleCreateWorkspace}
                className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                title="새 워크스페이스 만들기"
              >
                + 새 워크스페이스
              </button>
              {workspaces.length > 1 && (
                <button
                  onClick={handleDeleteWorkspace}
                  className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  title="현재 워크스페이스 삭제"
                >
                  🗑️ 삭제
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">AI 마케팅 자동화 워크스페이스</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSave}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            💾 저장
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? '⏳ 실행 중...' : '▶️ 플로우 실행'}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
