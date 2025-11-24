import { useState, useEffect } from 'react';
import type { Node, SearchNodeConfig, SearchNodeResult } from '../../types';

interface SearchNodeFormProps {
  node: Node;
  onUpdate: (config: SearchNodeConfig) => void;
}

function SearchNodeForm({ node, onUpdate }: SearchNodeFormProps) {
  const config = node.data.config as SearchNodeConfig;
  const searchResult = config.searchNodeResult as SearchNodeResult;

  const [formData, setFormData] = useState({
    query: config.query || '',
    channels: config.channels?.join(', ') || 'reddit, twitter, linkedin',
    timeFilter: config.timeFilter || 'week',
    sortFilter: config.sortFilter || 'hot',
    maxResults: config.maxResults || 20,
    searchType: config.searchType || 'both'
  });

  // node가 변경될 때마다 formData 리셋
  useEffect(() => {
    setFormData({
      query: config.query || '',
      channels: config.channels?.join(', ') || 'reddit, twitter, linkedin',
      timeFilter: config.timeFilter || 'week',
      sortFilter: config.sortFilter || 'hot',
      maxResults: config.maxResults || 20,
      searchType: config.searchType || 'both'
    });
  }, [config]);

  const handleChange = (field: string, value: string | number) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // 실시간으로 onUpdate 호출
    const updatedConfig: SearchNodeConfig = {
      kind: 'search',
      ...config,
      query: newData.query as string,
      channels: (newData.channels as string).split(',').map(c => c.trim()).filter(c => c),
      timeFilter: newData.timeFilter as any,
      sortFilter: newData.sortFilter as any,
      maxResults: Number(newData.maxResults),
      searchType: newData.searchType as any
    };

    onUpdate(updatedConfig);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">서치 노드 설정</h3>

      {/* 실행 정보 */}
      {config.lastExecutedAt && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-sm font-medium text-green-800">마지막 실행</div>
          <div className="text-xs text-green-600">
            {new Date(config.lastExecutedAt).toLocaleString('ko-KR')}
          </div>
        </div>
      )}

      {/* 실행 결과 */}
      {searchResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-medium text-blue-800 mb-2">실행 결과</div>
          <div className="text-xs text-blue-600 space-y-1">
            <div>• 질문: {searchResult.questions.length}개</div>
            <div>• 인사이트: {searchResult.insights.length}개</div>
            <div>• 주제 후보: {searchResult.topicCandidates.length}개</div>
          </div>
        </div>
      )}

      {/* 검색 설정 */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            검색 쿼리
          </label>
          <input
            type="text"
            value={formData.query}
            onChange={(e) => handleChange('query', e.target.value)}
            placeholder="검색할 주제나 키워드를 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            검색 채널
          </label>
          <input
            type="text"
            value={formData.channels}
            onChange={(e) => handleChange('channels', e.target.value)}
            placeholder="reddit, twitter, linkedin, facebook, instagram"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <div className="text-xs text-gray-500 mt-1">
            쉼표로 구분하여 여러 채널을 입력하세요
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시간 필터
            </label>
            <select
              value={formData.timeFilter}
              onChange={(e) => handleChange('timeFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="day">하루</option>
              <option value="week">일주</option>
              <option value="month">한 달</option>
              <option value="year">일년</option>
              <option value="all">전체</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정렬 방식
            </label>
            <select
              value={formData.sortFilter}
              onChange={(e) => handleChange('sortFilter', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="hot">인기순</option>
              <option value="new">최신순</option>
              <option value="top">최고 평점순</option>
              <option value="rising">급상승순</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 결과 수
            </label>
            <input
              type="number"
              value={formData.maxResults}
              onChange={(e) => handleChange('maxResults', parseInt(e.target.value) || 20)}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색 타입
            </label>
            <select
              value={formData.searchType}
              onChange={(e) => handleChange('searchType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="title">제목만</option>
              <option value="content">내용만</option>
              <option value="both">제목+내용</option>
            </select>
          </div>
        </div>
      </div>

      {/* 실행 안내 */}
      {!config.lastExecutedAt && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-medium text-yellow-800 mb-1">실행 방법</div>
          <div className="text-xs text-yellow-700">
            1. 입력 노드와 채널 노드를 이 서치 노드에 연결하세요<br/>
            2. 서치 노드의 '실행' 버튼을 클릭하세요
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchNodeForm;