import { useState, useEffect } from 'react';
import type { Node, InputNodeConfig, SlackMessage } from '../../types';
import { api } from '../../apiClient';

interface InputNodeFormProps {
  node: Node;
  onUpdate: (config: InputNodeConfig) => void;
}

function InputNodeForm({ node, onUpdate }: InputNodeFormProps) {
  const config = node.data.config as InputNodeConfig;
  const [formData, setFormData] = useState(config);
  const [slackMessages, setSlackMessages] = useState<SlackMessage[]>([]);
  const [showSlackSelector, setShowSlackSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  // node가 변경될 때만 formData 리셋 (config 변경은 handleChange로 처리)
  useEffect(() => {
    setFormData(node.data.config as InputNodeConfig);
  }, [node.id]);

  // Slack 메시지 로드
  const loadSlackMessages = async () => {
    try {
      setLoading(true);
      const response = await api.getSlackMessages(50); // 최근 50개만
      setSlackMessages(response.messages);
    } catch (error) {
      console.error('Slack 메시지 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof InputNodeConfig, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  // Slack 메시지 선택
  const handleSelectSlackMessage = (message: SlackMessage) => {
    const updated = {
      ...formData,
      topic: message.text.substring(0, 100) || 'Slack 메시지',
      rawData: message.text,
      title: `Slack 메시지 (${new Date(message.createdAt).toLocaleString('ko-KR')})`,
    };
    setFormData(updated);
    onUpdate(updated);
    setShowSlackSelector(false);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-700 pb-2 border-b">
        입력 노드
      </div>

      {/* Slack 메시지 선택 버튼 */}
      <div>
        <button
          type="button"
          onClick={() => {
            if (!showSlackSelector) {
              loadSlackMessages();
            }
            setShowSlackSelector(!showSlackSelector);
          }}
          className="w-full px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showSlackSelector ? '📋 Slack 메시지 선택 닫기' : '📋 Slack 메시지에서 가져오기'}
        </button>

        {/* Slack 메시지 목록 */}
        {showSlackSelector && (
          <div className="mt-2 border border-gray-300 rounded-md max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">로딩 중...</div>
            ) : slackMessages.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">Slack 메시지가 없습니다</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {slackMessages.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => handleSelectSlackMessage(message)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(message.createdAt).toLocaleString('ko-KR')}
                    </div>
                    <div className="text-sm text-gray-900 line-clamp-2">
                      {message.text || '(텍스트 없음)'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          제목
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="예: GRINDA AI 소식"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          주제 (한 줄)
        </label>
        <input
          type="text"
          value={formData.topic}
          onChange={(e) => handleChange('topic', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="예: YC 지원 소식"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          상세 데이터
        </label>
        <textarea
          value={formData.rawData}
          onChange={(e) => handleChange('rawData', e.target.value)}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="상세 내용을 입력하세요..."
        />
      </div>
    </div>
  );
}

export default InputNodeForm;
