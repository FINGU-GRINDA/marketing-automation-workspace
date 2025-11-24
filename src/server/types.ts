// 노드 타입 정의
export type NodeType = "input" | "channel" | "content_format" | "search" | "content";

// 타입 별칭 정의
export type ChannelId = string;
export type TopicId = string;

// Topic 인터페이스
export interface Topic {
  id: TopicId;
  title: string;           // 게시물 제목 후보
  summary: string;         // 한 줄 요약
  sourceType: 'search' | 'manual';
  sourceNodeId?: string;   // SearchNode id (search인 경우)
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
  style?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    border?: string;
    borderRadius?: string;
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
  | ContentFormatNodeConfig
  | SearchNodeConfig
  | ContentNodeConfig;

// Input Node 설정
export interface InputNodeConfig {
  kind: "input";
  title: string;
  topic: string;
  rawData: string;
  targetLanguage?: string; // 타겟 언어 (기본값: 'ko')
  message?: string; // 추가 메시지
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
  topics: Topic[]; // 주제 아카이브
}

// Format Block (블럭 형식 구조)
export interface FormatBlock {
  id: string;
  title: string;
  description?: string;
  recommendedLength?: string;
  coreStrategy?: string;
  keyMoves?: string[];
  dos?: string[];
  donts?: string[];
  [key: string]: any; // 계속해서 정보를 기입할 수 있도록 동적 속성 허용
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
  body?: string;               // 완성된 게시물 본문 (ContentNode에 저장될 내용)
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

// Content Block 타입
export interface ContentBlock {
  id: string;
  subject: string;
  content: string;
  sources: string[];
  sourceType?: string;
  metadata?: {
    channelName?: string;
    personaTags?: string[];
    questions?: string[];
    channelType?: string;
    platforms?: string[];
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Content Node 설정
export interface ContentNodeConfig {
  kind: "content";
  title: string; // 콘텐츠 제목
  body: string; // 콘텐츠 본문
  contentType: "text" | "image" | "video" | "link" | "mixed"; // 콘텐츠 타입
  status: "draft" | "review" | "approved" | "published"; // 상태
  tags: string[]; // 태그
  contentBlocks?: ContentBlock[]; // 콘텐츠 블록 배열
  totalBlocks?: number; // 전체 블록 수
  lastUpdated?: string; // 마지막 수정 시간
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

// Content Format Node 설정
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
}

// 생성된 콘텐츠
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
