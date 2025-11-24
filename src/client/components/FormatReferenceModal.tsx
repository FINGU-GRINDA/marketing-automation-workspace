import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChannelNodeConfig } from '../types';

interface FormatReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelConfig: ChannelNodeConfig;
  channelId: string;
  onGenerateFormat: (data: {
    channelId: string;
    channelType: string;
    textReference: string;
    articleReferences: string[];
    targetLanguage: string;
  }) => void;
  isGenerating: boolean;
}

function FormatReferenceModal({
  isOpen,
  onClose,
  channelConfig,
  channelId,
  onGenerateFormat,
  isGenerating
}: FormatReferenceModalProps) {
  const [textReference, setTextReference] = useState('');
  const [articleReferences, setArticleReferences] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('ko');
  const modalRef = useRef<HTMLDivElement>(null);

  // 글 첨부 추가 핸들러
  const addArticleReference = () => {
    setArticleReferences(prev => [...prev, '']);
  };

  // 글 첨부 변경 핸들러
  const updateArticleReference = (index: number, value: string) => {
    setArticleReferences(prev => {
      const newArticles = [...prev];
      newArticles[index] = value;
      return newArticles;
    });
  };

  // 글 첨부 제거 핸들러
  const removeArticleReference = (index: number) => {
    setArticleReferences(prev => {
      const newArticles = [...prev];
      newArticles.splice(index, 1);
      return newArticles;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 최소 하나의 레퍼런스는 필요
    const hasAnyReference = textReference.trim() ||
                            articleReferences.some(ref => ref.trim());

    if (!hasAnyReference) {
      alert('텍스트 또는 글 첨부 중 최소 하나를 제공해주세요.');
      return;
    }

    // 빈 글 첨부 제거
    const validArticleReferences = articleReferences.filter(ref => ref.trim());

    onGenerateFormat({
      channelId,
      channelType: channelConfig.channelType,
      textReference: textReference.trim(),
      articleReferences: validArticleReferences,
      targetLanguage
    });
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      tabIndex={0}
    >
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">AI 포맷 생성</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 채널 정보 (읽기 전용) */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-1">채널 정보</div>
          <div className="text-sm text-gray-600">
            {channelConfig.name} ({channelConfig.channelType})
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 텍스트 레퍼런스 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 텍스트 레퍼런스
            </label>
            <div className="text-xs text-gray-500 mb-2">
              이 채널의 톤앤매너를 잘 보여주는 기존 글, 링크 설명, 요약 등을 자유롭게 붙여 넣어 주세요.
            </div>
            <textarea
              value={textReference}
              onChange={(e) => setTextReference(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예시: 최근 AI 시장의 변화를 보면, 단순한 자동화 도구를 넘어 비즈니스 전략의 핵심 파트너로 자리매김하고 있습니다..."
            />
            <div className="text-xs text-gray-500 mt-1">
              {textReference.length}자
            </div>
          </div>

  
          {/* 2. 글 첨부 레퍼런스 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                🔗 글 첨부 레퍼런스
              </label>
              <button
                type="button"
                onClick={addArticleReference}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                + 글 첨부 추가
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              블로그 글, 기사, 소셜 미디어 포스트 등의 전문이나 링크를 첨부해주세요.
            </div>

            <div className="space-y-2">
              {articleReferences.map((article, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={article}
                    onChange={(e) => updateArticleReference(index, e.target.value)}
                    placeholder="글 전문 또는 링크를 입력하세요..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeArticleReference(index)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}

              {articleReferences.length === 0 && (
                <div className="text-gray-400 text-sm text-center py-4 border border-dashed border-gray-300 rounded">
                  글 첨부가 없습니다. '글 첨부 추가' 버튼을 눌러 추가해주세요.
                </div>
              )}
            </div>
          </div>

          {/* 3. 목표 언어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🌐 목표 언어
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="zh">中文</option>
            </select>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              disabled={isGenerating}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isGenerating}
            >
              {isGenerating && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {isGenerating ? 'AI 생성 중...' : 'AI로 포맷 생성'}
            </button>
          </div>
        </form>

        <div className="text-xs text-gray-500 mt-4 text-center">
          AI가 레퍼런스를 분석하여 포맷 이름, 구조, 예시, 프롬프트 템플릿을 자동 생성합니다.
        </div>
      </div>
    </div>
  );
}

export default FormatReferenceModal;