import { useState, Fragment as ReactFragment } from 'react';
import { Handle, Position } from 'reactflow';
import type { Node, SearchTopicCandidate, ContentBlock } from '../../types';

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

interface ContentNodeProps {
  data: Node['data'];
  selected: boolean;
  id: string;
}

function ContentNode({ data, selected, id: nodeId }: ContentNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<Partial<{
    subject: string;
    content: string;
    sources: string[];
    metadata: {
      channelName?: string;
      personaTags?: string[];
      questions?: string[];
      insights?: string[];
      tags?: string[];
    };
  }>>({});
  const config = data.config;

  // 콘텐츠 기본 정보
  const title = config?.title || '수집된 콘텐츠';
  const status = config?.status || 'draft';
  const contentType = config?.contentType || 'collection';
  const wordCount = config?.metadata?.wordCount || 0;
  const tags = config?.tags || [];

  // 새로운 콘텐츠 블록 구조 확인
  const contentBlocks = config?.contentBlocks || [];
  const totalBlocks = config?.totalBlocks || contentBlocks.length;
  const lastUpdated = config?.lastUpdated;

  // 기존 searchData 호환성 (나중에 제거)
  const searchData = config?.searchData || [];
  const totalSearchResults = config?.totalSearchResults || searchData.length;

  // 실제 표시할 데이터 수
  const displayTotal = totalBlocks || totalSearchResults || 0;

  // 상태별 색상 설정
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 border-gray-400';
      case 'collected': return 'bg-blue-100 border-blue-500';
      case 'review': return 'bg-yellow-100 border-yellow-500';
      case 'approved': return 'bg-blue-100 border-blue-500';
      case 'published': return 'bg-green-100 border-green-500';
      default: return 'bg-gray-100 border-gray-400';
    }
  };

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return '📝';
      case 'collected': return '📚';
      case 'review': return '👀';
      case 'approved': return '✅';
      case 'published': return '🚀';
      default: return '📝';
    }
  };

  // 콘텐츠 타입별 아이콘
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '📄';
      case 'collection': return '📚';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'link': return '🔗';
      case 'mixed': return '📱';
      default: return '📚';
    }
  };

  const statusColor = getStatusColor(status);

  // workspaceId를 가져오기 (전역 상태나 props에서 받아와야 함)
  const workspaceId = (window as any).currentWorkspaceId || 'default';

  // 블록 관리 함수들
  const handleAddBlock = async () => {
    try {
      if (!editingBlock.subject || !editingBlock.content) {
        alert('주제와 내용은 필수 항목입니다.');
        return;
      }

      await addContentBlock(workspaceId, nodeId, {
        subject: editingBlock.subject,
        content: editingBlock.content,
        sources: editingBlock.sources || [],
        metadata: editingBlock.metadata
      });

      // 페이지 새로고침 또는 상태 업데이트
      window.location.reload();

      setShowAddBlock(false);
      setEditingBlock({});
    } catch (error) {
      alert('블록 추가에 실패했습니다: ' + (error as Error).message);
    }
  };

  const handleEditBlock = (block: ContentBlock) => {
    setEditingBlockId(block.id);
    setEditingBlock({
      subject: block.subject,
      content: block.content,
      sources: block.sources,
      metadata: block.metadata
    });
  };

  const handleUpdateBlock = async () => {
    if (!editingBlockId) return;

    try {
      await updateContentBlock(workspaceId, nodeId, editingBlockId, editingBlock);

      setEditingBlockId(null);
      setEditingBlock({});
      window.location.reload();
    } catch (error) {
      alert('블록 수정에 실패했습니다: ' + (error as Error).message);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('정말로 이 블록을 삭제하시겠습니까?')) return;

    try {
      await deleteContentBlock(workspaceId, nodeId, blockId);
      window.location.reload();
    } catch (error) {
      alert('블록 삭제에 실패했습니다: ' + (error as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setEditingBlockId(null);
    setEditingBlock({});
  };

  // Fixed JSX structure with React Fragment wrapper
  return (
    <>
      <div className={`
        group px-3 py-2 ${statusColor} border-2 rounded-lg w-[180px] h-[100px] flex flex-col relative cursor-move
        ${selected ? 'ring-2 ring-offset-2 ring-gray-400 shadow-lg' : 'shadow-md hover:shadow-lg'}
        transition-all duration-200
      `}>
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 opacity-0"
        />

        {/* 상태 및 타입 아이콘 */}
        <div className="flex items-center justify-between mb-1">
          <div className={`text-lg ${selected ? 'opacity-100' : 'opacity-80'}`}>
            {getStatusIcon(status)}
          </div>
          <div className="text-sm">
            {getContentTypeIcon(contentType)}
          </div>
        </div>

        {/* 제목 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`font-semibold text-sm mb-1 truncate ${
            selected ? 'text-gray-900' : 'text-gray-800'
          }`}>
            {title}
          </div>

          {/* 메타 정보 */}
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center justify-between">
              <span className="capitalize">{status}</span>
              {lastUpdated && (
                <span>{new Date(lastUpdated).toLocaleDateString('ko-KR')}</span>
              )}
            </div>

            {/* 수집된 데이터 정보 */}
            {displayTotal > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-blue-600">📚</span>
                <span className="text-blue-600">{displayTotal}개 콘텐츠 블록</span>
              </div>
            )}

            {/* 태그 */}
            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {tags.slice(0, 2).map((tag, index) => (
                  <span
                    key={index}
                    className="px-1 py-0.5 bg-white bg-opacity-60 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span className="text-xs">+{tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 opacity-0"
        />

        {/* 확장 버튼들 */}
        <div className="absolute -top-3 right-0 flex gap-1">
          {/* 블록 추가 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddBlock(true);
            }}
            className="w-6 h-6 bg-green-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-600 flex items-center justify-center text-xs font-bold shadow-md z-10"
            title="블록 추가"
          >
            +
          </button>

          {/* 확장 버튼 */}
          {displayTotal > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-6 h-6 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600 flex items-center justify-center text-xs font-bold shadow-md z-10"
              title={isExpanded ? '닫기' : '내용 보기'}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}
        </div>
      </div>

      {/* 콘텐츠 블록 확장 패널 */}
      {isExpanded && displayTotal > 0 && (
        <div className="absolute top-full left-0 mt-2 w-[700px] bg-white border-2 border-blue-200 rounded-lg shadow-xl z-50 p-4 max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">수집된 콘텐츠 블록 ({displayTotal}개)</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* 새로운 ContentBlock 구조 표시 */}
            {contentBlocks.map((block, idx) => (
              <React.Fragment key={block.id}>
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                  {/* 헤더: 주제와 출처 정보 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-900">#{idx + 1}</span>
                        <span className="text-base font-semibold text-gray-800">{block.subject}</span>
                      </div>
                    </div>

                    {/* 편집/삭제 버튼 */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBlock(block);
                        }}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                        title="편집"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(block.id);
                        }}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* 메타데이터 표시 */}
                  <div className="text-sm text-gray-600 space-y-1">
                    {block.metadata?.channelName && (
                      <div>
                        <span className="font-medium">채널:</span> {block.metadata.channelName}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">추가일:</span> {new Date(block.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                    <div>
                      <span className="font-medium">출처:</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs ml-1">
                        {block.sourceType === 'ai_search' ? 'AI 서치' : block.sourceType}
                      </span>
                    </div>
                  </div>

                  {/* 콘텐츠 내용 */}
                  <div className="bg-white rounded-lg p-3 mb-3">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{block.content}</div>
                  </div>

                  {/* 하단 정보 */}
                  <div className="flex justify-between items-start">
                    {/* 출처 링크 */}
                    <div className="flex-1">
                      {block.sources && block.sources.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-gray-700 mb-1">참고 링크:</div>
                          <div className="flex flex-wrap gap-1">
                            {block.sources.slice(0, 2).map((source, i) => (
                              <a
                                key={i}
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline px-2 py-1 bg-blue-50 rounded"
                              >
                                🔗 링크 {i + 1}
                              </a>
                            ))}
                            {block.sources.length > 2 && (
                              <span className="text-xs text-gray-500 px-2 py-1">+{block.sources.length - 2}개</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 태그 */}
                    <div className="text-right">
                      {block.metadata?.tags && block.metadata.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end mb-2">
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

                      {/* 채널 페르소나 태그 */}
                      {block.metadata?.personaTags && block.metadata.personaTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {block.metadata.personaTags.slice(0, 2).map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}

            {/* 기존 searchData 호환성 (나중에 제거) */}
            {contentBlocks.length === 0 && searchData.length > 0 && (
              <>
                <div className="text-center text-gray-500 py-2">
                  <div>⚠️ 기존 데이터 형식 (마이그레이션 필요)</div>
                </div>
                {searchData.map((item, idx) => (
                  <div key={item.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                    <div className="text-sm">
                      <div className="font-medium">{idx + 1}. {item.subject}</div>
                      <div className="text-gray-600 mt-1">{item.data?.summary}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {displayTotal === 0 && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-lg mb-2">📚</div>
              <div>콘텐츠 블록이 없습니다.</div>
              <div className="text-sm">초록색 '+' 버튼을 눌러 블록을 추가하거나 서치 노드를 실행하여 콘텐츠를 수집해보세요.</div>
            </div>
          )}
        </div>
      )}

      {/* 블록 추가/편집 모달 패널 */}
      {(showAddBlock || editingBlockId) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">
                {editingBlockId ? '콘텐츠 블록 편집' : '새 콘텐츠 블록 추가'}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showAddBlock ? setShowAddBlock(false) : handleCancelEdit();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* 주제 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주제 *
                </label>
                <input
                  type="text"
                  value={editingBlock.subject || ''}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    subject: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="블록의 주제를 입력하세요"
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용 *
                </label>
                <textarea
                  value={editingBlock.content || ''}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    content: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                  placeholder="콘텐츠 내용을 입력하세요"
                />
              </div>

              {/* 출처 링크 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  출처 링크 (한 줄에 하나씩)
                </label>
                <textarea
                  value={(editingBlock.sources || []).join('\n')}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    sources: e.target.value.split('\n').filter(s => s.trim())
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
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
                  value={editingBlock.metadata?.channelName || ''}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    metadata: {
                      ...editingBlock.metadata,
                      channelName: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  value={(editingBlock.metadata?.tags || []).join(', ')}
                  onChange={(e) => setEditingBlock({
                    ...editingBlock,
                    metadata: {
                      ...editingBlock.metadata,
                      tags: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="태그1, 태그2, 태그3"
                />
              </div>
            </div>

            {/* 버튼들 */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showAddBlock ? handleAddBlock() : handleUpdateBlock();
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                {editingBlockId ? '수정 완료' : '추가 완료'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showAddBlock ? setShowAddBlock(false) : handleCancelEdit();
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ContentNode;