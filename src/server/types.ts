// 노드 타입 정의
export type NodeType = "input" | "channel" | "content_format";

// 워크스페이스
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

// 노드
export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    config: NodeConfig;
  };
}

// 엣지
export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// 노드 설정 (Union Type)
export type NodeConfig =
  | InputNodeConfig
  | ChannelNodeConfig
  | ContentFormatNodeConfig;

// Input Node 설정
export interface InputNodeConfig {
  kind: "input";
  title: string;
  topic: string;
  rawData: string;
}

// Channel Node 설정
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

// Content Format Node 설정
export interface ContentFormatNodeConfig {
  kind: "content_format";
  name: string;
  mappedContentType: string;
  formatBlocks: FormatBlock[]; // 블럭 형식 구조
  formatExampleText: string;
  formatStructureDescription: string; // 하위 호환성을 위해 유지
  generationPromptTemplate: string;

  // Gamma 소셜 포스트 설정
  gammaNumCards?: number; // 카드 수 (1-5)
  gammaTone?: string; // 어조
  gammaAudience?: string; // 대상 청중
  gammaDetailLevel?: string; // 세부 수준 (brief, medium, detailed, extensive)
  gammaImageSources?: string[]; // 이미지 소스 (aiGenerated, Unsplash, Giphy, none)
  gammaAdditionalInstructions?: string; // 추가 지시사항
}

// 생성된 콘텐츠
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

// 실행된 경로 정보
export interface ExecutedPath {
  inputNodeId: string;
  channelNodeId: string;
  formatNodeId: string;
  edgeIds: string[];  // 이 경로에 포함된 엣지 ID들
}

// API 응답 타입
export interface RunFlowResponse {
  success: boolean;
  results: GeneratedContent[];
  executedPaths?: ExecutedPath[];  // 실행된 경로들
  skippedPaths?: ExecutedPath[];   // AI가 거부한 경로들
  error?: string;
}
