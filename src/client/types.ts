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

export interface ContentFormatNodeConfig {
  kind: "content_format";
  name: string;
  mappedContentType: string;
  formatExampleText: string;
  formatStructureDescription: string;
  generationPromptTemplate: string;
}

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
