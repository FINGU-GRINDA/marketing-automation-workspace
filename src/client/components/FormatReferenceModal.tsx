import { useState } from 'react';
import type { ChannelNodeConfig } from '../types';

interface FormatReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelConfig: ChannelNodeConfig;
  channelId: string;
  onGenerateFormat: (data: {
    channelId: string;
    channelType: string;
    referenceText: string;
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
  const [referenceText, setReferenceText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ko');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceText.trim()) {
      alert('레퍼런스 텍스트를 입력해주세요.');
      return;
    }

    onGenerateFormat({
      channelId,
      channelType: channelConfig.channelType,
      referenceText: referenceText.trim(),
      targetLanguage
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 레퍼런스 텍스트 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              레퍼런스 텍스트 <span className="text-red-500">*</span>
            </label>
            <div className="text-xs text-gray-500 mb-2">
              이 채널의 톤앤매너를 잘 보여주는 기존 글, 링크 설명, 요약 등을 자유롭게 붙여 넣어 주세요.
              이 내용에서 브랜드명/숫자 등은 제거하고, 콘텐츠 전략만 추출합니다.
            </div>
            <textarea
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예시:&#10;&#10;최근 AI 시장의 변화를 보면, 단순한 자동화 도구를 넘어 비즈니스 전략의 핵심 파트너로 자리매김하고 있습니다. 많은 기업들이 AI 도입에 성공했지만, 실패 사례도 적지 않습니다. 성공과 실패의 차이는 무엇일까요?&#10;&#10;핵심은 '작게 시작해서 빠르게 학습하는 것'입니다. 처음부터 완벽한 시스템을 만들려다 예산만 낭비하기 쉽습니다. 대신, 가장 시급한 문제부터 해결하면서 점진적으로 확장해나가는 전략이 필요합니다."
            />
            <div className="text-xs text-gray-500 mt-1">
              {referenceText.length}자
            </div>
          </div>

          {/* 목표 언어 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              목표 언어
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
          <div className="flex gap-3 pt-4">
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
              disabled={isGenerating || !referenceText.trim()}
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