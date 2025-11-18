import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Workspace, Node, Edge, GeneratedContent, InputNodeConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 데이터 저장 경로 (환경변수 우선)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseState {
  workspaces: Record<string, Workspace>;
  generatedContents: Record<string, GeneratedContent[]>;
}

// 인메모리 데이터베이스 (파일 기반 영구 저장 지원)
class Database {
  private workspaces: Map<string, Workspace> = new Map();
  private generatedContents: Map<string, GeneratedContent[]> = new Map();

  constructor() {
    // 데이터 디렉토리가 없으면 생성
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 파일에서 데이터 로드 또는 초기화
    this.loadFromFile();
  }

  // 워크스페이스 유효성 검증 및 복구
  private sanitizeWorkspace(workspace: any): Workspace | null {
    // 필수 필드 체크
    if (!workspace || typeof workspace.id !== 'string') {
      return null;
    }

    // 누락된 필드를 기본값으로 채움
    return {
      id: workspace.id,
      name: typeof workspace.name === 'string' ? workspace.name : `워크스페이스 ${workspace.id.substring(0, 8)}`,
      description: typeof workspace.description === 'string' ? workspace.description : '',
      nodes: Array.isArray(workspace.nodes) ? workspace.nodes : [
        {
          id: uuidv4(),
          type: 'input',
          position: { x: 100, y: 100 },
          data: {
            label: '입력 데이터',
            config: {
              kind: 'input',
              title: '시작하기',
              topic: '',
              rawData: '',
            } as InputNodeConfig,
          },
        },
      ],
      edges: Array.isArray(workspace.edges) ? workspace.edges : [],
      createdAt: workspace.createdAt || new Date().toISOString(),
      updatedAt: workspace.updatedAt || new Date().toISOString(),
    };
  }

  // 파일에서 데이터 로드
  private loadFromFile() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        const state: DatabaseState = JSON.parse(data);

        // Map으로 변환하면서 유효성 검증 및 복구
        this.workspaces = new Map();
        let repairedCount = 0;

        for (const [id, workspace] of Object.entries(state.workspaces)) {
          const sanitized = this.sanitizeWorkspace(workspace);
          if (sanitized) {
            this.workspaces.set(id, sanitized);

            // 복구가 필요했는지 체크
            if (!workspace.name || !Array.isArray(workspace.nodes) || !Array.isArray(workspace.edges)) {
              console.warn(`⚠️  손상된 워크스페이스 복구: ${id}`);
              repairedCount++;
            }
          } else {
            console.warn(`⚠️  복구 불가능한 워크스페이스: ${id}, 건너뜀`);
          }
        }

        this.generatedContents = new Map(Object.entries(state.generatedContents));

        // 복구된 워크스페이스가 있으면 즉시 저장
        if (repairedCount > 0) {
          console.log(`✓ ${repairedCount}개 워크스페이스 복구 완료, 파일 저장 중...`);
          this.saveToFile();
        }

