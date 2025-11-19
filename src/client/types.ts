// 서버 타입과 동일하게 유지
export type NodeType = "input" | "channel" | "content_format" | "canvas_box";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config?: NodeConfig;
    workflowId?: string; // 워크플로우 식별자
    orderIndex?: number; // 형제 노드 내 순서
  };
  style?: {
    width?: number;
    height?: number;
    [key: string]: any;
  };
  zIndex?: number;
  selected?: boolean;
  draggable?: boolean;
  [key: string]: any; // ReactFlow의 추가 속성들을 위해
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export type NodeConfig =
  | InputNodeConfig
  | ChannelNodeConfig
  | ContentFormatNodeConfig;

export interface InputNodeConfig {
  kind: "input";
  title: string;
  topic: string;
  rawData: string;
  targetLanguage?: string; // 타겟 언어 (기본값: 'ko')
  message?: string; // 추가 메시지
}

export interface ChannelNodeConfig {
  kind: "channel";
  name: string;
  channelType: string;
  personaTags: string[];
  toneTags: string[];
  highLevelContentTags: string[];
  channelKnowledge: string;
  toneMannerExample: string; // 톤앤매너를 이해할 수 있는 예시 텍스트
  prohibitedTypes: string[]; // 금지할 콘텐츠 유형들
}

// Format Block (블럭 형식 구조)
export interface FormatBlock {
  id: string;
  title: string;
  description?: string;
}

export interface ContentFormatNodeConfig {
  kind: "content_format";
  name: string;
  mappedContentType: string;
  formatBlocks: FormatBlock[]; // 블럭 형식 구조
  formatExampleText: string;
  formatStructureDescription: string; // 하위 호환성을 위해 유지

  // 전략 분석기 확장 필드
  overallStrategy?: {
    funnelStage: string;
    emotionalArc: string;
    strategicFocus: string;
    recommendedLength: {
      minChars: number;
      maxChars: number;
    };
  };

  // Gamma 소셜 포스트 설정
  gammaNumCards?: number; // 카드 수 (1-5)
  gammaTone?: string; // 어조
  gammaAudience?: string; // 대상 청중
  gammaDetailLevel?: string; // 세부 수준 (brief, medium, detailed, extensive)
  gammaImageSources?: string[]; // 이미지 소스 (aiGenerated, Unsplash, Giphy, none)
  gammaAdditionalInstructions?: string; // 추가 지시사항

  // 유연성 확보: 향후 추가 확장 필드를 위한 동적 속성 지원
  [key: string]: any; // 계속해서 정보를 기입할 수 있도록 동적 속성 허용
}

// 확장된 블록 형식 (전략 분석기용)
export interface ExtendedFormatBlock extends FormatBlock {
  recommendedLength?: string;
  coreStrategy?: string; // 핵심 전략 추가
  keyMoves?: string[]; // 제한 없이 배열 추가 가능
  dos?: string[]; // 제한 없이 배열 추가 가능
  donts?: string[]; // 제한 없이 배열 추가 가능
  // 유연성 확보: 향후 추가 필드를 위한 동적 속성 지원
  [key: string]: any; // 계속해서 정보를 기입할 수 있도록 동적 속성 허용
}

export interface GeneratedContent {
  id: string;
  workspaceId: string;
  channelNodeId: string;
  contentFormatNodeId: string;
  contentType: 'text' | 'image' | 'gamma';
  finalText: string;
  imageData?: string; // base64 encoded image data
  gammaUrl?: string; // Gamma 소셜 포스트 URL
  sourceTopic: string;
  createdAt: string;
}

export interface ExecutedPath {
  inputNodeId: string;
  channelNodeId: string;
  formatNodeId: string;
  edgeIds: string[];
}

export interface RunFlowResponse {
  success: boolean;
  results: GeneratedContent[];
  executedPaths?: ExecutedPath[];
  skippedPaths?: ExecutedPath[];
  error?: string;
}

// 웹 클립보드 데이터 형식
export interface ClipboardData {
  version: string;
  type: 'marketing-workspace-nodes';
  timestamp: number;
  metadata: {
    sourceWorkspace?: string;
    selectionCount: number;
  };
  nodes: ClipboardNodeData[];
  edges: ClipboardEdgeData[];
}

export interface ClipboardNodeData {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config?: NodeConfig;
    workflowId?: string;
    orderIndex?: number;
  };
  style?: {
    width?: number;
    height?: number;
    [key: string]: any;
  };
}

export interface ClipboardEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  style?: any;
}
