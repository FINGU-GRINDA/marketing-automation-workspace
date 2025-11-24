import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle, createContext, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  ControlButton,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import type { Workspace, Node as CustomNode, InputNodeConfig, ChannelNodeConfig, ContentFormatNodeConfig, SearchNodeConfig, ContentNodeConfig, ExecutedPath, ClipboardData, ClipboardNodeData, ClipboardEdgeData } from '../types';
import InputNode from './nodes/InputNode';
import ChannelNode from './nodes/ChannelNode';
import ContentFormatNode from './nodes/ContentFormatNode';
import ContentNode from './nodes/ContentNode';
import CanvasBoxNode from './nodes/CanvasBoxNode';
import SearchNode, { SearchSelectionContext } from './nodes/SearchNode';
import CustomEdge from './edges/CustomEdge';

// Context for node actions (duplicate, add next node, etc.)
export const NodeActionsContext = createContext<{
  duplicateNode: (nodeId: string, position: 'top' | 'bottom') => void;
  toggleFormatSelection: (nodeId: string) => void;
  addNextNode: (nodeId: string, nodeType: string) => void;
} | null>(null);



const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

export interface CanvasHandle {
  autoLayout: () => void;
  executeCheckedSearchNodes: () => void;
}

interface CanvasProps {
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  selectedNode: CustomNode | null;
  setSelectedNode: (node: CustomNode | null) => void;
  executedPaths?: ExecutedPath[];
  skippedPaths?: ExecutedPath[];
}

