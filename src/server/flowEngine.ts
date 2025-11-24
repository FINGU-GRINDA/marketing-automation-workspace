import { v4 as uuidv4 } from 'uuid';
import type {
  Workspace,
  Node,
  Edge,
  GeneratedContent,
  InputNodeConfig,
  ChannelNodeConfig,
  ContentFormatNodeConfig,
  SearchNodeConfig,
  ExecutedPath,
} from './types.js';
import { callLLM_SingleFlow, evaluateChannelRelevance, selectBestFormat, generateImage, generateGammaSocialPost, detectLanguage, translateToKorean } from './llm.js';

/**
 * 노드 타입 가드
 */
function isInputNode(node: Node): node is Node & { data: { config: InputNodeConfig } } {
  return node.type === 'input';
}

function isChannelNode(node: Node): node is Node & { data: { config: ChannelNodeConfig } } {
  return node.type === 'channel';
}

function isContentFormatNode(
  node: Node
): node is Node & { data: { config: ContentFormatNodeConfig } } {
  return node.type === 'content_format';
}


function isSearchNode(
  node: Node
): node is Node & { data: { config: SearchNodeConfig } } {
  return node.type === 'search';
}

function isContentNode(
  node: Node
): node is Node & { data: { config: any } } {
  return node.type === 'content';
}

/**
 * 특정 노드의 자식 노드 찾기
 */
function findChildNodes(nodeId: string, edges: Edge[], allNodes: Node[]): Node[] {
  const childNodeIds = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.target);

  return allNodes.filter((node) => childNodeIds.includes(node.id));
}

/**
 * 실행 가능한 경로 찾기 (DFS)
 * Input → Channel → ContentFormat 순서
 */
interface ExecutionPath {
  inputNode: Node & { data: { config: InputNodeConfig } };
  channelNode: Node & { data: { config: ChannelNodeConfig } };
  formatNode: Node & { data: { config: ContentFormatNodeConfig } };
}


/**
 * 서치 실행 경로
 * Input → Channel → Search → Content 순서
 */
interface SearchExecutionPath {
  inputNode: Node & { data: { config: InputNodeConfig } };
  channelNode: Node & { data: { config: ChannelNodeConfig } };
  searchNode: Node & { data: { config: SearchNodeConfig } };
  contentNode: Node & { data: { config: any } }; // Content nodes can have varying configs
}

function findExecutionPaths(workspace: Workspace): ExecutionPath[] {
  const paths: ExecutionPath[] = [];

  console.log(`[DEBUG] findExecutionPaths: 시작`);
  console.log(`[DEBUG] 전체 노드 수: ${workspace.nodes.length}`);
  console.log(`[DEBUG] 전체 엣지 수: ${workspace.edges.length}`);

  // 1. Input 노드 찾기
  const inputNodes = workspace.nodes.filter(isInputNode);
  console.log(`[DEBUG] Input 노드 수: ${inputNodes.length}`);

  for (const inputNode of inputNodes) {
    console.log(`[DEBUG] Input 노드: ${inputNode.data.label} (ID: ${inputNode.id})`);

    // 2. Input 노드의 자식 Channel 노드 찾기
    const channelChildren = findChildNodes(
      inputNode.id,
      workspace.edges,
      workspace.nodes
    ).filter(isChannelNode);

    console.log(`[DEBUG] ${inputNode.data.label}의 자식 Channel 노드 수: ${channelChildren.length}`);

    for (const channelNode of channelChildren) {
      console.log(`[DEBUG]   - Channel 노드: ${channelNode.data.label} (ID: ${channelNode.id})`);

      // 3. Channel 노드의 자식 ContentFormat 노드 찾기
      const formatChildren = findChildNodes(
        channelNode.id,
        workspace.edges,
        workspace.nodes
      ).filter(isContentFormatNode);

      console.log(`[DEBUG]   - ${channelNode.data.label}의 자식 Format 노드 수: ${formatChildren.length}`);

      for (const formatNode of formatChildren) {
        console.log(`[DEBUG]     - Format 노드: ${formatNode.data.label} (ID: ${formatNode.id})`);
        paths.push({
          inputNode,
          channelNode,
          formatNode,
        });
      }
    }
  }

  console.log(`[DEBUG] findExecutionPaths: 완료, 총 경로 수: ${paths.length}`);
  return paths;
}

