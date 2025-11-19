import { useState, useEffect, useRef } from 'react';
import type { Node, ContentFormatNodeConfig, FormatBlock, ExtendedFormatBlock } from '../../types';
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

  const handleChange = (field: keyof ContentFormatNodeConfig, value: string | number | string[] | any) => {
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
      // 전략적 확장 필드 추가
      recommendedLength: '',
      coreStrategy: '',
      keyMoves: [''],
      dos: [''],
      donts: [''],
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
          // 전략적 확장 필드 추가
          recommendedLength: '',
          coreStrategy: '',
          keyMoves: [''],
          dos: [''],
          donts: [''],
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
          {/* 전략 요약 섹션 */}
          {formData.overallStrategy && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                  🎯 전략 요약
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...formData,
                      overallStrategy: undefined
                    };
                    setFormData(updated);
                    onUpdate(updated);
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  전략 요약 삭제
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">퍼널 단계:</label>
                  <input
                    type="text"
                    value={formData.overallStrategy?.funnelStage || ''}
                    onChange={(e) => {
                      const updated = {
                        ...formData,
                        overallStrategy: {
                          ...formData.overallStrategy,
                          funnelStage: e.target.value
                        }
                      };
                      setFormData(updated);
                      onUpdate(updated);
                    }}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="예: 인지/관심/고려/전환"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">감정적 흐름:</label>
                  <input
                    type="text"
                    value={formData.overallStrategy?.emotionalArc || ''}
                    onChange={(e) => {
                      const updated = {
                        ...formData,
                        overallStrategy: {
                          ...formData.overallStrategy,
                          emotionalArc: e.target.value
                        }
                      };
                      setFormData(updated);
                      onUpdate(updated);
                    }}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="예: 호기심→공감→신뢰→행동 의지"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">전략적 집점:</label>
                  <input
                    type="text"
                    value={formData.overallStrategy?.strategicFocus || ''}
                    onChange={(e) => {
                      const updated = {
                        ...formData,
                        overallStrategy: {
                          ...formData.overallStrategy,
                          strategicFocus: e.target.value
                        }
                      };
                      setFormData(updated);
                      onUpdate(updated);
                    }}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="예: 사회적 증거를 통한 신뢰 구축"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">최소 길이:</label>
                    <input
                      type="number"
                      value={formData.overallStrategy?.recommendedLength?.minChars || 0}
                      onChange={(e) => {
                        const updated = {
                          ...formData,
                          overallStrategy: {
                            ...formData.overallStrategy,
                            recommendedLength: {
                              ...formData.overallStrategy?.recommendedLength,
                              minChars: parseInt(e.target.value) || 0,
                              maxChars: formData.overallStrategy?.recommendedLength?.maxChars || 0
                            }
                          }
                        };
                        setFormData(updated);
                        onUpdate(updated);
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">최대 길이:</label>
                    <input
                      type="number"
                      value={formData.overallStrategy?.recommendedLength?.maxChars || 0}
                      onChange={(e) => {
                        const updated = {
                          ...formData,
                          overallStrategy: {
                            ...formData.overallStrategy,
                            recommendedLength: {
                              ...formData.overallStrategy?.recommendedLength,
                              minChars: formData.overallStrategy?.recommendedLength?.minChars || 0,
                              maxChars: parseInt(e.target.value) || 0
                            }
                          }
                        };
                        setFormData(updated);
                        onUpdate(updated);
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 전략 요약이 없는 경우 추가 버튼 */}
          {!formData.overallStrategy && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  const updated = {
                    ...formData,
                    overallStrategy: {
                      funnelStage: '',
                      emotionalArc: '',
                      strategicFocus: '',
                      recommendedLength: {
                        minChars: 0,
                        maxChars: 0
                      }
                    }
                  };
                  setFormData(updated);
                  onUpdate(updated);
                }}
                className="px-4 py-2 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 transition-colors"
              >
                + 전략 요약 추가
              </button>
            </div>
          )}

          {/* 전략적 블럭 구조 섹션 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                전략적 블럭 구조
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
                전략적 블럭을 추가하여 콘텐츠 구조를 만드세요
                <br />
                <span className="text-xs">AI가 분석한 전략적 구조가 자동으로 채워집니다</span>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.formatBlocks.map((block, index) => {
                  const extendedBlock = block as ExtendedFormatBlock;
                  return (
                    <div
                      key={block.id}
                      className="border border-purple-200 rounded-md bg-gradient-to-br from-purple-50 to-white p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
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
                            placeholder="블럭 이름"
                            className="block-title-input flex-1 min-w-[150px] px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
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

                      {/* 확장된 전략 정보 - 수정 가능한 필드 */}
                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block font-medium text-gray-600 mb-1">권장 길이:</label>
                          <input
                            type="text"
                            value={extendedBlock.recommendedLength || ''}
                            onChange={(e) => {
                              const updated = {
                                ...formData,
                                formatBlocks: formData.formatBlocks.map((b) =>
                                  b.id === block.id
                                    ? { ...b, recommendedLength: e.target.value }
                                    : b
                                )
                              };
                              setFormData(updated);
                              onUpdate(updated);
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            placeholder="예: 3~5문장, 200~300자"
                          />
                        </div>

                        <div>
                          <label className="block font-medium text-gray-600 mb-1">핵심 전략:</label>
                          <textarea
                            value={extendedBlock.coreStrategy || ''}
                            onChange={(e) => {
                              const updated = {
                                ...formData,
                                formatBlocks: formData.formatBlocks.map((b) =>
                                  b.id === block.id
                                    ? { ...b, coreStrategy: e.target.value }
                                    : b
                                )
                              };
                              setFormData(updated);
                              onUpdate(updated);
                            }}
                            rows={2}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            placeholder="예: 인지적 불일치 해소를 통한 신뢰 구축"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-medium text-gray-600">주요 기법 (Key Moves):</label>
                            <button
                              type="button"
                              onClick={() => {
                                const currentKeyMoves = (extendedBlock.keyMoves as string[]) || [];
                                const updated = {
                                  ...formData,
                                  formatBlocks: formData.formatBlocks.map((b) =>
                                    b.id === block.id
                                      ? { ...b, keyMoves: [...currentKeyMoves, ''] }
                                      : b
                                  )
                                };
                                setFormData(updated);
                                onUpdate(updated);
                              }}
                              className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                            >
                              + 기법 추가
                            </button>
                          </div>
                          <div className="space-y-1">
                            {(extendedBlock.keyMoves as string[] || []).map((move, i) => (
                              <div key={i} className="flex gap-1">
                                <span className="text-purple-500 font-bold flex-shrink-0 mt-1">•</span>
                                <input
                                  type="text"
                                  value={move}
                                  onChange={(e) => {
                                    const updatedKeyMoves = [...(extendedBlock.keyMoves as string[] || [])];
                                    updatedKeyMoves[i] = e.target.value;
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, keyMoves: updatedKeyMoves }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-yellow-50"
                                  placeholder="예: 제로 프라이싱 효과 활용"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedKeyMoves = (extendedBlock.keyMoves as string[] || []).filter((_, index) => index !== i);
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, keyMoves: updatedKeyMoves }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="w-5 h-5 text-xs text-red-600 hover:text-red-800 flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-medium text-green-600">실행 지침 (DOs):</label>
                            <button
                              type="button"
                              onClick={() => {
                                const currentDos = (extendedBlock.dos as string[]) || [];
                                const updated = {
                                  ...formData,
                                  formatBlocks: formData.formatBlocks.map((b) =>
                                    b.id === block.id
                                      ? { ...b, dos: [...currentDos, ''] }
                                      : b
                                  )
                                };
                                setFormData(updated);
                                onUpdate(updated);
                              }}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              + 지침 추가
                            </button>
                          </div>
                          <div className="space-y-1">
                            {(extendedBlock.dos as string[] || []).map((item, i) => (
                              <div key={i} className="flex gap-1">
                                <span className="text-green-500 font-bold flex-shrink-0 mt-1">✓</span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const updatedDos = [...(extendedBlock.dos as string[] || [])];
                                    updatedDos[i] = e.target.value;
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, dos: updatedDos }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-green-50"
                                  placeholder="예: 구체적인 수치로 신뢰도 제시"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedDos = (extendedBlock.dos as string[] || []).filter((_, index) => index !== i);
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, dos: updatedDos }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="w-5 h-5 text-xs text-red-600 hover:text-red-800 flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-medium text-red-600">금지사항 (DON'Ts):</label>
                            <button
                              type="button"
                              onClick={() => {
                                const currentDonts = (extendedBlock.donts as string[]) || [];
                                const updated = {
                                  ...formData,
                                  formatBlocks: formData.formatBlocks.map((b) =>
                                    b.id === block.id
                                      ? { ...b, donts: [...currentDonts, ''] }
                                      : b
                                  )
                                };
                                setFormData(updated);
                                onUpdate(updated);
                              }}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              + 금지사항 추가
                            </button>
                          </div>
                          <div className="space-y-1">
                            {(extendedBlock.donts as string[] || []).map((item, i) => (
                              <div key={i} className="flex gap-1">
                                <span className="text-red-500 font-bold flex-shrink-0 mt-1">✗</span>
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => {
                                    const updatedDonts = [...(extendedBlock.donts as string[] || [])];
                                    updatedDonts[i] = e.target.value;
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, donts: updatedDonts }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-red-50"
                                  placeholder="예: 과장된 주장 사용 금지"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedDonts = (extendedBlock.donts as string[] || []).filter((_, index) => index !== i);
                                    const updated = {
                                      ...formData,
                                      formatBlocks: formData.formatBlocks.map((b) =>
                                        b.id === block.id
                                          ? { ...b, donts: updatedDonts }
                                          : b
                                      )
                                    };
                                    setFormData(updated);
                                    onUpdate(updated);
                                  }}
                                  className="w-5 h-5 text-xs text-red-600 hover:text-red-800 flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {formData.formatBlocks.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                <strong>전략적 구조:</strong>{' '}
                {formData.formatBlocks.map((b, i) => b.title || `블럭${i + 1}`).join(' → ')}
              </div>
            )}
          </div>

          {/* 생성 프롬프트 섹션 */}
          {formData.generationPromptVariables && formData.generationPromptVariables.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                📝 생성 프롬프트
              </h4>

              <div className="mb-3">
                <span className="font-medium text-gray-600 text-sm">변수:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.generationPromptVariables.map((variable, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-mono">
                      {variable.name}
                    </span>
                  ))}
                </div>
              </div>

              {formData.generationPromptTemplate && (
                <div>
                  <span className="font-medium text-gray-600 text-sm">프롬프트 템플릿:</span>
                  <textarea
                    value={formData.generationPromptTemplate}
                    onChange={(e) => handleChange('generationPromptTemplate', e.target.value)}
                    rows={3}
                    className="w-full mt-2 px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="생성 프롬프트 템플릿..."
                  />
                </div>
              )}
            </div>
          )}

          {/* 기존 예시 텍스트 - 하위 호환성 유지 */}
          {formData.formatExampleText && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                참고 예시 (하위 호환성)
              </label>
              <textarea
                value={formData.formatExampleText}
                onChange={(e) => handleChange('formatExampleText', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                placeholder="기존 예시 텍스트"
              />
            </div>
          )}
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
