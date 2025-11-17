import { useState, useEffect, useRef } from 'react';
import type { Node, ChannelNodeConfig, Workspace } from '../../types';

interface ChannelNodeFormProps {
  node: Node;
  onUpdate: (config: ChannelNodeConfig) => void;
  onCreateFormatNode?: (channelNodeId: string, formatName: string) => void;
  onSuggestFormats?: (channelNodeId: string) => void;
  workspace?: Workspace;
  setWorkspace?: (workspace: Workspace) => void;
}

function ChannelNodeForm({ node, onUpdate, onCreateFormatNode, onSuggestFormats, workspace, setWorkspace }: ChannelNodeFormProps) {
  const config = node.data.config as ChannelNodeConfig;
  const [formData, setFormData] = useState(config);

  // 태그 입력 중인 텍스트
  const [personaInput, setPersonaInput] = useState('');
  const [toneInput, setToneInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [prohibitedInput, setProhibitedInput] = useState('');

  // 자동완성 제안
  const [personaSuggestion, setPersonaSuggestion] = useState('');
  const [toneSuggestion, setToneSuggestion] = useState('');
  const [contentSuggestion, setContentSuggestion] = useState('');

  // 이전 콘텐츠 태그를 추적하기 위한 ref
  const previousContentTagsRef = useRef<string[]>([]);

  // node가 변경될 때만 formData 리셋
  useEffect(() => {
    const newConfig = node.data.config as ChannelNodeConfig;
    setFormData(newConfig);
    previousContentTagsRef.current = newConfig.highLevelContentTags;
  }, [node.id]);

  // localStorage에서 태그 히스토리 가져오기
  const getTagHistory = (field: string): string[] => {
    try {
      const history = localStorage.getItem(`channelForm_${field}_history`);
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  };

  // localStorage에 태그 히스토리 저장
  const saveTagHistory = (field: string, tag: string) => {
    try {
      const history = getTagHistory(field);
      if (!history.includes(tag)) {
        const updated = [tag, ...history].slice(0, 50); // 최대 50개 저장
        localStorage.setItem(`channelForm_${field}_history`, JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Failed to save tag history:', e);
    }
  };

  // 자동완성 제안 찾기
  const findSuggestion = (input: string, field: string): string => {
    if (!input) return '';
    const history = getTagHistory(field);
    const match = history.find(tag => tag.toLowerCase().startsWith(input.toLowerCase()));
    return match || '';
  };

  const handleChange = (field: keyof ChannelNodeConfig, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);

    // 콘텐츠 태그가 추가된 경우 자동으로 포맷 노드 생성
    if (field === 'highLevelContentTags' && onCreateFormatNode) {
      const newTags = value as string[];
      const previousTags = previousContentTagsRef.current;

      // 새로 추가된 태그 찾기
      const addedTags = newTags.filter(tag => !previousTags.includes(tag));

      // 각 새 태그마다 포맷 노드 생성
      addedTags.forEach(tagName => {
        onCreateFormatNode(node.id, tagName);
      });

      // 현재 태그 목록 저장
      previousContentTagsRef.current = newTags;
    }
  };

  // 태그 입력 변경 핸들러 (Space 입력 시 태그 추가)
  const handleTagInputChange = (
    value: string,
    field: 'personaTags' | 'toneTags' | 'highLevelContentTags',
    fieldName: string,
    setInput: (v: string) => void,
    setSuggestion: (v: string) => void
  ) => {
    // Space가 입력되면 태그로 추가
    if (value.endsWith(' ')) {
      const suggestion = getSuggestionForField(fieldName);
      const newTag = suggestion || value.trim();

      if (newTag) {
        const currentTags = formData[field];
        if (!currentTags.includes(newTag)) {
          handleChange(field, [...currentTags, newTag]);
          saveTagHistory(fieldName, newTag); // 히스토리에 저장
        }
      }
      setInput('');
      setSuggestion('');
    } else {
      setInput(value);
      // 자동완성 제안 업데이트
      const suggestion = findSuggestion(value, fieldName);
      setSuggestion(suggestion);
    }
  };

  // 현재 필드의 제안 가져오기
  const getSuggestionForField = (fieldName: string): string => {
    switch (fieldName) {
      case 'personaTags': return personaSuggestion;
      case 'toneTags': return toneSuggestion;
      case 'highLevelContentTags': return contentSuggestion;
      default: return '';
    }
  };

  // Backspace로 마지막 태그 삭제
  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'personaTags' | 'toneTags' | 'highLevelContentTags',
    currentValue: string
  ) => {
    if (e.key === 'Backspace' && !currentValue) {
      // 입력이 비어있을 때 Backspace로 마지막 태그 삭제
      e.preventDefault();
      const currentTags = formData[field];
      if (currentTags.length > 0) {
        handleChange(field, currentTags.slice(0, -1));
      }
    }
  };

  // 금지 유형 입력 핸들러 (Enter로 추가)
  const handleProhibitedInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && prohibitedInput.trim()) {
      e.preventDefault();
      const newType = prohibitedInput.trim();
      const currentTypes = formData.prohibitedTypes || [];
      if (!currentTypes.includes(newType)) {
        handleChange('prohibitedTypes', [...currentTypes, newType]);
      }
      setProhibitedInput('');
    } else if (e.key === 'Backspace' && !prohibitedInput) {
      // 입력이 비어있을 때 Backspace로 마지막 항목 삭제
      e.preventDefault();
      const currentTypes = formData.prohibitedTypes || [];
      if (currentTypes.length > 0) {
        handleChange('prohibitedTypes', currentTypes.slice(0, -1));
      }
    }
  };

  // 금지 유형 삭제
  const handleRemoveProhibitedType = (typeToRemove: string) => {
    const currentTypes = formData.prohibitedTypes || [];
    handleChange('prohibitedTypes', currentTypes.filter((type) => type !== typeToRemove));
  };

  // 태그 삭제
  const handleRemoveTag = (field: 'personaTags' | 'toneTags' | 'highLevelContentTags', tagToRemove: string) => {
    const currentTags = formData[field];
    handleChange(field, currentTags.filter((tag) => tag !== tagToRemove));

    // 콘텐츠 태그 제거 시 해당 포맷 노드와의 연결(엣지)도 제거
    if (field === 'highLevelContentTags' && workspace && setWorkspace) {
      // 제거할 태그와 이름이 같은 포맷 노드 찾기
      const formatNodes = workspace.nodes.filter(
        (n) => n.type === 'content_format' && n.data.config?.name === tagToRemove
      );

      if (formatNodes.length > 0) {
        // 현재 채널에서 해당 포맷 노드로 가는 엣지 찾기
        const edgesToRemove = workspace.edges.filter(
          (e) =>
            e.source === node.id &&
            formatNodes.some((formatNode) => formatNode.id === e.target)
        );

        if (edgesToRemove.length > 0) {
          // 엣지 제거
          const updatedEdges = workspace.edges.filter(
            (e) => !edgesToRemove.some((removeEdge) => removeEdge.id === e.id)
          );

          setWorkspace({
            ...workspace,
            edges: updatedEdges,
          });

          console.log(`✓ 콘텐츠 태그 "${tagToRemove}" 제거로 인해 ${edgesToRemove.length}개 엣지 제거됨`);
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-gray-700 pb-2 border-b">
        채널 노드
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          채널 이름
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: LinkedIn"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          채널 타입
        </label>
        <select
          value={formData.channelType}
          onChange={(e) => handleChange('channelType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="linkedin">LinkedIn</option>
          <option value="blog">Blog</option>
          <option value="instagram">Instagram</option>
          <option value="x">X (Twitter)</option>
          <option value="threads">Threads</option>
          <option value="youtube">YouTube</option>
          <option value="slack">Slack</option>
          <option value="facebook">Facebook</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          페르소나 태그 (Space로 추가)
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-within:ring-2 focus-within:ring-blue-500 min-h-[42px]">
          <div className="flex flex-wrap gap-2 items-center">
            {formData.personaTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag('personaTags', tag)}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="relative flex-1 min-w-[120px]">
              {personaSuggestion && (
                <div className="absolute left-0 top-0 pointer-events-none text-gray-400">
                  {personaSuggestion}
                </div>
              )}
              <input
                type="text"
                value={personaInput}
                onChange={(e) => handleTagInputChange(e.target.value, 'personaTags', 'personaTags', setPersonaInput, setPersonaSuggestion)}
                onKeyDown={(e) => handleTagKeyDown(e, 'personaTags', personaInput)}
                className="w-full outline-none bg-transparent relative z-10"
                placeholder={formData.personaTags.length === 0 ? "예: 20대 (Space로 추가)" : ""}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          톤 태그 (Space로 추가)
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-within:ring-2 focus-within:ring-blue-500 min-h-[42px]">
          <div className="flex flex-wrap gap-2 items-center">
            {formData.toneTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag('toneTags', tag)}
                  className="hover:text-green-900"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="relative flex-1 min-w-[120px]">
              {toneSuggestion && (
                <div className="absolute left-0 top-0 pointer-events-none text-gray-400">
                  {toneSuggestion}
                </div>
              )}
              <input
                type="text"
                value={toneInput}
                onChange={(e) => handleTagInputChange(e.target.value, 'toneTags', 'toneTags', setToneInput, setToneSuggestion)}
                onKeyDown={(e) => handleTagKeyDown(e, 'toneTags', toneInput)}
                className="w-full outline-none bg-transparent relative z-10"
                placeholder={formData.toneTags.length === 0 ? "예: 친근한 (Space로 추가)" : ""}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          콘텐츠 태그 (Space로 추가)
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-within:ring-2 focus-within:ring-blue-500 min-h-[42px]">
          <div className="flex flex-wrap gap-2 items-center">
            {formData.highLevelContentTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag('highLevelContentTags', tag)}
                  className="hover:text-purple-900"
                >
                  ×
                </button>
              </span>
            ))}
            <div className="relative flex-1 min-w-[120px]">
              {contentSuggestion && (
                <div className="absolute left-0 top-0 pointer-events-none text-gray-400">
                  {contentSuggestion}
                </div>
              )}
              <input
                type="text"
                value={contentInput}
                onChange={(e) => handleTagInputChange(e.target.value, 'highLevelContentTags', 'highLevelContentTags', setContentInput, setContentSuggestion)}
                onKeyDown={(e) => handleTagKeyDown(e, 'highLevelContentTags', contentInput)}
                className="w-full outline-none bg-transparent relative z-10"
                placeholder={formData.highLevelContentTags.length === 0 ? "예: 스토리텔링 (Space로 추가)" : ""}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          금지 유형 (Enter로 추가)
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-within:ring-2 focus-within:ring-blue-500 min-h-[42px]">
          <div className="flex flex-wrap gap-2 items-center">
            {(formData.prohibitedTypes || []).map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs"
              >
                {type}
                <button
                  type="button"
                  onClick={() => handleRemoveProhibitedType(type)}
                  className="hover:text-red-900"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={prohibitedInput}
              onChange={(e) => setProhibitedInput(e.target.value)}
              onKeyDown={handleProhibitedInputKeyDown}
              className="flex-1 min-w-[120px] outline-none bg-transparent"
              placeholder={(formData.prohibitedTypes || []).length === 0 ? "예: 정치적 내용 (Enter로 추가)" : ""}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          채널 지식/브랜드 설명
        </label>
        <textarea
          value={formData.channelKnowledge}
          onChange={(e) => handleChange('channelKnowledge', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="브랜드나 채널에 대한 설명..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          콘텐츠 톤앤매너 예시
        </label>
        <textarea
          value={formData.toneMannerExample}
          onChange={(e) => handleChange('toneMannerExample', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="이 채널의 말투나 어감을 이해할 수 있는 예시 텍스트를 입력하세요..."
        />
      </div>

      {/* AI 포맷 제안 버튼 */}
      {onSuggestFormats && (
        <div className="pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => onSuggestFormats(node.id)}
            className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md text-sm font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
          >
            ✨ AI 포맷 제안 받기
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            채널 정보를 분석하여 2-3개의 적합한 포맷을 자동 생성합니다
          </p>
        </div>
      )}
    </div>
  );
}

export default ChannelNodeForm;
