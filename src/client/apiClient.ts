import type { Workspace, GeneratedContent, RunFlowResponse } from './types';

const API_BASE = '/api';

export const api = {
  // 모든 워크스페이스 목록 조회
  async getAllWorkspaces(): Promise<{ workspaces: Workspace[] }> {
    const res = await fetch(`${API_BASE}/workspaces`);
    if (!res.ok) throw new Error('Failed to fetch workspaces');
    return res.json();
  },

  // 워크스페이스 생성
  async createWorkspace(name: string, description?: string): Promise<{ workspace: Workspace }> {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to create workspace');
    return res.json();
  },

  // 워크스페이스 조회
  async getWorkspace(id: string): Promise<{ workspace: Workspace; generatedContents: GeneratedContent[] }> {
    const res = await fetch(`${API_BASE}/workspaces/${id}`);
    if (!res.ok) throw new Error('Failed to fetch workspace');
    return res.json();
  },

  // 워크스페이스 업데이트
  async updateWorkspace(id: string, data: Partial<Workspace>): Promise<{ workspace: Workspace }> {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update workspace');
    return res.json();
  },

  // 워크스페이스 삭제
  async deleteWorkspace(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete workspace');
    return res.json();
  },

  // 플로우 실행
  async runFlow(id: string): Promise<RunFlowResponse> {
    const res = await fetch(`${API_BASE}/workspaces/${id}/run`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to run flow');
    return res.json();
  },

  // AI 포맷 제안
  async suggestFormats(workspaceId: string, channelId: string): Promise<{ success: boolean; workspace?: Workspace; formats: any[]; edges: any[] }> {
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/channels/${channelId}/suggest-formats`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to suggest formats');
    return res.json();
  },

  // 레퍼런스 기반 포맷 생성
  async generateFormatFromReference(data: {
    channelId: string;
    channelType: string;
    referenceText: string;
    targetLanguage: string;
    workspaceId: string; // workspaceId 추가
  }): Promise<{ success: boolean; data: any; error?: string }> {
    const res = await fetch(`${API_BASE}/format/from-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate format');
    }
    return res.json();
  },
};
