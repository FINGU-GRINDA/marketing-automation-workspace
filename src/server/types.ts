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
}

// 생성된 콘텐츠
export interface GeneratedContent {
  id: string;
  workspaceId: string;
  channelNodeId: string;
  contentFormatNodeId: string;
  contentType: 'text' | 'image';
  finalText: string;
  imageData?: string; // base64 encoded image data
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