/**
 * 서치 실행 가능한 경로 찾기
 * Input → Channel → Search → Content 순서
 */
function findSearchExecutionPaths(workspace: Workspace): SearchExecutionPath[] {
  const paths: SearchExecutionPath[] = [];

  // 1. Input 노드 찾기
  const inputNodes = workspace.nodes.filter(isInputNode);

  for (const inputNode of inputNodes) {
    // 2. Input 노드의 자식 Channel 노드 찾기
    const channelChildren = findChildNodes(
      inputNode.id,
      workspace.edges,
      workspace.nodes
    ).filter(isChannelNode);

    for (const channelNode of channelChildren) {
      // 3. Channel 노드의 자식 Search 노드 찾기
      const searchChildren = findChildNodes(
        channelNode.id,
        workspace.edges,
        workspace.nodes
      ).filter(isSearchNode);

      for (const searchNode of searchChildren) {
        // 4. Search 노드의 자식 Content 노드 찾기
        const contentChildren = findChildNodes(
          searchNode.id,
          workspace.edges,
          workspace.nodes
        ).filter(isContentNode);

        for (const contentNode of contentChildren) {
          paths.push({
            inputNode,
            channelNode,
            searchNode,
            contentNode,
          });
        }
      }
    }
  }

  return paths;
}

/**
 * 경로 정보를 ExecutedPath 형식으로 변환
 */
function pathToExecutedPath(path: ExecutionPath, edges: Edge[]): ExecutedPath {
  const relevantEdges = edges.filter(
    (edge) =>
      (edge.source === path.inputNode.id && edge.target === path.channelNode.id) ||
      (edge.source === path.channelNode.id && edge.target === path.formatNode.id)
  );

  return {
    inputNodeId: path.inputNode.id,
    channelNodeId: path.channelNode.id,
    formatNodeId: path.formatNode.id,
    edgeIds: relevantEdges.map((e) => e.id),
  };
}

/**
 * 플로우 실행 콜백 인터페이스
 */
interface FlowExecutionCallbacks {
  mode?: 'auto' | 'manual';
  selectedFormatIds?: string[];
  onPathStart?: (path: ExecutedPath) => void;
  onPathComplete?: (path: ExecutedPath, content: GeneratedContent) => void;
}

/**
 * 플로우 실행 메인 함수 (2단계 평가: Channel 적합성 → Format 선택)
 */
