import { useState, useEffect } from 'react';
import type { Node, RedditSearchNodeConfig, RedditSearchResult } from '../../types';

interface RedditSearchNodeFormProps {
  node: Node;
  onUpdate: (config: RedditSearchNodeConfig) => void;
}

function RedditSearchNodeForm({ node, onUpdate }: RedditSearchNodeFormProps) {
  const config = node.data.config as RedditSearchNodeConfig;
  const [formData, setFormData] = useState(() => ({
    ...config,
    subreddits: config.subreddits.join(', '),
    topics: config.searchResult?.topics || [],
    questions: config.searchResult?.questions || [],
    reddit_insights: config.searchResult?.reddit_insights || []
  }));

  // node가 변경될 때마다 formData 리셋
  useEffect(() => {
    const nodeConfig = node.data.config as RedditSearchNodeConfig;
    setFormData({
      ...nodeConfig,
      subreddits: nodeConfig.subreddits.join(', '),
      topics: nodeConfig.searchResult?.topics || [],
      questions: nodeConfig.searchResult?.questions || [],
      reddit_insights: nodeConfig.searchResult?.reddit_insights || []
    });
  }, [node.id]);

  const handleChange = (field: keyof RedditSearchNodeConfig, value: string | number | string[]) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleSubredditsChange = (value: string) => {
    const subreddits = value.split(',').map(s => s.trim()).filter(s => s);
    const updated = { ...formData, subreddits };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-700 pb-2 border-b">
        🔍 Reddit 서치 노드
      </div>

      {/* 기본 설정 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          검색 쿼리
        </label>
        <input
          type="text"
          value={formData.query}
          onChange={(e) => handleChange('query', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="검색할 키워드 입력"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          서브레딧 (쉼표로 구분)
        </label>
        <input
          type="text"
          value={formData.subreddits}
          onChange={(e) => handleSubredditsChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="marketing, digitalmarketing, sales"
        />
        <p className="text-xs text-gray-500 mt-1">예: marketing, digitalmarketing, sales</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            시간 필터
          </label>
          <select
            value={formData.timeFilter}
            onChange={(e) => handleChange('timeFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="day">오늘</option>
            <option value="week">이번 주</option>
            <option value="month">이번 달</option>
            <option value="year">이번 해</option>
            <option value="all">모든 시간</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            정렬 방식
          </label>
          <select
            value={formData.sortFilter}
            onChange={(e) => handleChange('sortFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="hot">Hot</option>
            <option value="new">New</option>
            <option value="top">Top</option>
            <option value="rising">Rising</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            최대 결과 수
          </label>
          <input
            type="number"
            value={formData.maxResults}
            onChange={(e) => handleChange('maxResults', parseInt(e.target.value) || 10)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            min="1"
            max="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            검색 타입
          </label>
          <select
            value={formData.searchType}
            onChange={(e) => handleChange('searchType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            <option value="title">제목만</option>
            <option value="content">내용만</option>
            <option value="both">제목+내용</option>
          </select>
        </div>
      </div>

      {/* 마지막 실행 정보 */}
      {formData.lastExecutedAt && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="text-sm font-medium text-orange-900 mb-2">🔄 마지막 실행 정보</div>
          <div className="text-xs text-orange-700">
            실행 시간: {new Date(formData.lastExecutedAt).toLocaleString('ko-KR')}
          </div>
          <div className="text-xs text-orange-700">
            생성된 주제: {formData.topics.length}개
          </div>
        </div>
      )}

      {/* 검색 결과 요약 */}
      {formData.topics.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">📋 검색 결과 요약</h4>

          {/* 주제 후보 */}
          <div className="mb-4">
            <h5 className="text-xs font-medium text-blue-800 mb-2">주제 후보 ({formData.topics.length}개)</h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {formData.topics.map((topic, index) => (
                <div key={index} className="bg-white p-2 rounded border border-blue-200">
                  <div className="font-medium text-sm text-gray-900 truncate">{topic.title}</div>
                  <div className="text-xs text-gray-600 truncate">{topic.oneLineSummary}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {topic.tags.map((tag, tagIndex) => (
                      <span key={tagIndex} className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 질문 목록 */}
          <div className="mb-4">
            <h5 className="text-xs font-medium text-blue-800 mb-2">생성된 질문 ({formData.questions.length}개)</h5>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {formData.questions.map((question, index) => (
                <div key={index} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                  <span className="font-medium">Q{index + 1}:</span> {question.question}
                </div>
              ))}
            </div>
          </div>

          {/* Reddit 인사이트 */}
          <div>
            <h5 className="text-xs font-medium text-blue-800 mb-2">Reddit 인사이트 ({formData.reddit_insights.length}개)</h5>
            <div className="text-xs text-gray-600">
              총 {formData.reddit_insights.reduce((sum, insight) => sum + insight.keyTakeaways.length, 0)}개의 핵심 인사이트 발견
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RedditSearchNodeForm;