import { useState } from 'react';
import type { GeneratedContent, Workspace } from '../types';

// 번역 콘텐츠 표시 컴포넌트
function TranslationContentDisplay({ content }: { content: GeneratedContent }) {
  const [activeTab, setActiveTab] = useState<'translated' | 'original'>('translated');

  if (!content.isTranslated || !content.originalText) {
    // 번역되지 않은 경우: 번역본만 표시
    return (
      <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {content.finalText}
      </div>
    );
  }

  // 번역된 경우: 탭으로 원본과 번역본 표시
  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200 mb-3">
        <button
          onClick={() => setActiveTab('translated')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'translated'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🇰🇷 한국어 번역본
        </button>
        <button
          onClick={() => setActiveTab('original')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'original'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🌐 {content.detectedLanguage} 원본
        </button>
      </div>

      {/* 탭 내용 */}
      <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {activeTab === 'translated' ? (
          <div>
            <div className="text-xs text-green-600 font-medium mb-2">✅ 번역된 결과</div>
            {content.finalText}
          </div>
        ) : (
          <div>
            <div className="text-xs text-gray-500 font-medium mb-2">
              📝 원본 ({content.detectedLanguage})
            </div>
            <div className="text-gray-600 italic">
              {content.originalText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RightPanelProps {
  generatedContents: GeneratedContent[];
  workspace: Workspace;
  onDeleteContent: (contentId: string) => void;
  onRegenerateContent: (channelNodeId: string, formatNodeId: string, previousContent: string, prompt?: string) => void;
}

function RightPanel({ generatedContents, workspace, onDeleteContent, onRegenerateContent }: RightPanelProps) {
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');

  // 노드 이름 찾기
  const getNodeName = (nodeId: string) => {
    const node = workspace.nodes.find((n) => n.id === nodeId);
    return node?.data.label || nodeId;
  };

  // 채널 정보 가져오기 (이름 | 타입)
  const getChannelInfo = (nodeId: string) => {
    const node = workspace.nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'channel') {
      return nodeId;
    }
    const channelName = node.data.label;
    const channelType = (node.data.config as any).channelType || '';
    return channelType ? `${channelName} | ${channelType}` : channelName;
  };

  // 클립보드 복사
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다!');
  };

  // 번여 상태에 따른 뱃지 표시
  const getTranslationBadge = (content: GeneratedContent) => {
    if (content.isTranslated && content.originalText) {
      return (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
          🌐 {content.detectedLanguage} → 한국어
        </span>
      );
    }
    return null;
  };

  // 토글: 이미 선택된 항목을 다시 클릭하면 접기
  const handleContentClick = (content: GeneratedContent) => {
    if (selectedContent?.id === content.id) {
      setSelectedContent(null);
    } else {
      setSelectedContent(content);
    }
  };

  // 삭제 핸들러
  const handleDelete = (e: React.MouseEvent, contentId: string) => {
    e.stopPropagation(); // 부모 클릭 이벤트 방지
    if (confirm('이 생성 결과를 삭제하시겠습니까?')) {
      onDeleteContent(contentId);
      if (selectedContent?.id === contentId) {
        setSelectedContent(null);
      }
    }
  };

  // 재생성 버튼 클릭 - 프롬프트 입력 모드 토글
  const handleRegenerateClick = (e: React.MouseEvent, contentId: string) => {
    e.stopPropagation(); // 부모 클릭 이벤트 방지
    if (regeneratingId === contentId) {
      // 이미 열려있으면 닫기
      setRegeneratingId(null);
      setRegeneratePrompt('');
    } else {
      // 열기
      setRegeneratingId(contentId);
      setRegeneratePrompt('');
    }
  };

  // 재생성 실행
  const handleRegenerateSubmit = (content: GeneratedContent) => {
    onRegenerateContent(
      content.channelNodeId,
      content.contentFormatNodeId,
      content.finalText, // 기존 콘텐츠 전달
      regeneratePrompt.trim() || undefined
    );
    setRegeneratingId(null);
    setRegeneratePrompt('');
  };

  // Enter 키 처리
  const handlePromptKeyDown = (e: React.KeyboardEvent, content: GeneratedContent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRegenerateSubmit(content);
    } else if (e.key === 'Escape') {
      setRegeneratingId(null);
      setRegeneratePrompt('');
    }
  };

  return (
    <div className="h-full bg-white overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">생성 결과</h2>

        {generatedContents.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            플로우를 실행하면
            <br />
            결과가 여기에 표시됩니다
          </div>
        ) : (
          <div className="space-y-3">
            {generatedContents.map((content) => (
              <div
                key={content.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedContent?.id === content.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleContentClick(content)}
              >
                <div>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getNodeName(content.contentFormatNodeId)}
                        </div>
                        {content.contentType === 'image' && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            🖼️ 이미지
                          </span>
                        )}
                        {getTranslationBadge(content)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getChannelInfo(content.channelNodeId)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(content.createdAt).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => handleRegenerateClick(e, content.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="재생성"
                      >
                        🔄
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, content.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* 재생성 프롬프트 입력 */}
                  {regeneratingId === content.id && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={regeneratePrompt}
                        onChange={(e) => setRegeneratePrompt(e.target.value)}
                        onKeyDown={(e) => handlePromptKeyDown(e, content)}
                        placeholder="추가 프롬프트 입력 (Enter로 실행, ESC로 취소)"
                        className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 선택된 콘텐츠 상세 */}
        {selectedContent && (
          <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">상세 내용</h3>
              <button
                onClick={() => copyToClipboard(selectedContent.finalText)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                📋 복사
              </button>
            </div>

            {/* 이미지 콘텐츠인 경우 이미지 표시 */}
            {selectedContent.contentType === 'image' && selectedContent.imageData && (
              <div className="mb-4">
                <img
                  src={selectedContent.imageData}
                  alt="Generated content"
                  className="w-full rounded-lg border border-gray-300"
                />
              </div>
            )}

            {/* 텍스트 내용 표시 */}
            {selectedContent.contentType === 'text' && (
              <TranslationContentDisplay content={selectedContent} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RightPanel;
