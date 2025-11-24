import React, { memo, useState, useCallback, useContext } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import type { Node, SearchNodeResult } from '../../types';

// 글로벌 상태를 관리하는 간단한 Context
const SearchSelectionContext = React.createContext<{
  selectedNodes: Set<string>;
  toggleSelection: (nodeId: string) => void;
}>({
  selectedNodes: new Set(),
  toggleSelection: () => {}
});

interface SearchNodeProps {
  data: Node['data'];
  selected: boolean;
  id: string; // 노드 ID는 props로 전달받음
  isExecuting?: boolean; // 실행 상태 여부
}

function SearchNode({ data, selected, id, isExecuting = false }: SearchNodeProps) {
  const config = data.config;
  const { getNodes } = useReactFlow();

  // Context에서 선택 상태 가져오기
  const { selectedNodes, toggleSelection } = useContext(SearchSelectionContext);
  const isSelected = selectedNodes.has(id);
  const [isExpanded, setIsExpanded] = useState(false);

  // 마지막 실행 정보
  const lastExecutedAt = config.lastExecutedAt
    ? new Date(config.lastExecutedAt).toLocaleDateString('ko-KR')
    : '실행 전';

  // 새로운 서치 결과 정보
  const searchResult = config.searchNodeResult as SearchNodeResult;
  const topicCandidateCount = searchResult?.topicCandidates?.length || 0;
  const questionCount = searchResult?.questions?.length || 0;
  const insightCount = searchResult?.insights?.length || 0;

  // 실행 상태 확인
  const hasResults = topicCandidateCount > 0;

  return (
    <div className="relative">
      {/* 메인 노드 */}
      <div
        className={`
          px-3 py-2 bg-orange-100 border-2 rounded-lg w-[180px] h-[100px] flex flex-col relative cursor-move
          ${selected
            ? 'border-orange-600 ring-2 ring-orange-200 shadow-lg'
            : 'border-orange-500 hover:border-orange-600 shadow-md hover:shadow-lg'
          }
          transition-all duration-200
        `}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 opacity-0"
        />

        {/* 상태 아이콘과 제목 */}
        <div className="flex items-center justify-between mb-2">
          {/* 실행 상태 아이콘 */}
          <div className={`
            flex items-center justify-center rounded-full w-8 h-8 flex-shrink-0
            ${isExecuting
              ? 'bg-yellow-500 text-white animate-pulse'
              : hasResults
                ? 'bg-green-500 text-white'
                : 'bg-orange-500 text-white'
            }
            ${selected ? 'ring-2 ring-white' : ''}
            transition-all duration-200
          `}>
            <div className="font-bold text-white text-sm font-mono">
              {isExecuting ? '⏳' : 'S'}
            </div>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex gap-1 items-center">
            {/* 체크박스 */}
            <div
              className="relative inline-flex items-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleSelection(id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className={`
                  w-4 h-4 rounded border-2 flex items-center justify-center
                  transition-colors duration-200 flex-shrink-0 cursor-pointer
                  ${isSelected
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-white border-orange-300 hover:border-orange-400 text-transparent'
                  }
                `}
              >
                {isSelected && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* 결과 보기 버튼 */}
            {hasResults && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition-colors"
              >
                {isExpanded ? '닫기' : '결과'}
              </button>
            )}
          </div>
        </div>

        {/* 제목 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`font-semibold text-sm mb-1 truncate ${
            selected ? 'text-orange-900' : 'text-orange-900'
          }`}>
            {data.label}
          </div>

          {/* 메타 정보 */}
          <div className="text-xs text-orange-700 space-y-1">
            <div className="flex items-center justify-between">
              <span>{lastExecutedAt}</span>
              {hasResults && (
                <span className="text-green-600 font-medium">✓</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {questionCount > 0 && <span className="text-blue-600">Q:{questionCount}</span>}
              {insightCount > 0 && <span className="text-purple-600">I:{insightCount}</span>}
              {topicCandidateCount > 0 && <span className="text-green-600">T:{topicCandidateCount}</span>}
              {!hasResults && <span>준비중</span>}
            </div>
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 opacity-0"
        />
      </div>

      {/* 확장된 결과 패널 */}
      {isExpanded && hasResults && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border-2 border-orange-200 rounded-lg shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-orange-900">서치 결과</h3>
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

          {/* 질문 목록 */}
          {searchResult.questions.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">생성된 질문 ({searchResult.questions.length})</h4>
              <div className="space-y-1">
                {searchResult.questions.map((q, idx) => (
                  <div key={q.id} className="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                    <span className="text-blue-600 font-medium">{idx + 1}.</span> {q.question}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주제 후보 목록 */}
          {searchResult.topicCandidates.length > 0 && (
            <div>
              <h4 className="font-semibold text-green-800 mb-2">주제 후보 ({searchResult.topicCandidates.length})</h4>
              <div className="space-y-2">
                {searchResult.topicCandidates.map((topic, idx) => (
                  <div key={topic.id} className="border border-green-200 rounded-lg p-2 bg-green-50">
                    <div className="font-medium text-green-900 mb-1">
                      {idx + 1}. {topic.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {topic.oneLineSummary}
                    </div>
                    {topic.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {topic.tags.map((tag, tagIdx) => (
                          <span key={tagIdx} className="px-1 py-0.5 bg-green-200 text-green-800 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(SearchNode);
export { SearchSelectionContext };