        // 워크스페이스가 하나도 없으면 기본 생성
        if (this.workspaces.size === 0) {
          console.log('유효한 워크스페이스가 없습니다. 초기 워크스페이스를 생성합니다.');
          this.initializeDefaultWorkspace();
          this.saveToFile();
        } else {
          console.log('✓ 데이터 파일에서 로드 완료:', DB_FILE);
          console.log(`  - 워크스페이스: ${this.workspaces.size}개`);
          console.log(`  - 생성된 콘텐츠: ${this.generatedContents.size}개 그룹`);
        }
      } else {
        console.log('데이터 파일이 없습니다. 초기 워크스페이스를 생성합니다.');
        this.initializeDefaultWorkspace();
        this.saveToFile();
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      console.log('초기 워크스페이스를 생성합니다.');
      this.initializeDefaultWorkspace();
      this.saveToFile();
    }
  }

  // 파일에 데이터 저장
  private saveToFile() {
    try {
      const state: DatabaseState = {
        workspaces: Object.fromEntries(this.workspaces),
        generatedContents: Object.fromEntries(this.generatedContents),
      };

      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      console.log('✓ 데이터 파일에 저장 완료');
    } catch (error) {
      console.error('❌ 데이터 저장 실패:', error);
    }
  }

  private initializeDefaultWorkspace() {
    const workspaceId = 'default-workspace';
    const inputNodeId = uuidv4();

    const defaultWorkspace: Workspace = {
      id: workspaceId,
      name: '마케팅 자동화 워크스페이스',
      description: 'AI 기반 노드형 마케팅 콘텐츠 자동화',
      nodes: [
        {
          id: inputNodeId,
          type: 'input',
          position: { x: 100, y: 100 },
          data: {
            label: '입력 데이터',
            config: {
              kind: 'input',
              title: '시작하기',
              topic: '',
              rawData: '',
            } as InputNodeConfig,
          },
        },
      ],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workspaces.set(workspaceId, defaultWorkspace);
    this.generatedContents.set(workspaceId, []);
  }

  // 모든 워크스페이스 조회
  getAllWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  // 워크스페이스 조회
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id);
  }

  // 워크스페이스 생성
  createWorkspace(name: string, description?: string): Workspace {
    const workspaceId = uuidv4();
    const inputNodeId = uuidv4();

    const newWorkspace: Workspace = {
      id: workspaceId,
      name,
      description: description || '',
      nodes: [
        {
          id: inputNodeId,
          type: 'input',
          position: { x: 100, y: 100 },
          data: {
            label: '입력 데이터',
            config: {
              kind: 'input',
              title: '시작하기',
              topic: '',
              rawData: '',
            } as InputNodeConfig,
          },
        },
      ],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.workspaces.set(workspaceId, newWorkspace);
    this.generatedContents.set(workspaceId, []);
    this.saveToFile(); // 파일에 저장
    return newWorkspace;
  }

  // 워크스페이스 업데이트
  updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | undefined {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;

    // 기존 데이터 병합
    const updated: Workspace = {
      ...workspace,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // 필수 필드 검증 (절대 undefined가 되면 안 됨)
    if (!updated.name) {
      updated.name = workspace.name || `워크스페이스 ${id.substring(0, 8)}`;
    }
    if (!updated.description && updated.description !== '') {
      updated.description = workspace.description || '';
    }
    if (!Array.isArray(updated.nodes)) {
      updated.nodes = workspace.nodes || [];
    }
    if (!Array.isArray(updated.edges)) {
      updated.edges = workspace.edges || [];
    }

    this.workspaces.set(id, updated);
    this.saveToFile(); // 파일에 저장
    return updated;
  }

  // 워크스페이스 삭제
  deleteWorkspace(id: string): boolean {
    const deleted = this.workspaces.delete(id);
    if (deleted) {
      this.generatedContents.delete(id);
      this.saveToFile(); // 파일에 저장
    }
    return deleted;
  }

  // 노드 추가
  addNode(workspaceId: string, node: Node): Workspace | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    workspace.nodes.push(node);
    workspace.updatedAt = new Date().toISOString();

    this.workspaces.set(workspaceId, workspace);
    this.saveToFile(); // 파일에 저장
    return workspace;
  }

  // 엣지 추가
  addEdge(workspaceId: string, edge: Edge): Workspace | undefined {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return undefined;

    workspace.edges.push(edge);
    workspace.updatedAt = new Date().toISOString();

    this.workspaces.set(workspaceId, workspace);
    this.saveToFile(); // 파일에 저장
    return workspace;
  }

  // 생성된 콘텐츠 저장
  saveGeneratedContent(content: GeneratedContent): void {
    const contents = this.generatedContents.get(content.workspaceId) || [];
    contents.push(content);
    this.generatedContents.set(content.workspaceId, contents);
    this.saveToFile(); // 파일에 저장
  }

  // 생성된 콘텐츠 조회
  getGeneratedContents(workspaceId: string): GeneratedContent[] {
    return this.generatedContents.get(workspaceId) || [];
  }

  // 생성된 콘텐츠 초기화
  clearGeneratedContents(workspaceId: string): void {
    this.generatedContents.set(workspaceId, []);
    this.saveToFile(); // 파일에 저장
  }
}

export const db = new Database();
