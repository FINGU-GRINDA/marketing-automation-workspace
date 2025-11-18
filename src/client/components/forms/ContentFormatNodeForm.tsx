import { useState, useEffect, useRef } from 'react';
import type { Node, ContentFormatNodeConfig, FormatBlock } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface ContentFormatNodeFormProps {
  node: Node;
  onUpdate: (config: ContentFormatNodeConfig) => void;
}

function ContentFormatNodeForm({ node, onUpdate }: ContentFormatNodeFormProps) {
  const config = node.data.config as ContentFormatNodeConfig;
  const [formData, setFormData] = useState(() => {
    // formatBlocks가 없으면 빈 배열로 초기화
    return {
      ...config,
      formatBlocks: config.formatBlocks || [],
    };
  });

  // node가 변경될 때만 formData 리셋
  useEffect(() => {
    const nodeConfig = node.data.config as ContentFormatNodeConfig;
    setFormData({
      ...nodeConfig,
      formatBlocks: nodeConfig.formatBlocks || [],
    });
  }, [node.id]);

  const handleChange = (field: keyof ContentFormatNodeConfig, value: string | number | string[]) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  // Gamma 이미지 소스 토글
  const handleGammaImageSourceToggle = (source: string) => {
    const current = formData.gammaImageSources || [];
    const updated = {
      ...formData,
      gammaImageSources: current.includes(source)
        ? current.filter(s => s !== source)
        : [...current, source],
    };
    setFormData(updated);
    onUpdate(updated);
  };

  // 블럭 추가
  const handleAddBlock = () => {
    const newBlock: FormatBlock = {
      id: uuidv4(),
      title: '',
      description: '',
    };
    const updated = {
      ...formData,
      formatBlocks: [...formData.formatBlocks, newBlock],
    };
    setFormData(updated);
    onUpdate(updated);
  };

  // 블럭 삭제
  const handleDeleteBlock = (blockId: string) => {
    const updated = {
      ...formData,
      formatBlocks: formData.formatBlocks.filter((b) => b.id !== blockId),
    };
    setFormData(updated);
    onUpdate(updated);
  };

  // 블럭 순서 변경 (위로)
  const handleMoveBlockUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...formData.formatBlocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    const updated = { ...formData, formatBlocks: newBlocks };
    setFormData(updated);
    onUpdate(updated);
  };

  // 블럭 순서 변경 (아래로)
  const handleMoveBlockDown = (index: number) => {
    if (index === formData.formatBlocks.length - 1) return;
    const newBlocks = [...formData.formatBlocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    const updated = { ...formData, formatBlocks: newBlocks };
    setFormData(updated);
    onUpdate(updated);
  };

  // 블럭 제목 변경
  const handleBlockTitleChange = (blockId: string, title: string) => {
    const updated = {
      ...formData,
      formatBlocks: formData.formatBlocks.map((b) =>
        b.id === blockId ? { ...b, title } : b
      ),
    };
    setFormData(updated);
    onUpdate(updated);
  };

  // Enter 키 핸들러 - 현재 블록 적용 후 다음 블록 추가
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, blockId: string, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // 현재 블록이 마지막 블록인 경우에만 새 블록 추가
      if (index === formData.formatBlocks.length - 1) {
        const newBlock: FormatBlock = {
          id: uuidv4(),
          title: '',
          description: '',
        };
        const updated = {
          ...formData,
          formatBlocks: [...formData.formatBlocks, newBlock],
        };
        setFormData(updated);
        onUpdate(updated);

        // 새 블록의 입력창에 포커스 (약간의 지연 후)
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>('.block-title-input');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) {
            lastInput.focus();
          }
        }, 50);
      } else {
        // 마지막이 아닌 경우, 다음 블록의 입력창으로 포커스 이동
        const inputs = document.querySelectorAll<HTMLInputElement>('.block-title-input');
        const nextInput = inputs[index + 1];
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
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
          <option value="소셜포스트(Gamma)">소셜포스트(Gamma)</option>
        </select>
      </div>

      {/* 포스트 선택 시 */}
      {formData.mappedContentType === '포스트' && (
        <>
          {/* 블럭 형식 포맷 구조 빌더 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                포맷 구조 (블럭 형식)
              </label>
              <button
                type="button"
                onClick={handleAddBlock}
                className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
              >
                + 블럭 추가
              </button>
            </div>

            {formData.formatBlocks.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded-md">
                블럭을 추가하여 포맷 구조를 만드세요
                <br />
                <span className="text-xs">예: 후킹 → 문제상황 → 해결책 → 교훈</span>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.formatBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className="border border-gray-300 rounded-md bg-gray-50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveBlockUp(index)}
                          disabled={index === 0}
                          className="w-6 h-6 text-xs text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                          title="위로"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlockDown(index)}
                          disabled={index === formData.formatBlocks.length - 1}
                          className="w-6 h-6 text-xs text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                          title="아래로"
                        >
                          ▼
                        </button>
                      </div>

                      <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded shrink-0">
                        {index + 1}
                      </span>

                      <input
                        type="text"
                        value={block.title}
                        onChange={(e) => handleBlockTitleChange(block.id, e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, block.id, index)}
                        placeholder="예: 후킹"
                        className="block-title-input flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />

                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block.id)}
                        className="w-6 h-6 text-sm text-red-600 hover:text-red-800 transition-colors shrink-0"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.formatBlocks.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                <strong>구조 미리보기:</strong>{' '}
                {formData.formatBlocks.map((b, i) => b.title || `블럭${i + 1}`).join(' → ')}
              </div>
            )}
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

      {/* 소셜포스트(Gamma) 선택 시 */}
      {formData.mappedContentType === '소셜포스트(Gamma)' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카드 수
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.gammaNumCards || 1}
              onChange={(e) => handleChange('gammaNumCards', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="1-5"
            />
            <p className="text-xs text-gray-500 mt-1">소셜 포스트 카드 개수 (1-5개 권장)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              어조 (Tone)
            </label>
            <input
              type="text"
              value={formData.gammaTone || ''}
              onChange={(e) => handleChange('gammaTone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 친근한, 전문적인, 유머러스한, 진지한"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대상 청중 (Audience)
            </label>
            <input
              type="text"
              value={formData.gammaAudience || ''}
              onChange={(e) => handleChange('gammaAudience', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 20-30대 직장인, 마케터, 스타트업 창업자"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              세부 수준 (Detail Level)
            </label>
            <select
              value={formData.gammaDetailLevel || 'medium'}
              onChange={(e) => handleChange('gammaDetailLevel', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="brief">간략 (Brief)</option>
              <option value="medium">보통 (Medium)</option>
              <option value="detailed">상세 (Detailed)</option>
              <option value="extensive">매우 상세 (Extensive)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 소스
            </label>
            <div className="space-y-2">
              {['aiGenerated', 'Unsplash', 'Giphy', 'none'].map((source) => (
                <label key={source} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.gammaImageSources || []).includes(source)}
                    onChange={() => handleGammaImageSourceToggle(source)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    {source === 'aiGenerated' && 'AI 생성 이미지'}
                    {source === 'Unsplash' && 'Unsplash 사진'}
                    {source === 'Giphy' && 'Giphy GIF'}
                    {source === 'none' && '이미지 없음'}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">최소 1개 이상 선택하세요</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              추가 지시사항
            </label>
            <textarea
              value={formData.gammaAdditionalInstructions || ''}
              onChange={(e) => handleChange('gammaAdditionalInstructions', e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="예: 이모지 사용, CTA 포함, 해시태그 3개 추가"
            />
            <p className="text-xs text-gray-500 mt-1">
              {(formData.gammaAdditionalInstructions || '').length} / 2000자
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default ContentFormatNodeForm;