export async function executeFlow(
  workspace: Workspace,
  callbacks?: FlowExecutionCallbacks
): Promise<{ results: GeneratedContent[]; executedPaths: ExecutedPath[]; skippedPaths: ExecutedPath[] }> {
  const executionMode = callbacks?.mode || 'auto';
  const selectedFormatIds = callbacks?.selectedFormatIds || [];

  console.log(`\n=== 플로우 실행 시작 (${executionMode} 모드) ===`);
  if (executionMode === 'manual') {
    console.log(`   선택된 포맷 ID: ${selectedFormatIds.join(', ')}`);
  }

  // 1. Input 노드들 찾기
  const inputNodes = workspace.nodes.filter(isInputNode);

  if (inputNodes.length === 0) {
    console.log('입력 노드가 없습니다.');
    return { results: [], executedPaths: [], skippedPaths: [] };
  }

  const selectedPaths: ExecutionPath[] = [];
  const skippedChannels: Array<{
    inputNode: Node;
    channelNode: Node;
    reason: string;
  }> = [];

  // 2. 실행 모드에 따라 처리
  if (executionMode === 'manual') {
    // === 수동 선택 모드 ===
    console.log('\n📋 수동 선택 모드: 입력→채널→선택된 포맷 경로 탐색');

    // 모든 실행 가능한 경로 찾기
    const allPaths = findExecutionPaths(workspace);

    console.log(`   발견된 경로: ${allPaths.length}개`);
    console.log(`   선택된 포맷 ID: ${selectedFormatIds.join(', ')}`);

    allPaths.forEach((path, idx) => {
      const isMatch = selectedFormatIds.includes(path.formatNode.id);
      console.log(`   [경로 ${idx + 1}] ${path.inputNode.data.label} → ${path.channelNode.data.label} → ${path.formatNode.data.label}`);
      console.log(`      Format ID: ${path.formatNode.id}`);
      console.log(`      선택됨: ${isMatch ? '✓' : '✗'}`);
    });

    // 선택된 포맷이 포함된 경로만 필터링
    const filteredPaths = allPaths.filter((path) =>
      selectedFormatIds.includes(path.formatNode.id)
    );

    console.log(`   선택된 포맷 경로: ${filteredPaths.length}개`);

    filteredPaths.forEach((path) => {
      console.log(
        `   ✓ ${path.inputNode.data.label} → ${path.channelNode.data.label} → ${path.formatNode.data.label}`
      );
    });

    selectedPaths.push(...filteredPaths);
  } else {
    // === 자동 생성 모드 (기존 로직) ===
    // 2. 각 Input 노드에 대해 처리
    for (const inputNode of inputNodes) {
    const inputConfig = inputNode.data.config;
    console.log(`\n📥 입력: "${inputNode.data.label}"`);

    // 2-1. 연결된 Channel 노드들 찾기
    const channelChildren = findChildNodes(
      inputNode.id,
      workspace.edges,
      workspace.nodes
    ).filter(isChannelNode);

    if (channelChildren.length === 0) {
      console.log('   ⚠️ 연결된 채널이 없습니다.');
      continue;
    }

    console.log(`\n🔍 1단계: 채널 적합성 평가 (${channelChildren.length}개 채널)`);

    // 2-2. 각 Channel의 적합성 평가
    for (const channelNode of channelChildren) {
      const channelConfig = channelNode.data.config;

      try {
        const channelEval = await evaluateChannelRelevance(inputConfig, channelConfig);

        const isSuitable = channelEval.score >= 50;
        const statusIcon = isSuitable ? '✓' : '✗';
        console.log(
          `   ${statusIcon} "${channelNode.data.label}" - ${isSuitable ? '적합' : '부적합'} (점수: ${channelEval.score}점)`
        );
        console.log(`      이유: ${channelEval.reason}`);

        if (!isSuitable) {
          skippedChannels.push({
            inputNode,
            channelNode,
            reason: channelEval.reason,
          });
          continue;
        }

        // 2-3. 적합한 채널의 Format 노드들 찾기
        const formatChildren = findChildNodes(
          channelNode.id,
          workspace.edges,
          workspace.nodes
        ).filter(isContentFormatNode);

        if (formatChildren.length === 0) {
          console.log(`      ⚠️ 연결된 포맷이 없습니다.`);
          continue;
        }

        // 2-4. 최적 Format 1개 선택
        console.log(`\n   🎯 2단계: 최적 포맷 선택 (${formatChildren.length}개 포맷 중)`);

        const formatConfigs = formatChildren.map((f) => ({
          id: f.id,
          name: f.data.label,
          config: f.data.config,
        }));

        const formatSelection = await selectBestFormat(
          inputConfig,
          channelConfig,
          formatConfigs.map(f => f.config) as ContentFormatNodeConfig[]
        );

        if (!formatSelection) {
          console.log(`      ⚠️ 포맷 선택 실패`);
          continue;
        }

        console.log(
          `      ✓ 선택: "${formatSelection.bestFormat.name}"`
        );
        console.log(`      이유: ${formatSelection.reason}`);

        // 선택된 Format 노드 찾기
        const selectedFormatNode = formatChildren.find(
          (f) => f.data.label === formatSelection.bestFormat.name
        );

        if (!selectedFormatNode) {
          console.log(`      ⚠️ 선택된 포맷 노드를 찾을 수 없습니다.`);
          continue;
        }

        // 선택된 경로 추가
        selectedPaths.push({
          inputNode,
          channelNode,
          formatNode: selectedFormatNode,
        });
      } catch (error) {
        console.error(`   ✗ 평가 오류: ${channelNode.data.label}`, error);
      }
    }
    }
  }

  console.log(`\n=== 평가 완료: ${selectedPaths.length}개 경로 선택됨 ===\n`);

  if (selectedPaths.length === 0) {
    console.log('적합한 경로가 없어 콘텐츠를 생성하지 않습니다.');
    return { results: [], executedPaths: [], skippedPaths: [] };
  }

  // 3. 경로 정보 생성
  const executedPathInfos = selectedPaths.map((path) =>
    pathToExecutedPath(path, workspace.edges)
  );

  // 스킵된 채널 정보는 ExecutedPath 형식으로 변환 불가 (포맷이 없으므로)
  // 여기서는 빈 배열로 반환
  const skippedPathInfos: ExecutedPath[] = [];

  // 4. 경로를 y 좌표 기준으로 정렬 (상단 → 하단)
  const sortedPaths = [...selectedPaths].sort((a, b) => {
    return a.formatNode.position.y - b.formatNode.position.y;
  });

  console.log('=== 콘텐츠 생성 시작 (5초 간격) ===');
  console.log(`총 ${sortedPaths.length}개 경로 실행 예정\n`);

  const results: GeneratedContent[] = [];

  // 5. 선택된 경로를 순차적으로 실행
  for (let i = 0; i < sortedPaths.length; i++) {
    const path = sortedPaths[i];
    const { inputNode, channelNode, formatNode } = path;
    const pathInfo = pathToExecutedPath(path, workspace.edges);

    try {
      console.log(
        `[${i + 1}/${sortedPaths.length}] 생성 중: ${inputNode.data.label} → ${channelNode.data.label} → ${formatNode.data.label}`
      );

      callbacks?.onPathStart?.(pathInfo);

      const inputConfig = inputNode.data.config;
      const channelConfig = channelNode.data.config;
      const formatConfig = formatNode.data.config;

      // 콘텐츠 타입에 따라 생성 방식 선택
      const contentTypeValue = formatConfig.mappedContentType;
      const isImageContent = contentTypeValue === '일반이미지';
      const isGammaSocialPost = contentTypeValue === '소셜포스트(Gamma)';

      console.log(`[FLOW] 포맷 체크 - ID: ${formatNode.id}, 이름: ${formatNode.data.label}`);
      console.log(`[FLOW] contentTypeValue: "${contentTypeValue}", isGammaSocialPost: ${isGammaSocialPost}`);

      let content: GeneratedContent;

      if (isGammaSocialPost) {
        // Gamma 소셜 포스트 생성
        console.log('   📱 Gamma 소셜 포스트 생성 중...');
        const gammaUrl = await generateGammaSocialPost(inputConfig, channelConfig, formatConfig);

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'gamma',
          finalText: `Gamma 소셜 포스트 생성 완료\n\nURL: ${gammaUrl}`,
          gammaUrl: gammaUrl,
          sourceTopic: inputConfig.topic,
          createdAt: new Date().toISOString(),
        };
      } else if (isImageContent) {
        // 이미지 생성
        console.log('   🖼️  이미지 콘텐츠 생성 중...');
        const imageData = await generateImage(inputConfig, channelConfig, formatConfig);

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'image',
          finalText: '이미지 생성 완료',
          imageData: imageData,
          sourceTopic: inputConfig.topic,
          createdAt: new Date().toISOString(),
        };
      } else {
        // 텍스트 생성 (1회성 싱글 플로우)
        console.log('   📝 텍스트 콘텐츠 생성 중 (1회성 싱글 플로우)...');
        // 포맷에 저장된 targetLanguage 사용, 없으면 inputConfig의 targetLanguage 사용
        const targetLanguage = formatConfig.targetLanguage || inputConfig.targetLanguage || 'ko';
        const generatedText = await callLLM_SingleFlow(inputConfig, channelConfig, formatConfig, targetLanguage);

        // 생성된 텍스트의 언어 감지
        console.log('   🔍 생성된 텍스트의 언어 감지 중...');
        const languageInfo = await detectLanguage(generatedText);
        console.log(`   ✓ 감지된 언어: ${languageInfo.language} (한국어: ${languageInfo.isKorean})`);

        let finalText = generatedText;
        let isTranslated = false;
        let originalText: string | undefined;
        let detectedLanguage = languageInfo.language;

        // 한국어가 아닌 경우 한국어로 번역하고 원본도 저장
        if (!languageInfo.isKorean) {
          console.log('   🔄 한국어 번역 실행 중...');
          finalText = await translateToKorean(generatedText);
          isTranslated = true;
          originalText = generatedText;
          console.log('   ✓ 한국어 번역 완료 (원본과 번역본 모두 저장)');
        }

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'text',
          finalText: finalText,
          originalText: originalText,
          detectedLanguage: detectedLanguage,
          isTranslated: isTranslated,
          sourceTopic: inputConfig.topic,
          createdAt: new Date().toISOString(),
        };
      }

      results.push(content);
      console.log(`✓ [${i + 1}/${sortedPaths.length}] 콘텐츠 생성 완료: ${formatNode.data.label}`);

      callbacks?.onPathComplete?.(pathInfo, content);

      // 마지막 경로가 아니면 5초 대기
      if (i < sortedPaths.length - 1) {
        console.log('⏳ 5초 대기 중...\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`✗ 생성 실패:`, error);
      // 에러를 즉시 전파하여 SSE로 전달되도록 함
      throw error;
    }
  }

  console.log(`\n=== 플로우 실행 완료: ${results.length}개 콘텐츠 생성됨 ===\n`);

  return { results, executedPaths: executedPathInfos, skippedPaths: skippedPathInfos };
}


/**
 * 서치 실행 함수
 * Input → Channel → Search → Content 경로를 실행하여 검색 결과를 Content 노드에 저장
 */
export async function executeSearch(
  workspace: Workspace,
  callbacks?: {
    onPathStart?: (path: { inputNodeId: string; channelNodeId: string; searchNodeId: string; contentNodeId: string }) => void;
    onPathComplete?: (path: { inputNodeId: string; channelNodeId: string; searchNodeId: string; contentNodeId: string }, result: any, updatedWorkspace: Workspace) => void;
  }
): Promise<{ results: any[]; executedPaths: Array<{ inputNodeId: string; channelNodeId: string; searchNodeId: string; contentNodeId: string }>; updatedWorkspace: Workspace }> {
  console.log(`\n=== 서치 실행 시작 ===`);

  // 1. 서치 실행 경로 찾기
  const searchPaths = findSearchExecutionPaths(workspace);

  if (searchPaths.length === 0) {
    console.log('서치 실행 가능한 경로가 없습니다. (Input → Channel → Search → Content)');
    return { results: [], executedPaths: [], updatedWorkspace: workspace };
  }

  console.log(`발견된 서치 경로: ${searchPaths.length}개`);

  const results: any[] = [];
  const executedPaths: Array<{ inputNodeId: string; channelNodeId: string; searchNodeId: string; contentNodeId: string }> = [];
  let updatedWorkspace = { ...workspace };

  // 2. 각 경로 실행
  for (let i = 0; i < searchPaths.length; i++) {
    const path = searchPaths[i];
    const { inputNode, channelNode, searchNode, contentNode } = path;

    const pathInfo = {
      inputNodeId: inputNode.id,
      channelNodeId: channelNode.id,
      searchNodeId: searchNode.id,
      contentNodeId: contentNode.id
    };

    try {
      console.log(
        `[${i + 1}/${searchPaths.length}] 서치 중: ${inputNode.data.label} → ${channelNode.data.label} → ${searchNode.data.label} → ${contentNode.data.label}`
      );

      callbacks?.onPathStart?.(pathInfo);

      const searchConfig = searchNode.data.config;

      // 여기서 실제 서치 API 호출 (기존 /api/search/execute 로직 참조)
      console.log('   🔍 실제 서치 실행 중...');

      // 서치 API 호출 (기존 로직과 동일)
      const searchResponse = await fetch('http://localhost:3000/api/search/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          searchNodeId: searchNode.id,
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`서치 API 오류: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchResult = await searchResponse.json();

      // Content 노드에 검색 결과 저장
      const updatedContentConfig = {
        ...contentNode.data.config,
        searchResults: (searchResult as any).searchResults || [],
        lastUpdatedAt: new Date().toISOString()
      };

      // 서치 노드에 실행 결과 저장
      const updatedSearchConfig = {
        ...searchConfig,
        lastExecutedAt: new Date().toISOString(),
        searchNodeResult: (searchResult as any).searchNodeResult
      };

      // 워크스페이스 업데이트
      updatedWorkspace = {
        ...updatedWorkspace,
        nodes: updatedWorkspace.nodes.map(node =>
          node.id === contentNode.id
            ? { ...node, data: { ...node.data, config: updatedContentConfig } }
            : node.id === searchNode.id
            ? { ...node, data: { ...node.data, config: updatedSearchConfig } }
            : node
        )
      };

      results.push(searchResult as GeneratedContent);
      executedPaths.push(pathInfo);

      console.log(`✓ [${i + 1}/${searchPaths.length}] 서치 완료: 검색 결과가 Content 노드에 저장됨`);

      callbacks?.onPathComplete?.(pathInfo, searchResult as GeneratedContent, updatedWorkspace);

      // 마지막 경로가 아니면 5초 대기
      if (i < searchPaths.length - 1) {
        console.log('⏳ 5초 대기 중...\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`✗ 서치 실패:`, error);
      throw error;
    }
  }

  console.log(`\n=== 서치 실행 완료: ${results.length}개 경로 실행됨 ===\n`);

  return { results, executedPaths, updatedWorkspace };
}

/**
 * 통합 플로우 실행 함수
 * 워크스페이스의 모든 경로 유형을 감지하고 실행
 */
// Export path finding functions for debugging
export {
  findExecutionPaths,
  findSearchExecutionPaths,
};

export async function executeUnifiedFlow(
  workspace: Workspace,
  callbacks?: {
    onPathStart?: (pathType: string, pathInfo: any) => void;
    onPathComplete?: (pathType: string, pathInfo: any, result: any, updatedWorkspace: Workspace) => void;
  }
): Promise<{
  contentResults: GeneratedContent[];
  searchResults: any[];
  executedPaths: Array<{ type: string; pathInfo: any }>;
  updatedWorkspace: Workspace;
}> {
  console.log(`\n=== 통합 플로우 실행 시작 ===`);

  const contentResults: GeneratedContent[] = [];
  const searchResults: any[] = [];
  const executedPaths: Array<{ type: string; pathInfo: any }> = [];
  let updatedWorkspace = { ...workspace };

  try {
    // 1. 일반 콘텐츠 생성 경로 실행 (Input → Channel → ContentFormat)
    console.log('\n📝 일반 콘텐츠 생성 경로 확인...');
    const contentPaths = findExecutionPaths(workspace);
    if (contentPaths.length > 0) {
      console.log(`일반 콘텐츠 경로 ${contentPaths.length}개 발견, 실행 중...`);
      const contentExecution = await executeFlow(workspace, {
        onPathStart: (path) => callbacks?.onPathStart?.('content', path),
        onPathComplete: (path, result) => {
          executedPaths.push({ type: 'content', pathInfo: path });
          callbacks?.onPathComplete?.('content', path, result, updatedWorkspace);
        }
      });
      contentResults.push(...contentExecution.results);
      updatedWorkspace = workspace; // executeFlow은 워크스페이스를 직접 수정하지 않음
    }

    // 2. 서치 경로 실행 (Input → Channel → Search → Content)
    console.log('\n🔍 서치 경로 확인...');
    const searchPaths = findSearchExecutionPaths(updatedWorkspace);
    if (searchPaths.length > 0) {
      console.log(`서치 경로 ${searchPaths.length}개 발견, 실행 중...`);
      const searchExecution = await executeSearch(updatedWorkspace, {
        onPathStart: (path) => callbacks?.onPathStart?.('search', path),
        onPathComplete: (path, result, newWorkspace) => {
          executedPaths.push({ type: 'search', pathInfo: path });
          callbacks?.onPathComplete?.('search', path, result, newWorkspace);
        }
      });
      searchResults.push(...searchExecution.results);
      executedPaths.push(...searchExecution.executedPaths.map(pathInfo => ({ type: 'search', pathInfo })));
      updatedWorkspace = searchExecution.updatedWorkspace;
    }

  
    console.log(`\n=== 통합 플로우 실행 완료 ===`);
    console.log(`- 콘텐츠 생성: ${contentResults.length}개`);
    console.log(`- 서치 실행: ${searchResults.length}개`);
    console.log(`- 총 실행 경로: ${executedPaths.length}개\n`);

    return {
      contentResults,
      searchResults,
      executedPaths,
      updatedWorkspace
    };
  } catch (error) {
    console.error('통합 플로우 실행 중 오류:', error);
    throw error;
  }
}