function CanvasInnerFunction(props: any, ref: any) {
  const { workspace, setWorkspace, selectedNode, setSelectedNode, executedPaths = [], skippedPaths = [] } = props;

  // workspaceId를 전역적으로 설정 (ContentNode에서 API 호출 시 사용)
  useEffect(() => {
    (window as any).currentWorkspaceId = workspace.id;
    return () => {
      // 컴포넌트 언마운트 시 정리
      (window as any).currentWorkspaceId = null;
    };
  }, [workspace.id]);
    const [nodes, setNodes, onNodesChange] = useNodesState(workspace.nodes);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState(workspace.edges);
    const [copiedNode, setCopiedNode] = useState<CustomNode | null>(null);
    const [copiedMultiNodes, setCopiedMultiNodes] = useState<CustomNode[] | null>(null);
    const [copiedMultiEdges, setCopiedMultiEdges] = useState<any[] | null>(null);
    const [selectedSearchNodes, setSelectedSearchNodes] = useState<Set<string>>(new Set());
    const [executingSearchNodes, setExecutingSearchNodes] = useState<Set<string>>(new Set()); // 서치 실행 상태 추적
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { setViewport, getViewport } = useReactFlow();
    const workspaceRef = useRef(workspace);

    
    // 엣지 변경 핸들러 (useEffect가 자동 동기화를 처리하므로 단순화)
    const onEdgesChange = useCallback(
      (changes: any[]) => {
        onEdgesChangeBase(changes);
      },
      [onEdgesChangeBase]
    );

    // workspace가 변경될 때마다 ref 업데이트
    useEffect(() => {
      workspaceRef.current = workspace;
    }, [workspace]);

    // edges가 변경될 때마다 채널의 콘텐츠 태그를 연결된 포맷 노드와 자동 동기화
    useEffect(() => {
      setNodes((currentNodes) => {
        let hasChanges = false;
        const updatedNodes = currentNodes.map((node) => {
          if (node.type === 'channel') {
            const channelConfig = node.data.config as ChannelNodeConfig;

            // 이 채널에서 포맷 노드로 연결된 엣지 찾기
            const connectedFormatNames = edges
              .filter((e) => e.source === node.id)
              .map((e) => {
                const targetNode = currentNodes.find((n) => n.id === e.target);
                if (targetNode?.type === 'content_format') {
                  return (targetNode.data.config as ContentFormatNodeConfig).name;
                }
                return null;
              })
              .filter((name): name is string => name !== null);

            // 현재 태그와 연결된 포맷 노드 이름이 다르면 동기화
            const currentTags = channelConfig.highLevelContentTags || [];
            const sortedCurrent = [...currentTags].sort();
            const sortedConnected = [...connectedFormatNames].sort();

            const tagsChanged =
              sortedCurrent.length !== sortedConnected.length ||
              !sortedCurrent.every((tag, idx) => tag === sortedConnected[idx]);

            if (tagsChanged) {
              hasChanges = true;
              console.log(
                `✓ 채널 "${channelConfig.name}" 콘텐츠 태그 동기화: [${currentTags.join(', ')}] → [${connectedFormatNames.join(', ')}]`
              );

              return {
                ...node,
                data: {
                  ...node.data,
                  config: {
                    ...channelConfig,
                    highLevelContentTags: connectedFormatNames,
                  },
                },
              };
            }
          }
          return node;
        });

        return hasChanges ? updatedNodes : currentNodes;
      });
    }, [edges, setNodes]);

  // 엣지 삭제 핸들러
  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      console.log('✓ 연결 삭제됨:', edgeId);
    },
    [setEdges]
  );

  // 모든 엣지가 onDelete 함수를 갖도록 업데이트
  useEffect(() => {
    setEdges((currentEdges) => {
      return currentEdges.map((edge) => {
        if (!edge.data || !edge.data.onDelete) {
          return {
            ...edge,
            type: 'custom',
            data: { onDelete: handleEdgeDelete },
          };
        }
        return edge;
      });
    });
  }, [setEdges, handleEdgeDelete]);

  // workspace 변경 감지 및 동기화 (외부 변경만 반영)
  const prevWorkspaceIdRef = useRef(workspace.id);
  const prevNodesRef = useRef(JSON.stringify(workspace.nodes));
  const prevEdgesRef = useRef(JSON.stringify(workspace.edges));
  const isInternalUpdateRef = useRef(false);

  useEffect(() => {
    // 내부 업데이트로 인한 변경은 무시
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const workspaceIdChanged = workspace.id !== prevWorkspaceIdRef.current;
    const nodesJson = JSON.stringify(workspace.nodes);
    const edgesJson = JSON.stringify(workspace.edges);
    const nodesChanged = nodesJson !== prevNodesRef.current;
    const edgesChanged = edgesJson !== prevEdgesRef.current;

    // 워크스페이스가 변경되었거나, 노드/엣지가 외부에서 변경된 경우
    if (workspaceIdChanged || nodesChanged || edgesChanged) {
      prevWorkspaceIdRef.current = workspace.id;
      prevNodesRef.current = nodesJson;
      prevEdgesRef.current = edgesJson;

      // 노드가 변경되었으면 업데이트
      if (workspaceIdChanged || nodesChanged) {
        setNodes(workspace.nodes);
      }

      // 엣지가 변경되었으면 업데이트
      if (workspaceIdChanged || edgesChanged) {
        const edgesWithData = workspace.edges.map((edge) => ({
          ...edge,
          type: 'custom',
          data: { onDelete: handleEdgeDelete },
        }));
        setEdges(edgesWithData);
      }
    }
  }, [workspace.id, workspace.nodes, workspace.edges, setNodes, setEdges, handleEdgeDelete]);

  // nodes/edges가 변경될 때 workspace 업데이트 (디바운싱 적용)
  useEffect(() => {
    // 실제로 변경된 경우에만 업데이트
    const currentWorkspace = workspaceRef.current;
    
    // 노드 변경 감지: position만 변경된 경우는 제외
    const nodesChanged = nodes.length !== currentWorkspace.nodes.length ||
      nodes.some((node, idx) => {
        const oldNode = currentWorkspace.nodes.find(n => n.id === node.id);
        if (!oldNode) return true;
        // position만 변경된 경우는 제외 (드래그로 인한 위치 변경)
        const positionOnly = JSON.stringify({ ...node, position: oldNode.position }) === JSON.stringify(oldNode);
        return !positionOnly;
      });
    
    const edgesChanged = JSON.stringify(currentWorkspace.edges) !== JSON.stringify(edges);

    if (nodesChanged || edgesChanged) {
      // 디바운싱: 노드 드래그 중 과도한 업데이트 방지
      const timeoutId = setTimeout(() => {
        // 내부 업데이트 플래그 설정하여 무한 루프 방지
        isInternalUpdateRef.current = true;
        // position 변경도 포함하여 최종 저장
        setWorkspace({ ...currentWorkspace, nodes, edges });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges, setWorkspace]);

  // selectedNode 동기화 - nodes가 변경되면 selectedNode도 업데이트
  useEffect(() => {
    if (selectedNode) {
      const updatedNode = nodes.find((n) => n.id === selectedNode.id);
      if (updatedNode) {
        // 노드가 여전히 존재하면 최신 버전으로 업데이트
        if (JSON.stringify(updatedNode) !== JSON.stringify(selectedNode)) {
          setSelectedNode(updatedNode);
        }
      } else {
        // 노드가 삭제되었으면 선택 해제
        setSelectedNode(null);
      }
    }
  }, [nodes]);

  // 실행 중인 경로 표시 (점선)
  useEffect(() => {
    if (executedPaths.length === 0) {
      // 실행 중인 경로가 없으면 모든 엣지를 원래 상태로 복원
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          style: {
            ...edge.style,
            strokeDasharray: undefined,
            stroke: undefined,
            strokeWidth: undefined,
          },
          animated: false,
        }))
      );
      return;
    }

    // 실행 중인 엣지 ID 수집
    const executingEdgeIds = new Set<string>();
    executedPaths.forEach((path) => {
      path.edgeIds.forEach((edgeId) => executingEdgeIds.add(edgeId));
    });

    // 엣지 스타일 업데이트 (점선으로 표시)
    setEdges((eds) =>
      eds.map((edge) => {
        if (executingEdgeIds.has(edge.id)) {
          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: '#3b82f6', // blue-500 (실행 중)
              strokeWidth: 3,
              strokeDasharray: '8, 8', // 점선
            },
            animated: true,
          };
        }
        // 실행 중이 아닌 엣지는 원래 상태 유지
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeDasharray: undefined,
            stroke: undefined,
            strokeWidth: undefined,
          },
          animated: false,
        };
      })
    );
  }, [executedPaths, setEdges]);

  // 서치 노드 실행 중 엣지 애니메이션 표시
  useEffect(() => {
    if (executingSearchNodes.size === 0) {
      // 실행 중인 서치 노드가 없으면 엣지 스타일 업데이트 하지 않음 (executedPaths가 처리)
      return;
    }

    // 실행 중인 서치 노드와 관련된 엣지 찾기
    const currentWorkspace = workspaceRef.current;
    const executingEdgeIds = new Set<string>();

    executingSearchNodes.forEach((searchNodeId) => {
      // 서치 노드와 연결된 엣지 찾기
      const searchNode = currentWorkspace.nodes.find((n) => n.id === searchNodeId && n.type === 'search');
      if (searchNode) {
        // 입력 → 채널 → 서치 경로의 엣지 ID들 찾기
        const channelToSearchEdges = currentWorkspace.edges.filter((e) => e.target === searchNodeId);
        channelToSearchEdges.forEach((edge) => {
          executingEdgeIds.add(edge.id); // 채널 → 서치 엣지

          // 채널로 들어오는 엣지 찾기 (입력 → 채널)
          const channelNodeId = edge.source;
          const inputToChannelEdges = currentWorkspace.edges.filter((e) => e.target === channelNodeId);
          inputToChannelEdges.forEach((inputEdge) => {
            executingEdgeIds.add(inputEdge.id); // 입력 → 채널 엣지
          });
        });

        // 서치 → 콘텐츠 엣지 찾기
        const searchToContentEdges = currentWorkspace.edges.filter((e) => e.source === searchNodeId);
        searchToContentEdges.forEach((edge) => {
          executingEdgeIds.add(edge.id); // 서치 → 콘텐츠 엣지
        });
      }
    });

    // 엣지 스타일 업데이트 (서치 실행 중: 오렌지 점선)
    setEdges((eds) =>
      eds.map((edge) => {
        if (executingEdgeIds.has(edge.id)) {
          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: '#f97316', // orange-500 (서치 실행 중)
              strokeWidth: 3,
              strokeDasharray: '5, 5', // 점선
            },
            animated: true,
          };
        }
        // 실행 중이 아닌 엣지는 그대로 둠
        return edge;
      })
    );
  }, [executingSearchNodes, setEdges]);

  // Shift + 휠로 좌우 이동
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
        const viewport = getViewport();
        const delta = event.deltaY;

        setViewport({
          x: viewport.x - delta,
          y: viewport.y,
          zoom: viewport.zoom,
        });
      }
    };

    const flowElement = reactFlowWrapper.current;
    if (flowElement) {
      flowElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (flowElement) {
        flowElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [getViewport, setViewport]);

  // 키보드 이벤트 - 복사/붙여넣기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // input/textarea/select에서는 기본 동작 유지
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.tagName === 'SELECT' ||
                          target.isContentEditable;

      if (isInputField) {
        return; // 텍스트 입력 중에는 노드 복사/붙여넣기 안 함
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + C: 복사 (단일/다중 선택 자동 감지)
      if (cmdOrCtrl && event.key === 'c') {
        event.preventDefault();

        const currentlySelectedNodes = nodes.filter(n => n.selected);

        if (currentlySelectedNodes.length > 1) {
          // 다중 선택 복사
          try {
            const selectedNodeIds = new Set(currentlySelectedNodes.map(n => n.id));
            const selectedEdges = edges.filter(e =>
              selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
            );

            setCopiedMultiNodes(currentlySelectedNodes);
            setCopiedMultiEdges(selectedEdges);

            // 단일 선택 클립보드 초기화
            setCopiedNode(null);

            console.log(`✓ ${currentlySelectedNodes.length}개 노드 다중 선택 복사됨`);
          } catch (error) {
            console.error('다중 선택 복사 실패:', error);
          }
        } else if (selectedNode) {
          // 단일 선택 복사 (기존 로직 유지)
          try {
            const nodeCopy = JSON.parse(JSON.stringify(selectedNode));
            setCopiedNode(nodeCopy);

            // 다중 선택 클립보드 초기화
            setCopiedMultiNodes(null);
            setCopiedMultiEdges(null);

            console.log('✓ 단일 노드 복사됨:', selectedNode.data.label);
          } catch (error) {
            console.error('단일 선택 복사 실패:', error);
          }
        } else {
          console.log('복사할 노드가 선택되지 않았습니다');
        }
      }

      // Cmd/Ctrl + V: 붙여넣기 (명확한 우선순위: 단일 > 다중)
      if (cmdOrCtrl && event.key === 'v') {
        event.preventDefault();

        // **중요**: 단일 선택 데이터를 우선적으로 확인
        if (copiedNode) {
          // 단일 선택 붙여넣기
          try {
            const newNode: CustomNode = JSON.parse(JSON.stringify(copiedNode));
            newNode.id = uuidv4();
            newNode.position = {
              x: copiedNode.position.x + 50,
              y: copiedNode.position.y + 50,
            };

            setNodes((nds) => [...nds, newNode]);
            console.log('✓ 단일 노드 붙여넣기 완료:', newNode.data.label);
          } catch (error) {
            console.error('단일 노드 붙여넣기 실패:', error);
          }
        } else if (copiedMultiNodes && copiedMultiNodes.length > 0) {
          // 다중 선택 붙여넣기
          try {
            const idMap = new Map<string, string>();
            const newNodes = copiedMultiNodes.map(node => {
              const newId = uuidv4();
              idMap.set(node.id, newId);

              return {
                ...node,
                id: newId,
                position: {
                  x: node.position.x + 200,
                  y: node.position.y + 50
                },
                selected: false
              };
            });

            // Update edge connections
            const newEdges = copiedMultiEdges?.map(edge => ({
              ...edge,
              id: uuidv4(),
              source: idMap.get(edge.source) || edge.source,
              target: idMap.get(edge.target) || edge.target
            })) || [];

            // Add duplicated nodes and edges
            setNodes(currentNodes => [...currentNodes, ...newNodes]);
            setEdges(currentEdges => [...currentEdges, ...newEdges]);

            console.log(`✓ ${newNodes.length}개 노드 다중 선택 붙여넣기 완료`);
          } catch (error) {
            console.error('다중 선택 붙여넣기 실패:', error);
          }
        } else {
          console.log('붙여넣을 데이터가 없습니다');
        }
      }

      // Cmd/Ctrl + D: 빠른 복제 (단일/다중 선택 자동 감지)
      if (cmdOrCtrl && event.key === 'd') {
        event.preventDefault();

        const currentlySelectedNodes = nodes.filter(n => n.selected);

        if (currentlySelectedNodes.length > 1) {
          // 다중 선택 복제
          try {
            const selectedNodeIds = new Set(currentlySelectedNodes.map(n => n.id));
            const selectedEdges = edges.filter(e =>
              selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
            );

            const idMap = new Map<string, string>();
            const newNodes = currentlySelectedNodes.map(node => {
              const newId = uuidv4();
              idMap.set(node.id, newId);

              return {
                ...node,
                id: newId,
                position: {
                  x: node.position.x + 200,
                  y: node.position.y + 50
                },
                selected: false
              };
            });

            // Update edge connections
            const newEdges = selectedEdges.map(edge => ({
              ...edge,
              id: uuidv4(),
              source: idMap.get(edge.source) || edge.source,
              target: idMap.get(edge.target) || edge.target
            }));

            // Add duplicated nodes and edges
            setNodes(currentNodes => [...currentNodes, ...newNodes]);
            setEdges(currentEdges => [...currentEdges, ...newEdges]);

            console.log(`✓ ${newNodes.length}개 노드 다중 선택 복제 완료`);
          } catch (error) {
            console.error('다중 선택 복제 실패:', error);
          }
        } else if (selectedNode) {
          // 단일 선택 복제 (기존 로직 유지)
          try {
            const newNode: CustomNode = JSON.parse(JSON.stringify(selectedNode));
            newNode.id = uuidv4();
            newNode.position = {
              x: selectedNode.position.x + 50,
              y: selectedNode.position.y + 50,
            };

            setNodes((nds) => [...nds, newNode]);
            console.log('✓ 단일 노드 복제 완료:', newNode.data.label);
          } catch (error) {
            console.error('단일 노드 복제 실패:', error);
          }
        } else {
          console.log('복제할 노드가 선택되지 않았습니다');
        }
      }

      // Delete/Backspace: 선택된 모든 노드 삭제
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 선택된 노드들 찾기
        const selectedNodes = nodes.filter((n) => n.selected);

        if (selectedNodes.length > 0) {
          event.preventDefault();
          try {
            const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

            // 선택된 노드들 제거
            setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));

            // 선택된 노드들과 연결된 엣지들 제거
            setEdges((eds) => eds.filter((e) =>
              !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
            ));

            setSelectedNode(null);
            console.log(`✓ ${selectedNodes.length}개 노드 삭제됨:`, selectedNodes.map((n) => n.data.label).join(', '));
          } catch (error) {
            console.error('삭제 실패:', error);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNode, copiedNode, copiedMultiNodes, copiedMultiEdges, setNodes, setEdges, setSelectedNode]);

  // 초기 데이터 마이그레이션: content_format 노드에 selected 속성 추가
  useEffect(() => {
    const needsMigration = workspace.nodes.some(node =>
      node.type === 'content_format' && node.data.selected === undefined
    );

    if (needsMigration) {
      console.log('🟣 Migrating content_format nodes to add selected property');

      const migratedNodes = workspace.nodes.map(node => {
        if (node.type === 'content_format' && node.data.selected === undefined) {
          console.log('🟣 Adding selected=false to node:', node.data.label);
          return {
            ...node,
            data: {
              ...node.data,
              selected: false
            }
          };
        }
        return node;
      });

      // 내부 업데이트 플래그 설정
      isInternalUpdateRef.current = true;

      setWorkspace(prev => ({
        ...prev,
        nodes: migratedNodes
      }));

      setNodes(migratedNodes);
    }
  }, [workspace.nodes, setWorkspace, setNodes]);

  // 엣지 연결 (useEffect가 자동 동기화를 처리하므로 단순화)
  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        id: uuidv4(),
        source: connection.source!,
        target: connection.target!,
        type: 'custom',
        data: { onDelete: handleEdgeDelete },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, handleEdgeDelete]
  );

  // 노드 선택
  const onNodeClick = useCallback(
    (_event: any, node: any) => {
      console.log('🔥 onNodeClick called - node:', node);
      console.log('🔥 onNodeClick - node.id:', node.id);
      console.log('🔥 onNodeClick - node.type:', node.type);
      console.log('🔥 onNodeClick - available nodes:', nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label })));

      const customNode = nodes.find((n) => n.id === node.id) as CustomNode;
      console.log('🔥 onNodeClick - found customNode:', customNode);
      console.log('🔥 onNodeClick - setting selectedNode to:', customNode || null);

      setSelectedNode(customNode || null);
    },
    [nodes, setSelectedNode]
  );

  // 노드 추가 (툴바 버튼용)
  const addNode = (type: 'input' | 'channel' | 'content_format' | 'search' | 'content') => {
    const id = uuidv4();
    let config: InputNodeConfig | ChannelNodeConfig | ContentFormatNodeConfig | SearchNodeConfig | ContentNodeConfig;
    let label = '';

    if (type === 'input') {
      config = {
        kind: 'input',
        title: '새 입력',
        topic: '',
        rawData: '',
      };
      label = '입력 데이터';
    } else if (type === 'channel') {
      config = {
        kind: 'channel',
        name: '새 채널',
        channelType: 'linkedin',
        personaTags: [],
        toneTags: [],
        highLevelContentTags: [],
        channelKnowledge: '',
        toneMannerExample: '',
        prohibitedTypes: [],
        topics: [],
      };
      label = '채널';
    } else if (type === 'search') {
      config = {
        kind: 'search',
        query: '',
        channels: ['reddit', 'twitter', 'linkedin'],
        timeFilter: 'week',
        sortFilter: 'hot',
        maxResults: 20,
        searchType: 'both',
      };
      label = '서치';
    } else if (type === 'content') {
      config = {
        kind: 'content',
        title: '새 콘텐츠',
        body: '',
        contentType: 'text',
        status: 'draft',
        tags: [],
        metadata: {
          wordCount: 0,
          estimatedReadTime: 1,
          priority: 'medium',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      label = '콘텐츠';
    } else {
      config = {
        kind: 'content_format',
        name: '새 포맷',
        mappedContentType: '',
        formatExampleText: '',
        formatStructureDescription: '',
        generationPromptTemplate: '',
      };
      label = '콘텐츠 포맷';
    }

    const newNode: CustomNode = {
      id,
      type,
      position: { x: 250, y: 250 },
      data: {
        label,
        config,
        selected: false, // 모든 노드에 기본 selected 속성 추가
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // 자동 정렬 (빗자루 버전) - 트리 구조 기반 수평 중앙정렬
  const autoLayout = useCallback(() => {
    const COLUMN_WIDTH = 280; // 열 간격
    const ROW_HEIGHT = 120; // 행 간격
    const START_X = 100; // 시작 X 위치
    const MARGIN = 60; // 노드 그룹 간 수직 마진

    // 노드를 타입별로 분류
    const inputNodes = nodes.filter((n) => n.type === 'input');
    const channelNodes = nodes.filter((n) => n.type === 'channel');
    const searchNodes = nodes.filter((n) => n.type === 'search');
    const contentNodes = nodes.filter((n) => n.type === 'content');
    const formatNodes = nodes.filter((n) => n.type === 'content_format');

    const updatedNodes: CustomNode[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();
    const processedNodes = new Set<string>();

    // 간단한 자식 찾기 함수
    const getChildren = (nodeId: string, targetType: string): CustomNode[] => {
      return edges
        .filter((e) => e.source === nodeId)
        .map((e) => {
          if (targetType === 'channel') return channelNodes.find((n) => n.id === e.target);
          if (targetType === 'search') return searchNodes.find((n) => n.id === e.target);
          if (targetType === 'content') return contentNodes.find((n) => n.id === e.target);
          if (targetType === 'format') return formatNodes.find((n) => n.id === e.target);
          return null;
        })
        .filter((n): n is CustomNode => n !== undefined);
    };

    // 입력 노드를 기준으로 전체 트리布局
    let currentY = MARGIN;

    inputNodes.forEach(inputNode => {
      // 입력 노드 배치 (column 0)
      const inputY = currentY;
      nodePositions.set(inputNode.id, { x: START_X, y: inputY });
      processedNodes.add(inputNode.id);

      // 하위 자식들 찾기
      const channelChildren = getChildren(inputNode.id, 'channel');
      const searchChildren = getChildren(inputNode.id, 'search');
      const allChildren = [...channelChildren, ...searchChildren];

      if (allChildren.length === 0) {
        currentY += ROW_HEIGHT + MARGIN;
        return;
      }

      // 입력 노드 기준으로 모든 하위 노드들의 정확한 중앙정렬 시스템
      const allChildrenCount = channelChildren.length + searchChildren.length;
      if (allChildrenCount > 0) {
        // 1단계: 입력 노드 중심에 2단계 노드들(채널/서치) 그룹 중앙정렬
        const totalGroupHeight = allChildrenCount * ROW_HEIGHT + (allChildrenCount - 1) * MARGIN;
        // 입력 노드의 Y값이 채널/서치 노드들의 중앙값과 일치하도록 계산
        // 채널 노드들의 첫번째 노드 시작 위치 = 입력 노드 Y - (전체 그룹 높이 - ROW_HEIGHT) / 2
        const groupStartY = inputY - (totalGroupHeight - ROW_HEIGHT) / 2;

        // 2단계 노드들의 위치를 저장하고 하위 노드들을 그룹화
        const level2NodeGroups: Array<{
          nodes: Array<{ id: string; y: number; type: string }>;
          searchNodes: Array<{ id: string; y: number; type: string }>;
          contentNodes: any[];
          formatNodes: any[];
        }> = [];

        // 채널 자식들 처리 (채널 → 서치 → 콘텐츠 → 포맷 구조)
        channelChildren.forEach((channelChild, index) => {
          const channelY = groupStartY + index * (ROW_HEIGHT + MARGIN);
          nodePositions.set(channelChild.id, { x: START_X + COLUMN_WIDTH, y: channelY });
          processedNodes.add(channelChild.id);

          // 이 채널 노드에 연결된 서치 자식들 찾기
          const searchChildrenOfChannel = getChildren(channelChild.id, 'search');
          const allContentChildren = [];
          let searchNodesOfChannel = [];

          // 채널에 연결된 서치 노드들 처리
          if (searchChildrenOfChannel.length > 0) {
            const searchTotalHeight = searchChildrenOfChannel.length * ROW_HEIGHT + (searchChildrenOfChannel.length - 1) * MARGIN;
            // 채널 노드의 Y값이 서치 노드들의 중앙값과 일치하도록 계산
            const searchStartY = channelY - (searchTotalHeight - ROW_HEIGHT) / 2;

            searchChildrenOfChannel.forEach((searchChild, searchIndex) => {
              const searchY = searchStartY + searchIndex * (ROW_HEIGHT + MARGIN);
              nodePositions.set(searchChild.id, { x: START_X + COLUMN_WIDTH * 2, y: searchY });
              processedNodes.add(searchChild.id);

              // 이 서치 노드의 콘텐츠 자식들 찾기
              const contentChildrenOfSearch = getChildren(searchChild.id, 'content');
              contentChildrenOfSearch.forEach(contentChild => {
                const formatChildren = getChildren(contentChild.id, 'format');
                allContentChildren.push({ content: contentChild, formats: formatChildren, parentSearchY: searchY });
              });

              searchNodesOfChannel.push({ id: searchChild.id, y: searchY, type: 'search' });
            });
          } else {
            // 채널에 직접 연결된 서치 노드가 없는 경우, 채널에 직접 연결된 콘텐츠들 처리
            const contentChildrenOfChannel = getChildren(channelChild.id, 'content');
            contentChildrenOfChannel.forEach(contentChild => {
              const formatChildren = getChildren(contentChild.id, 'format');
              allContentChildren.push({ content: contentChild, formats: formatChildren, parentSearchY: null });
            });
          }

          level2NodeGroups.push({
            nodes: [{ id: channelChild.id, y: channelY, type: 'channel' }],
            searchNodes: searchNodesOfChannel,
            contentNodes: allContentChildren,
            formatNodes: []
          });
        });

        // 입력 노드에 직접 연결된 서치 자식들 처리 (채널을 거치지 않은 서치들)
        const directSearchChildren = searchChildren.filter(searchChild =>
          !channelChildren.some(channelChild =>
            getChildren(channelChild.id, 'search').some(channelSearch => channelSearch.id === searchChild.id)
          )
        );

        directSearchChildren.forEach((searchChild, index) => {
          const searchY = groupStartY + (channelChildren.length + index) * (ROW_HEIGHT + MARGIN);
          nodePositions.set(searchChild.id, { x: START_X + COLUMN_WIDTH * 2, y: searchY });
          processedNodes.add(searchChild.id);

          // 이 서치 노드의 콘텐츠 자식들 찾기
          const contentChildrenOfSearch = getChildren(searchChild.id, 'content');
          const allContentChildren = [];

          contentChildrenOfSearch.forEach(contentChild => {
            const formatChildren = getChildren(contentChild.id, 'format');
            allContentChildren.push({ content: contentChild, formats: formatChildren, parentSearchY: searchY });
          });

          level2NodeGroups.push({
            nodes: [{ id: searchChild.id, y: searchY, type: 'search' }],
            searchNodes: [],
            contentNodes: allContentChildren,
            formatNodes: []
          });
        });

        // 2단계: 3단계 노드들(콘텐츠) 중앙정렬 - 각 부모 노드별로 그룹화하여 처리
        level2NodeGroups.forEach(group => {
          // 콘텐츠 노드들을 부모 노드별로 그룹화
          const contentGroups = new Map<string, any[]>();

          group.contentNodes.forEach(nodeData => {
            const parentKey = nodeData.parentSearchY || `channel_${group.nodes[0].id}`;
            if (!contentGroups.has(parentKey)) {
              contentGroups.set(parentKey, []);
            }
            contentGroups.get(parentKey)!.push(nodeData);
          });

          // 각 부모 노드별로 콘텐츠 노드들 정렬
          contentGroups.forEach((contentDataList, parentKey) => {
            if (contentDataList.length > 0) {
              const contentTotalHeight = contentDataList.length * ROW_HEIGHT + (contentDataList.length - 1) * MARGIN;

              // 부모 노드의 Y값 찾기
              let parentNodeY: number;
              if (typeof parentKey === 'number') {
                // 서치 노드의 Y값
                parentNodeY = parentKey;
              } else {
                // 채널 노드의 Y값
                parentNodeY = group.nodes[0].y;
              }

              // 부모 노드의 Y값이 콘텐츠 노드들의 중앙값과 일치하도록 계산
              const contentStartY = parentNodeY - (contentTotalHeight - ROW_HEIGHT) / 2;

              contentDataList.forEach((nodeData, index) => {
                const contentY = contentStartY + index * (ROW_HEIGHT + MARGIN);
                nodePositions.set(nodeData.content.id, { x: START_X + COLUMN_WIDTH * 3, y: contentY });
                processedNodes.add(nodeData.content.id);

                // 3단계: 4단계 노드들(포맷) 중앙정렬 - 각 콘텐츠 노드 중심에 자신의 포맷 그룹 중앙정렬
                if (nodeData.formats.length > 0) {
                  const formatTotalHeight = nodeData.formats.length * ROW_HEIGHT + (nodeData.formats.length - 1) * (MARGIN / 2);
                  // 콘텐츠 노드의 Y값이 포맷 노드들의 중앙값과 일치하도록 계산
                  const formatStartY = contentY - (formatTotalHeight - ROW_HEIGHT) / 2;

                  nodeData.formats.forEach((formatChild, formatIndex) => {
                    const formatY = formatStartY + formatIndex * (ROW_HEIGHT + MARGIN / 2);
                    nodePositions.set(formatChild.id, { x: START_X + COLUMN_WIDTH * 4, y: formatY });
                    processedNodes.add(formatChild.id);
                  });
                }
              });
            }
          });
        });
      }

      // 다음 입력 노드를 위한 Y 위치 계산
      let maxHeight = inputY + ROW_HEIGHT;
      let minY = inputY;

      // 모든 하위 노드들의 Y 위치 범위 계산
      allChildren.forEach(child => {
        const childY = nodePositions.get(child.id)?.y || 0;
        maxHeight = Math.max(maxHeight, childY + ROW_HEIGHT);
        minY = Math.min(minY, childY);

        // 자식들의 자식들도 고려
        const grandChildren = getChildren(child.id, 'content');
        grandChildren.forEach(grandChild => {
          const grandChildY = nodePositions.get(grandChild.id)?.y || 0;
          maxHeight = Math.max(maxHeight, grandChildY + ROW_HEIGHT);
          minY = Math.min(minY, grandChildY);

          // 증손자들도 고려
          const greatGrandChildren = getChildren(grandChild.id, 'format');
          greatGrandChildren.forEach(greatGrandChild => {
            const greatGrandChildY = nodePositions.get(greatGrandChild.id)?.y || 0;
            maxHeight = Math.max(maxHeight, greatGrandChildY + ROW_HEIGHT);
            minY = Math.min(minY, greatGrandChildY);
          });
        });
      });

      currentY = maxHeight + MARGIN * 2;
    });

    // 연결되지 않은 노드들 오른쪽에 정렬
    const unconnectedChannels = channelNodes.filter(n => !processedNodes.has(n.id));
    const unconnectedSearches = searchNodes.filter(n => !processedNodes.has(n.id));
    const unconnectedContents = contentNodes.filter(n => !processedNodes.has(n.id));
    const unconnectedFormats = formatNodes.filter(n => !processedNodes.has(n.id));

    let unconnectedY = MARGIN;

    unconnectedChannels.forEach((node, index) => {
      nodePositions.set(node.id, {
        x: START_X + COLUMN_WIDTH,
        y: unconnectedY + index * ROW_HEIGHT
      });
    });

    unconnectedSearches.forEach((node, index) => {
      nodePositions.set(node.id, {
        x: START_X + COLUMN_WIDTH * 2,
        y: unconnectedY + (unconnectedChannels.length + index) * ROW_HEIGHT
      });
    });

    unconnectedContents.forEach((node, index) => {
      nodePositions.set(node.id, {
        x: START_X + COLUMN_WIDTH * 3,
        y: unconnectedY + (unconnectedChannels.length + unconnectedSearches.length + index) * ROW_HEIGHT
      });
    });

    unconnectedFormats.forEach((node, index) => {
      nodePositions.set(node.id, {
        x: START_X + COLUMN_WIDTH * 4,
        y: unconnectedY + (unconnectedChannels.length + unconnectedSearches.length + unconnectedContents.length + index) * ROW_HEIGHT
      });
    });

    // 위치 정보 적용
    nodes.forEach(node => {
      const position = nodePositions.get(node.id);
      if (position) {
        updatedNodes.push({ ...node, position });
      } else {
        // 위치를 찾지 못한 노드는 기존 위치 유지
        updatedNodes.push(node);
      }
    });

    setNodes(updatedNodes);
    console.log('✓ 트리 구조 수평 중앙정렬 완료 (상위 노드 기준 하위 노드 수평 중앙정렬)');
  }, [nodes, edges, setNodes]);

  // 노드 복제 (상위 노드 연결만 유지)
  const handleNodeDuplicate = useCallback((nodeId: string, position: 'top' | 'bottom') => {
    const currentWorkspace = workspaceRef.current;
    const originalNode = currentWorkspace.nodes.find((n) => n.id === nodeId);
    if (!originalNode) return;

    // Deep copy로 새 노드 생성
    const newNode: CustomNode = JSON.parse(JSON.stringify(originalNode));
    newNode.id = uuidv4();

    // 위치 조정 (위/아래)
    const offset = position === 'top' ? -150 : 150;
    newNode.position = {
      x: originalNode.position.x,
      y: originalNode.position.y + offset,
    };

    // 상위 노드 연결만 복사 (incoming edges만)
    const incomingEdges = currentWorkspace.edges.filter((e) => e.target === nodeId);

    const newEdges = incomingEdges.map((edge) => ({
      id: uuidv4(),
      source: edge.source,
      target: newNode.id,
    }));

    // workspace 상태를 직접 업데이트
    const updatedWorkspace = {
      ...currentWorkspace,
      nodes: [...currentWorkspace.nodes, newNode],
      edges: [...currentWorkspace.edges, ...newEdges],
    };

    setWorkspace(updatedWorkspace);
    console.log(`✓ 노드 복제 완료: ${originalNode.data.label} (상위 연결 ${newEdges.length}개)`);
  }, [setWorkspace]);

  // 포맷 노드 선택 토글
  const toggleFormatSelection = useCallback((nodeId: string) => {
    console.log('🟣 toggleFormatSelection called for nodeId:', nodeId);

    // 내부 업데이트 플래그 설정하여 useEffect가 이 변경을 무시하도록 함
    isInternalUpdateRef.current = true;

    // 먼저 현재 상태에서 노드를 찾아서 새로운 selected 값을 계산
    const currentNodes = workspace.nodes;
    const targetNode = currentNodes.find(n => n.id === nodeId && n.type === 'content_format');

    if (!targetNode) {
      console.error('🟣 Target node not found:', nodeId);
      return;
    }

    const currentSelected = targetNode.data.selected ?? false;
    const newSelected = !currentSelected;

    console.log('🟣 Toggling selection for node:', targetNode.data.label,
                'current selected:', currentSelected, 'new selected:', newSelected);

    // 동시에 업데이트할 노드 생성
    const updatedNode = {
      ...targetNode,
      data: {
        ...targetNode.data,
        selected: newSelected,
      },
    };

    // setNodes와 setWorkspace를 동시에 호출
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? updatedNode : node
      )
    );

    setWorkspace((prev) => {
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId ? updatedNode : node
      );

      console.log('🟣 Updated workspace nodes for format selection');
      return {
        ...prev,
        nodes: updatedNodes,
      };
    });
  }, [setNodes, setWorkspace, workspace.nodes]);

  // 다음 순서 노드 자동 생성 및 연결
  const addNextNode = useCallback((nodeId: string, nodeType: string) => {
    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode) return;

    let nextNodeType: 'input' | 'channel' | 'search' | 'content' | 'content_format' | null = null;

    // 노드 순서에 따른 다음 노드 타입 결정
    switch (nodeType) {
      case 'input':
        nextNodeType = 'channel';
        break;
      case 'channel':
        nextNodeType = 'search';
        break;
      case 'search':
        nextNodeType = 'content';
        break;
      case 'content':
        nextNodeType = 'content_format';
        break;
      case 'content_format':
        nextNodeType = null; // 포맷은 마지막
        break;
      default:
        nextNodeType = null;
    }

    if (!nextNodeType) return;

    // 다음 노드 생성
    const newNodeId = uuidv4();
    let config: InputNodeConfig | ChannelNodeConfig | SearchNodeConfig | ContentNodeConfig | ContentFormatNodeConfig;
    let label = '';

    if (nextNodeType === 'channel') {
      config = {
        kind: 'channel',
        name: '새 채널',
        channelType: 'linkedin',
        personaTags: [],
        toneTags: [],
        highLevelContentTags: [],
        channelKnowledge: '',
        toneMannerExample: '',
        prohibitedTypes: [],
        topics: [],
      };
      label = '채널';
    } else if (nextNodeType === 'search') {
      config = {
        kind: 'search',
        query: '',
        channels: ['reddit', 'twitter', 'linkedin'],
        timeFilter: 'week',
        sortFilter: 'hot',
        maxResults: 20,
        searchType: 'both',
      };
      label = '서치';
    } else if (nextNodeType === 'content') {
      config = {
        kind: 'content',
        title: '새 콘텐츠',
        body: '',
        contentType: 'text',
        status: 'draft',
        tags: [],
        metadata: {
          wordCount: 0,
          estimatedReadTime: 1,
          priority: 'medium',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      label = '콘텐츠';
    } else {
      config = {
        kind: 'content_format',
        name: '새 포맷',
        mappedContentType: '',
        formatExampleText: '',
        formatStructureDescription: '',
        generationPromptTemplate: '',
      };
      label = '콘텐츠 포맷';
    }

    const newNode: CustomNode = {
      id: newNodeId,
      type: nextNodeType,
      position: { x: currentNode.position.x + 400, y: currentNode.position.y },
      data: { label, config },
    };

    // 노드와 엣지 동시에 추가
    setNodes((nds) => [...nds, newNode]);

    const newEdge = {
      id: uuidv4(),
      source: nodeId,
      target: newNodeId,
      type: 'smoothstep',
      style: { stroke: '#6366f1', strokeWidth: 2 }
    };

    setEdges((eds) => [...eds, newEdge]);
    console.log(`✓ 자동 연결 생성: ${nodeType} → ${nextNodeType}`);
  }, [nodes, setNodes, setEdges]);

  // 서치 노드 선택 토글 핸들러
  const handleToggleSearchSelection = useCallback((nodeId: string) => {
    setSelectedSearchNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // 완전히 새로운 접근: 각 노드에 id와 필요한 props 전달
  const nodeTypes = useMemo(() => {
    return {
      input: InputNode,
      channel: ChannelNode,
      content_format: ContentFormatNode,
      content: (props: any) => <ContentNode {...props} id={props.id} />,
      search: (props: any) => <SearchNode {...props} id={props.id} isExecuting={executingSearchNodes.has(props.id)} />,
      canvas_box: CanvasBoxNode,
    };
  }, [workspace.id, executingSearchNodes]);

  // 단일 서치 노드 실행 핸들러 (기존 로직 재사용)
  const executeSingleSearchNode = useCallback(async (searchNodeId: string) => {
    try {
      // 실행 상태에 추가
      setExecutingSearchNodes(prev => new Set(prev).add(searchNodeId));

      // 현재 워크스페이스 정보 가져오기
      const currentWorkspace = workspaceRef.current;

      // 입력 → 채널 → 서치 노드 경로 찾기
      const searchNode = currentWorkspace.nodes.find((n) => n.id === searchNodeId && n.type === 'search');
      if (!searchNode) {
        console.error('서치 노드를 찾을 수 없습니다:', searchNodeId);
        return;
      }

      // 입력 노드와 채널 노드 찾기
      // 서치 노드로 들어오는 엣지 찾기 (채널 → 서치)
      const channelToSearchEdges = currentWorkspace.edges.filter((e) => e.target === searchNodeId);

      if (channelToSearchEdges.length === 0) {
        console.error('서치 노드에 연결된 채널 노드를 찾을 수 없습니다');
        alert('서치 노드를 실행하려면 채널 노드가 연결되어 있어야 합니다.');
        return;
      }

      const channelNodeId = channelToSearchEdges[0].source;

      // 채널 노드로 들어오는 엣지 찾기 (입력 → 채널)
      const inputToChannelEdges = currentWorkspace.edges.filter((e) => e.target === channelNodeId);

      if (inputToChannelEdges.length === 0) {
        console.error('채널 노드에 연결된 입력 노드를 찾을 수 없습니다');
        alert('서치 노드를 실행하려면 입력 노드가 채널 노드에 연결되어 있어야 합니다.');
        return;
      }

      const inputNodeId = inputToChannelEdges[0].source;

      console.log(`🚀 서치 노드 실행: ${inputNodeId} → ${channelNodeId} → ${searchNodeId}`);

      // API 호출
      const response = await fetch('/api/search/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputNodeId,
          channelNodeId,
          searchNodeId,
          workspaceId: currentWorkspace.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '서치 노드 실행 실패');
      }

      console.log('✅ 서치 노드 실행 완료:', result);

      // 워크스페이스 상태 업데이트 (서버에 이미 저장되었으므로, 클라이언트도 업데이트)
      if (result.success) {
        // 서치 노드 상태 업데이트
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === searchNodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  config: {
                    ...node.data.config,
                    lastExecutedAt: new Date().toISOString(),
                    searchNodeResult: result.result
                  }
                }
              };
            }
            return node;
          })
        );

        // 새 콘텐츠 노드가 생성된 경우 추가
        if (result.newContentNode) {
          setNodes((nds) => [...nds, result.newContentNode]);

          // 새 엣지 추가
          setEdges((eds) => [
            ...eds,
            {
              id: uuidv4(),
              source: searchNodeId,
              target: result.newContentNode.id,
              type: 'custom',
              data: { onDelete: handleEdgeDelete }
            }
          ]);
        }

        // 성공 메시지 표시
        alert(`서치 노드 실행 완료!\n${result.message}`);
      } else {
        alert('서치 노드 실행 실패: ' + (result.error || '알 수 없는 오류'));
      }

    } catch (error) {
      console.error('❌ 서치 노드 실행 오류:', error);
      alert('서치 노드 실행 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      // 실행 상태에서 제거 (성공/실패 관계없이)
      setExecutingSearchNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(searchNodeId);
        return newSet;
      });
    }
  }, [workspaceRef, setNodes, setEdges, setExecutingSearchNodes]);

  // 체크된 서치 노드들을 위에서부터 아래로 순차 실행하는 함수
  const executeCheckedSearchNodes = useCallback(async () => {
    if (selectedSearchNodes.size === 0) {
      alert('체크된 서치 노드가 없습니다.');
      return;
    }

    const workspace = workspaceRef.current;
    if (!workspace || !workspace.nodes) {
      alert('워크스페이스를 찾을 수 없습니다.');
      return;
    }

    // 체크된 서치 노드들을 Y 좌표 기준으로 정렬 (위에서부터 아래로)
    const checkedSearchNodes = nodes
      .filter(node => node.type === 'search' && selectedSearchNodes.has(node.id))
      .sort((a, b) => a.position.y - b.position.y);

    if (checkedSearchNodes.length === 0) {
      alert('체크된 서치 노드를 찾을 수 없습니다.');
      return;
    }

    console.log(`🔍 체크된 서치 노드 ${checkedSearchNodes.length}개 순차 실행 시작 (위 → 아래)`);

    try {
      // 각 서치 노드를 순차적으로 실행
      for (let i = 0; i < checkedSearchNodes.length; i++) {
        const searchNode = checkedSearchNodes[i];
        console.log(`📍 [${i + 1}/${checkedSearchNodes.length}] 서치 노드 실행: ${searchNode.data.label} (Y: ${searchNode.position.y})`);

        try {
          await executeSingleSearchNode(searchNode.id);
          console.log(`✅ 서치 노드 ${searchNode.data.label} 실행 완료`);
        } catch (error) {
          console.error(`❌ 서치 노드 ${searchNode.data.label} 실행 실패:`, error);
          // 하나가 실패해도 계속 진행할지 물어봄
          const continueExecution = confirm(`서치 노드 "${searchNode.data.label}" 실행에 실패했습니다. 계속 진행하시겠습니까?`);
          if (!continueExecution) {
            break;
          }
        }

        // 다음 노드 실행전 약간의 지연 (사용자 경험 향상)
        if (i < checkedSearchNodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      alert(`✅ 체크된 서치 노드 실행 완료! 총 ${checkedSearchNodes.length}개 노드 처리됨.`);

    } catch (error) {
      console.error('❌ 서치 노드 순차 실행 중 오류:', error);
      alert('서치 노드 실행 중 오류가 발생했습니다.');
    }
  }, [selectedSearchNodes, executeSingleSearchNode]);

  // 캔버스 박스 추가
  const handleAddCanvasBox = useCallback(() => {
    const viewport = getViewport();

    const newBoxNode: CustomNode = {
      id: uuidv4(),
      type: 'canvas_box',
      position: {
        x: -viewport.x / viewport.zoom + 300,
        y: -viewport.y / viewport.zoom + 200,
      },
      data: {
        label: '새 박스',
      },
      style: {
        width: 400,
        height: 300,
      },
      zIndex: -1,
    };

    // 즉시 화면에 반영
    setNodes((nds) => [...nds, newBoxNode]);
    console.log('✓ 캔버스 박스 추가됨');
  }, [setNodes, getViewport]);

  // 함수들을 외부에 노출
  useImperativeHandle(ref, () => ({
    autoLayout,
    executeCheckedSearchNodes,
  }), [autoLayout, executeCheckedSearchNodes]);

  return (
    <NodeActionsContext.Provider value={{ duplicateNode: handleNodeDuplicate, toggleFormatSelection, addNextNode }}>
      <div ref={reactFlowWrapper} className="flex-1 relative">
        {/* 노드 추가 툴바 */}
        <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md p-2 flex gap-2">
          <button
            onClick={() => addNode('input')}
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
          >
            + 입력
          </button>
          <button
            onClick={() => addNode('channel')}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
          >
            + 채널
          </button>
          <button
            onClick={() => addNode('search')}
            className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium"
          >
            + 서치
          </button>
          <button
            onClick={() => addNode('content')}
            className="px-3 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 text-sm font-medium"
          >
            + 콘텐츠
          </button>
          <button
            onClick={() => addNode('content_format')}
            className="px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm font-medium"
          >
            + 포맷
          </button>
          <div className="w-px bg-gray-300"></div>
          <button
            onClick={autoLayout}
            className="px-3 py-2 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm font-medium"
            title="노드 자동 정렬"
          >
            🧹 정리
          </button>
        </div>

        {/* React Flow 캔버스 */}
        <SearchSelectionContext.Provider value={{
          selectedNodes: selectedSearchNodes,
          toggleSelection: handleToggleSearchSelection
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onSelectionChange={(selection) => {
              if (selection.nodes.length > 0) {
                const selectedId = selection.nodes[0].id;
                const customNode = nodes.find((n) => n.id === selectedId) as CustomNode;
                setSelectedNode(customNode);
              } else {
                setSelectedNode(null);
              }
            }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            panOnDrag={[1, 2]}
            selectionOnDrag={true}
            panOnScroll={true}
            panOnScrollSpeed={0.8}
            selectionMode="partial"
            multiSelectionKeyCode={null}
            deleteKeyCode={null}
            selectNodesOnDrag={true}
            fitView
            connectionMode="loose"
            connectionLineType="smoothstep"
            snapToGrid={true}
            snapGrid={[10, 10]}
          >
          <Background />
          <Controls showInteractive={false}>
            <ControlButton onClick={handleAddCanvasBox} title="캔버스 박스 추가">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: '100%', height: '100%' }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
            </ControlButton>
          </Controls>
          <MiniMap />
        </ReactFlow>
      </SearchSelectionContext.Provider>
        </div>
    </NodeActionsContext.Provider>
  );
}

// CanvasInner를 forwardRef로 감싸기
const CanvasInner = forwardRef(CanvasInnerFunction);

// ReactFlowProvider로 감싸서 export
const Canvas = forwardRef<CanvasHandle, CanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export default Canvas;
