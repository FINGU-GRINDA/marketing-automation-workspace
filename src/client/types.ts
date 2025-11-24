// 서버 타입과 동일하게 유지
export type NodeType = "input" | "channel" | "content_format" | "search" | "content" | "canvas_box";

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
  | ContentFormatNodeConfig
  | SearchNodeConfig
  | ContentNodeConfig;

// 타입 별칭 정의
export type ChannelId = string;
export type TopicId = string;

// Topic 인터페이스
export interface Topic {
  id: TopicId;
  title: string;           // 게시물 제목 후보
  summary: string;         // 한 줄 요약
  sourceType: 'reddit_search' | 'manual';
  sourceNodeId?: string;   // RedditSearchNode id (reddit_search인 경우)
  createdAt: string;       // ISO 문자열
  tags: string[];          // 예: ['AI세일즈', '제조업', '전략']
  meta: {
    redditLinks?: string[];    // 관련 Reddit URL들
    insights?: string[];       // 핵심 인사이트 문장들
    basedQuestions?: string[]; // 생성 시 사용한 질문들
  };
}

// Reddit 서치 관련 타입들
export interface RedditQuestion {
  id: string;
  question: string;
}

export interface RedditThreadSummary {
  title: string;
  url: string;
  summary: string;            // 스레드 전체 요약
  topCommentSummary: string;  // 상위 댓글 공통 의견 요약
}

export interface RedditInsight {
  questionId: string;             // 어떤 질문에서 나온 인사이트인지
  queryUsed: string;
  threads: RedditThreadSummary[];
  keyTakeaways: string[];         // 핵심 인사이트 문장들
}

export interface RedditTopicSuggestion {
  id: string;
  title: string;
  oneLineSummary: string;
  basedOnQuestions: string[];     // questionId 목록
  basedOnThreads: string[];       // thread title 또는 url 일부
  mainInsights: string[];         // 핵심 인사이트 문장들
  redditLinks: string[];          // URL들
  tags: string[];                 // 태그 (선택)
}

export interface RedditSearchResult {
  questions: RedditQuestion[];
  reddit_insights: RedditInsight[];
  topics: RedditTopicSuggestion[];
}

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
  topics: Topic[]; // 주제 아카이브
}

// Format Block (블럭 형식 구조)
export interface FormatBlock {
  id: string;
  title: string;
  description?: string;
}

// Search Node 설정
export interface SearchNodeConfig {
  kind: "search";
  query: string; // 검색 쿼리
  channels: string[]; // 타겟 채널 목록 (reddit, twitter, linkedin, facebook, instagram 등)
  timeFilter: "day" | "week" | "month" | "year" | "all"; // 시간 필터
  sortFilter: "hot" | "new" | "top" | "rising"; // 정렬 방식
  maxResults: number; // 최대 결과 수
  searchType: "title" | "content" | "both"; // 검색 타입
  lastExecutedAt?: string; // 마지막 실행 시간
  searchResult?: RedditSearchResult; // 저장된 검색 결과 (기존 호환성)
  searchNodeResult?: SearchNodeResult; // 새로운 서치 노드 결과
}

// 서치 노드 관련 데이터 모델
export interface SearchQuestion {
  id: string;
  question: string;
}

export interface SearchThreadSummary {
  title: string;
  url: string;
  summary: string;            // 스레드/문서 전체 요약
  topCommentSummary: string;  // 상위 댓글 또는 반응들의 공통 의견 요약
}

export interface SearchInsight {
  questionId: string;          // 어떤 질문에서 파생된 인사이트인지
  queryUsed: string;
  threads: SearchThreadSummary[];
  keyTakeaways: string[];      // 핵심 인사이트 문장들
}

export interface SearchTopicCandidate {
  id: string;
  title: string;               // 게시물 제목 후보
  oneLineSummary: string;      // 한 줄 요약
  basedOnQuestions: string[];  // 관련 질문 id 리스트
  basedOnThreads: string[];    // 참조한 스레드 제목 또는 URL
  mainInsights: string[];      // 핵심 인사이트 문장들
  links: string[];             // 관련 링크(URL) 리스트
  tags: string[];              // 태그(선택)
}

export interface SearchNodeResult {
  questions: SearchQuestion[];
  insights: SearchInsight[];
  topicCandidates: SearchTopicCandidate[];
}

// 수집된 콘텐츠 블록 데이터
export interface ContentBlock {
  id: string;
  subject: string; // 주제
  content: string; // 상세 내용
  sources: string[]; // 출처 링크
  sourceType: "ai_search" | "manual" | "import"; // 출처 타입
  createdAt: string; // 추가 날짜
  searchNodeId?: string; // 서치 노드 ID (ai_search인 경우)
  metadata?: {
    channelName?: string; // 채널명
    personaTags?: string[]; // 관련 페르소나 태그
    questions?: string[]; // 관련 질문들
    insights?: string[]; // 핵심 인사이트들
    tags?: string[]; // 콘텐츠 태그
  };
}

// Content Node 설정 (개선 버전)
export interface ContentNodeConfig {
  kind: "content";
  title: string; // 콘텐츠 제목
  body?: string; // 콘텐츠 본문 (기존 호환성)
  contentType: "text" | "image" | "video" | "link" | "mixed" | "collection"; // 콘텐츠 타입
  status: "draft" | "collected" | "review" | "approved" | "published"; // 상태
  tags: string[]; // 태그

  // 새로운 수집된 콘텐츠 저장 구조
  contentBlocks?: ContentBlock[]; // 수집된 콘텐츠 블록들
  lastUpdated?: string; // 마지막 업데이트 시간
  totalBlocks?: number; // 총 블록 수

  // 기존 호환성 필드들
  searchData?: any[]; // 기존 searchData 호환성
  metadata?: {
    wordCount?: number; // 글자 수
    estimatedReadTime?: number; // 예상 읽기 시간 (분)
    priority?: "low" | "medium" | "high"; // 우선순위
    publishAt?: string; // 예약 발행 시간
    [key: string]: any; // 추가 메타데이터
  };
  createdAt?: string; // 생성 시간
  updatedAt?: string; // 수정 시간
}

export interface ContentFormatNodeConfig {
  kind: "content_format";
  name: string;
  mappedContentType: string;
  targetLanguage?: string; // 타겟 언어 (기본값: 'ko')
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
  originalText?: string; // 번역 전 원본 텍스트
  detectedLanguage?: string; // 감지된 원본 언어
  isTranslated?: boolean; // 번역 여부
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
