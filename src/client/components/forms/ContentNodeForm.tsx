import { useState, useEffect } from 'react';
import type { Node, ContentBlock } from '../types';

interface ContentNodeFormProps {
  node: Node;
  onUpdate: (config: any) => void;
}

function ContentNodeForm({ node, onUpdate }: ContentNodeFormProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    content: '',
    sources: '',
    channelName: '',
    tags: ''
  });

  // contentBlocks 로드
  useEffect(() => {
    const contentBlocks = node.data.config?.contentBlocks || [];
    setBlocks(contentBlocks);
  }, [node.data.config?.contentBlocks]);

  // API 함수들
  const addContentBlock = async (workspaceId: string, contentNodeId: string, block: {
    subject: string;
    content: string;
    sources: string[];
    metadata?: any;
  }) => {
    const response = await fetch('/api/content/blocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        contentNodeId,
        block
      }),
    });

    if (!response.ok) {
      throw new Error('블록 추가에 실패했습니다.');
    }

    return response.json();
  };

  const updateContentBlock = async (workspaceId: string, contentNodeId: string, blockId: string, block: any) => {
    const response = await fetch(`/api/content/blocks/${blockId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        contentNodeId,
        block
      }),
    });

    if (!response.ok) {
      throw new Error('블록 수정에 실패했습니다.');
    }

    return response.json();
  };

  const deleteContentBlock = async (workspaceId: string, contentNodeId: string, blockId: string) => {
    const response = await fetch(`/api/content/blocks/${blockId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        contentNodeId
      }),
    });

    if (!response.ok) {
      throw new Error('블록 삭제에 실패했습니다.');
    }

    return response.json();
  };

  // workspaceId 가져오기
  const workspaceId = (window as any).currentWorkspaceId || 'default';

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      subject: '',
      content: '',
      sources: '',
      channelName: '',
      tags: ''
    });
    setShowAddForm(false);
    setEditingBlockId(null);
  };

  // 블록 추가 처리
  const handleAddBlock = async () => {
    if (!formData.subject || !formData.content) {
      alert('주제와 내용은 필수 항목입니다.');
      return;
    }

    try {
      await addContentBlock(workspaceId, node.id, {
        subject: formData.subject,
        content: formData.content,
        sources: formData.sources.split('\n').filter(s => s.trim()),
        metadata: {
          channelName: formData.channelName,
          tags: formData.tags.split(',').map(s => s.trim()).filter(s => s)
        }
      });

      // 새로고침
      window.location.reload();
      resetForm();
    } catch (error) {
      alert('블록 추가에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 블록 편집 시작
  const handleEditBlock = (block: ContentBlock) => {
    setEditingBlockId(block.id);
    setFormData({
      subject: block.subject,
      content: block.content,
      sources: block.sources.join('\n'),
      channelName: block.metadata?.channelName || '',
      tags: (block.metadata?.tags || []).join(', ')
    });
    setShowAddForm(true);
  };

  // 블록 수정 처리
  const handleUpdateBlock = async () => {
    if (!editingBlockId || !formData.subject || !formData.content) {
      alert('주제와 내용은 필수 항목입니다.');
      return;
    }

    try {
      await updateContentBlock(workspaceId, node.id, editingBlockId, {
        subject: formData.subject,
        content: formData.content,
        sources: formData.sources.split('\n').filter(s => s.trim()),
        metadata: {
          channelName: formData.channelName,
          tags: formData.tags.split(',').map(s => s.trim()).filter(s => s)
        }
      });

      window.location.reload();
      resetForm();
    } catch (error) {
      alert('블록 수정에 실패했습니다: ' + (error as Error).message);
    }
  };

  // 블록 삭제 처리
  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('정말로 이 블록을 삭제하시겠습니까?')) return;

    try {
      await deleteContentBlock(workspaceId, node.id, blockId);
      window.location.reload();
    } catch (error) {
      alert('블록 삭제에 실패했습니다: ' + (error as Error).message);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">콘텐츠 블록 관리</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
        >
          + 블록 추가
        </button>
      </div>

      {/* 블록 목록 */}
      {blocks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-500">
            <div className="text-lg mb-2">📚</div>
            <div>콘텐츠 블록이 없습니다.</div>
            <div className="text-sm">'블록 추가' 버튼을 눌러 첫 번째 블록을 추가해보세요.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {blocks.map((block, idx) => (
            <div key={block.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-700">#{idx + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{block.subject}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    생성일: {new Date(block.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                  {block.metadata?.channelName && (
                    <div className="text-xs text-gray-600">
                      채널: {block.metadata.channelName}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditBlock(block)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    title="편집"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 내용 미리보기 */}
              <div className="bg-white rounded p-2 mb-2">
                <div className="text-xs text-gray-700 line-clamp-2">
                  {block.content}
                </div>
              </div>

              {/* 태그 */}
              {block.metadata?.tags && block.metadata.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {block.metadata.tags.slice(0, 3).map((tag, tagIdx) => (
                    <span
                      key={tagIdx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {block.metadata.tags.length > 3 && (
                    <span className="text-xs text-gray-500">+{block.metadata.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 블록 추가/편집 폼 */}
      {showAddForm && (
        <div className="border-t pt-4">
          <h4 className="text-md font-semibold text-gray-800 mb-3">
            {editingBlockId ? '블록 편집' : '새 블록 추가'}
          </h4>

          <div className="space-y-3">
            {/* 주제 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주제 *
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="블록의 주제를 입력하세요"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용 *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none text-sm"
                placeholder="콘텐츠 내용을 입력하세요"
              />
            </div>

            {/* 출처 링크 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                출처 링크 (한 줄에 하나씩)
              </label>
              <textarea
                value={formData.sources}
                onChange={(e) => setFormData({ ...formData, sources: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none text-sm"
                placeholder="https://example.com&#10;https://another-example.com"
              />
            </div>

            {/* 채널 정보 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                채널명
              </label>
              <input
                type="text"
                value={formData.channelName}
                onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="채널 이름을 입력하세요"
              />
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                태그 (콤마로 구분)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="태그1, 태그2, 태그3"
              />
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={editingBlockId ? handleUpdateBlock : handleAddBlock}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
            >
              {editingBlockId ? '수정 완료' : '추가 완료'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContentNodeForm;