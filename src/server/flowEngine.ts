import { v4 as uuidv4 } from 'uuid';
import type {
  Workspace,
  Node,
  Edge,
  GeneratedContent,
  InputNodeConfig,
  ChannelNodeConfig,
  ContentFormatNodeConfig,
  ExecutedPath,
} from './types.js';
import { callLLM, evaluateChannelRelevance, selectBestFormat, generateImage, generateGammaSocialPost } from './llm.js';

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

function findExecutionPaths(workspace: Workspace): ExecutionPath[] {
  const paths: ExecutionPath[] = [];

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
      // 3. Channel 노드의 자식 ContentFormat 노드 찾기
      const formatChildren = findChildNodes(
        channelNode.id,
        workspace.edges,
        workspace.nodes
      ).filter(isContentFormatNode);

      for (const formatNode of formatChildren) {
        paths.push({
          inputNode,
          channelNode,
          formatNode,
        });
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

    // 선택된 포맷이 포함된 경로만 필터링
    const filteredPaths = allPaths.filter((path) =>
      selectedFormatIds.includes(path.formatNode.id)
    );

    console.log(`   발견된 경로: ${allPaths.length}개`);
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

        const statusIcon = channelEval.suitable ? '✓' : '✗';
        console.log(
          `   ${statusIcon} "${channelNode.data.label}" - ${channelEval.suitable ? '적합' : '부적합'} (신뢰도: ${channelEval.confidence}%)`
        );
        console.log(`      이유: ${channelEval.reason}`);

        if (!channelEval.suitable) {
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
          formatConfigs
        );

        if (!formatSelection) {
          console.log(`      ⚠️ 포맷 선택 실패`);
          continue;
        }

        console.log(
          `      ✓ 선택: "${formatSelection.selectedFormat}" (신뢰도: ${formatSelection.confidence}%)`
        );
        console.log(`      이유: ${formatSelection.reason}`);

        // 선택된 Format 노드 찾기
        const selectedFormatNode = formatChildren.find(
          (f) => f.data.label === formatSelection.selectedFormat
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

      let content: GeneratedContent;

      if (isGammaSocialPost) {
        // Gamma 소셜 포스트 생성
        console.log('   📱 Gamma 소셜 포스트 생성 중...');
        const { gammaUrl, inputText } = await generateGammaSocialPost(inputConfig, channelConfig, formatConfig);

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'gamma',
          finalText: `Gamma 소셜 포스트 생성 완료\n\nURL: ${gammaUrl}\n\n입력 텍스트 (${inputText.length}자):\n${inputText.substring(0, 200)}...`,
          gammaUrl: gammaUrl,
          sourceTopic: inputConfig.topic,
          createdAt: new Date().toISOString(),
        };
      } else if (isImageContent) {
        // 이미지 생성
        console.log('   🖼️  이미지 콘텐츠 생성 중...');
        const { imageData, promptUsed } = await generateImage(inputConfig, channelConfig, formatConfig);

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'image',
          finalText: `이미지 생성 완료\n\n사용된 프롬프트:\n${promptUsed}`,
          imageData: imageData,
          sourceTopic: inputConfig.topic,
          createdAt: new Date().toISOString(),
        };
      } else {
        // 텍스트 생성
        console.log('   📝 텍스트 콘텐츠 생성 중...');
        const generatedText = await callLLM(inputConfig, channelConfig, formatConfig);

        content = {
          id: uuidv4(),
          workspaceId: workspace.id,
          channelNodeId: channelNode.id,
          contentFormatNodeId: formatNode.id,
          contentType: 'text',
          finalText: generatedText,
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
      if (i < sortedPaths.length - 1) {
        console.log('⏳ 5초 대기 중...\n');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  console.log(`\n=== 플로우 실행 완료: ${results.length}개 콘텐츠 생성됨 ===\n`);

  return { results, executedPaths: executedPathInfos, skippedPaths: skippedPathInfos };
}
