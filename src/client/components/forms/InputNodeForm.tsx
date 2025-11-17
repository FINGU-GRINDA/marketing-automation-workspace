import { useState, useEffect } from 'react';
import type { Node, InputNodeConfig } from '../../types';

interface InputNodeFormProps {
  node: Node;
  onUpdate: (config: InputNodeConfig) => void;
}

function InputNodeForm({ node, onUpdate }: InputNodeFormProps) {
  const config = node.data.config as InputNodeConfig;
  const [formData, setFormData] = useState(config);

  // node가 변경될 때만 formData 리셋 (config 변경은 handleChange로 처리)
  useEffect(() => {
    setFormData(node.data.config as InputNodeConfig);
  }, [node.id]);

  const handleChange = (field: keyof InputNodeConfig, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-700 pb-2 border-b">
        입력 노드
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
