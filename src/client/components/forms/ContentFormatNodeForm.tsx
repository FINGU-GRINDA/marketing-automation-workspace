import { useState, useEffect } from 'react';
import type { Node, ContentFormatNodeConfig } from '../../types';

interface ContentFormatNodeFormProps {
  node: Node;
  onUpdate: (config: ContentFormatNodeConfig) => void;
}

function ContentFormatNodeForm({ node, onUpdate }: ContentFormatNodeFormProps) {
  const config = node.data.config as ContentFormatNodeConfig;
  const [formData, setFormData] = useState(config);

  // node가 변경될 때만 formData 리셋 (config 변경은 handleChange로 처리)
  useEffect(() => {
    setFormData(node.data.config as ContentFormatNodeConfig);
  }, [node.id]);

  const handleChange = (field: keyof ContentFormatNodeConfig, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-700 pb-2 border-b">
        콘텐츠 포맷 노드
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          포맷 이름
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="예: 짧은 스토리텔링"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          콘텐츠 유형
        </label>
        <select
          value={formData.mappedContentType}
          onChange={(e) => handleChange('mappedContentType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        >
          <option value="">선택하세요</option>
          <option value="포스트">포스트</option>
          <option value="일반이미지">일반이미지</option>
          <option value="텍스트형 이미지">텍스트형 이미지</option>
          <option value="보고서">보고서</option>
        </select>
      </div>

      {/* 포스트 선택 시 */}
      {formData.mappedContentType === '포스트' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              포맷 구조 설명
            </label>
            <textarea
              value={formData.formatStructureDescription}
              onChange={(e) => handleChange('formatStructureDescription', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: Hook → 공감 → 인사이트 → CTA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              포맷 예시 텍스트
            </label>
            <textarea
              value={formData.formatExampleText}
              onChange={(e) => handleChange('formatExampleText', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="포맷 참고용 예시 (내용은 복사되지 않음)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              생성 프롬프트 템플릿
            </label>
            <textarea
              value={formData.generationPromptTemplate}
              onChange={(e) => handleChange('generationPromptTemplate', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 길이 500자 이내, CTA 포함"
            />
          </div>
        </>
      )}

      {/* 일반이미지 선택 시 */}
      {formData.mappedContentType === '일반이미지' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이미지 스타일
            </label>
            <textarea
              value={formData.formatStructureDescription}
              onChange={(e) => handleChange('formatStructureDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 미니멀리즘, 모던, 일러스트, 사진 등"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주요 요소 및 구성
            </label>
            <textarea
              value={formData.formatExampleText}
              onChange={(e) => handleChange('formatExampleText', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 중앙 배치된 제품, 배경은 단색, 상단에 로고"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이미지 생성 프롬프트
            </label>
            <textarea
              value={formData.generationPromptTemplate}
              onChange={(e) => handleChange('generationPromptTemplate', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 16:9 비율, 고해상도, 밝은 톤"
            />
          </div>
        </>
      )}

      {/* 텍스트형 이미지 선택 시 */}
      {formData.mappedContentType === '텍스트형 이미지' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              텍스트 레이아웃
            </label>
            <textarea
              value={formData.formatStructureDescription}
              onChange={(e) => handleChange('formatStructureDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 상단 헤드라인, 중앙 핵심 메시지, 하단 CTA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              디자인 가이드
            </label>
            <textarea
              value={formData.formatExampleText}
              onChange={(e) => handleChange('formatExampleText', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 폰트 크기, 색상 조합, 여백 설정"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              텍스트 오버레이 프롬프트
            </label>
            <textarea
              value={formData.generationPromptTemplate}
              onChange={(e) => handleChange('generationPromptTemplate', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 임팩트 있는 한 줄 메시지, 이모지 포함"
            />
          </div>
        </>
      )}

      {/* 보고서 선택 시 */}
      {formData.mappedContentType === '보고서' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              보고서 구조
            </label>
            <textarea
              value={formData.formatStructureDescription}
              onChange={(e) => handleChange('formatStructureDescription', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 요약 → 배경 → 분석 → 결론 → 제안"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              보고서 예시 형식
            </label>
            <textarea
              value={formData.formatExampleText}
              onChange={(e) => handleChange('formatExampleText', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="참고할 보고서 형식 및 톤앤매너"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              보고서 생성 가이드
            </label>
            <textarea
              value={formData.generationPromptTemplate}
              onChange={(e) => handleChange('generationPromptTemplate', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 전문적인 어조, 데이터 중심, 섹션별 명확한 구분"
            />
          </div>
        </>
      )}
    </div>
  );
}

export default ContentFormatNodeForm;
