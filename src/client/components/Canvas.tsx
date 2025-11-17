import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle, createContext } from 'react';
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
import type { Workspace, Node as CustomNode, InputNodeConfig, ChannelNodeConfig, ContentFormatNodeConfig, ExecutedPath } from '../types';
import InputNode from './nodes/InputNode';
import ChannelNode from './nodes/ChannelNode';
import ContentFormatNode from './nodes/ContentFormatNode';
import CanvasBoxNode from './nodes/CanvasBoxNode';
import CustomEdge from './edges/CustomEdge';

// Context for node actions (duplicate, etc.)
export const NodeActionsContext = createContext<{
  duplicateNode: (nodeId: string, position: 'top' | 'bottom') => void;
  toggleFormatSelection: (nodeId: string) => void;
} | null>(null);

const nodeTypes: NodeTypes = {
  input: InputNode,
  channel: ChannelNode,
  content_format: ContentFormatNode,
  canvas_box: CanvasBoxNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

export interface CanvasHandle {
  autoLayout: () => void;
}

interface CanvasProps {
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  selectedNode: CustomNode | null;
  setSelectedNode: (node: CustomNode | null) => void;
  executedPaths?: ExecutedPath[];
  skippedPaths?: ExecutedPath[];
}

const CanvasInner = forwardRef<CanvasHandle, CanvasProps>(
  function CanvasInner(
    { workspace, setWorkspace, selectedNode, setSelectedNode, executedPaths = [], skippedPaths = [] },
    ref
  ) {
    const [nodes, setNodes, onNodesChange] = useNodesState(workspace.nodes);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState(workspace.edges);
    const [copiedNode, setCopiedNode] = useState<CustomNode | null>(null);
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

  // workspace 변경 감지 및 동기화
  const prevWorkspaceIdRef = useRef(workspace.id);
  const prevNodesRef = useRef(JSON.stringify(workspace.nodes));
  const prevEdgesRef = useRef(JSON.stringify(workspace.edges));

  useEffect(() => {
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

  // nodes/edges가 변경될 때 workspace 업데이트
  useEffect(() => {
    // 실제로 변경된 경우에만 업데이트
    const currentWorkspace = workspaceRef.current;
    const nodesChanged = JSON.stringify(currentWorkspace.nodes) !== JSON.stringify(nodes);
    const edgesChanged = JSON.stringify(currentWorkspace.edges) !== JSON.stringify(edges);

    if (nodesChanged || edgesChanged) {
      setWorkspace({ ...currentWorkspace, nodes, edges });
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

      // Cmd/Ctrl + C: 복사
      if (cmdOrCtrl && event.key === 'c' && selectedNode) {
        event.preventDefault();
        try {
          // Deep copy로 복사
          const nodeCopy = JSON.parse(JSON.stringify(selectedNode));
          setCopiedNode(nodeCopy);
          console.log('✓ 노드 복사됨:', selectedNode.data.label);
        } catch (error) {
          console.error('복사 실패:', error);
        }
      }

      // Cmd/Ctrl + V: 붙여넣기
      if (cmdOrCtrl && event.key === 'v' && copiedNode) {
        event.preventDefault();
        try {
          // 완전히 새로운 독립적인 노드 생성
          const newNode: CustomNode = JSON.parse(JSON.stringify(copiedNode));
          newNode.id = uuidv4();
          newNode.position = {
            x: copiedNode.position.x + 50,
            y: copiedNode.position.y + 50,
          };

          setNodes((nds) => [...nds, newNode]);
          console.log('✓ 노드 붙여넣기 완료:', newNode.data.label);
        } catch (error) {
          console.error('붙여넣기 실패:', error);
        }
      }

      // Cmd/Ctrl + D: 빠른 복제 (복사 + 붙여넣기 한번에)
      if (cmdOrCtrl && event.key === 'd' && selectedNode) {
        event.preventDefault();
        try {
          const newNode: CustomNode = JSON.parse(JSON.stringify(selectedNode));
          newNode.id = uuidv4();
          newNode.position = {
            x: selectedNode.position.x + 50,
            y: selectedNode.position.y + 50,
          };

          setNodes((nds) => [...nds, newNode]);
          console.log('✓ 노드 복제 완료:', newNode.data.label);
        } catch (error) {
          console.error('복제 실패:', error);
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
  }, [nodes, selectedNode, copiedNode, setNodes, setEdges, setSelectedNode]);

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
      const customNode = nodes.find((n) => n.id === node.id) as CustomNode;
      setSelectedNode(customNode || null);
    },
    [nodes, setSelectedNode]
  );

  // 노드 추가 (툴바 버튼용)
  const addNode = (type: 'input' | 'channel' | 'content_format') => {
    const id = uuidv4();
    let config: InputNodeConfig | ChannelNodeConfig | ContentFormatNodeConfig;
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
      };
      label = '채널';
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
      data: { label, config },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // 자동 정렬 (빗자루 버튼)
  const autoLayout = useCallback(() => {
    const COLUMN_WIDTH = 300; // 열 간격
    const ROW_HEIGHT = 120; // 행 간격
    const START_X = 100; // 시작 X 위치
    const NODE_HEIGHT = 72; // 노드 높이 (충돌 감지용)

    // 노드를 타입별로 분류
    const inputNodes = nodes.filter((n) => n.type === 'input');
    const channelNodes = nodes.filter((n) => n.type === 'channel');
    const formatNodes = nodes.filter((n) => n.type === 'content_format');

    const updatedNodes: CustomNode[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();

    // 1. 각 입력 노드에 연결된 채널 노드들을 순서대로 수집
    const channelsByInput = new Map<string, CustomNode[]>();
    inputNodes.forEach((inputNode) => {
      const connectedChannels = edges
        .filter((e) => e.source === inputNode.id)
        .map((e) => channelNodes.find((n) => n.id === e.target))
        .filter((n): n is CustomNode => n !== undefined);
      channelsByInput.set(inputNode.id, connectedChannels);
    });

    // 2. 각 채널에 연결된 포맷 개수를 계산하여 필요한 수직 공간 계산
    const getChannelHeight = (channelId: string): number => {
      const connectedFormats = edges
        .filter((e) => e.source === channelId)
        .map((e) => formatNodes.find((n) => n.id === e.target))
        .filter((n): n is CustomNode => n !== undefined);

      if (connectedFormats.length === 0) return ROW_HEIGHT;
      return Math.max(ROW_HEIGHT, connectedFormats.length * ROW_HEIGHT);
    };

    // 3. 입력 노드별로 처리
    inputNodes.forEach((inputNode, inputIndex) => {
      const connectedChannels = channelsByInput.get(inputNode.id) || [];

      // 3-1. 이 입력에 연결된 모든 채널들의 총 높이 계산
      const totalChannelHeight = connectedChannels.reduce((sum, channel) => {
        return sum + getChannelHeight(channel.id);
      }, 0);

      // 3-2. 입력 노드를 중앙에 배치 (채널들의 중앙)
      const inputY = inputIndex * (totalChannelHeight + ROW_HEIGHT * 2);
      const inputCenterY = inputY + totalChannelHeight / 2;

      const inputPosition = {
        x: START_X,
        y: inputCenterY,
      };
      nodePositions.set(inputNode.id, inputPosition);
      updatedNodes.push({ ...inputNode, position: inputPosition });

      // 3-3. 채널 노드들을 입력 노드 중심 기준으로 상하 배치
      let currentChannelY = inputY;
      connectedChannels.forEach((channelNode) => {
        const channelHeight = getChannelHeight(channelNode.id);
        const channelCenterY = currentChannelY + channelHeight / 2;

        const channelPosition = {
          x: START_X + COLUMN_WIDTH,
          y: channelCenterY,
        };
        nodePositions.set(channelNode.id, channelPosition);

        const existingIndex = updatedNodes.findIndex((n) => n.id === channelNode.id);
        if (existingIndex >= 0) {
          updatedNodes[existingIndex] = { ...channelNode, position: channelPosition };
        } else {
          updatedNodes.push({ ...channelNode, position: channelPosition });
        }

        // 3-4. 이 채널에 연결된 포맷 노드들을 채널 중심 기준으로 상하 배치
        const connectedFormats = edges
          .filter((e) => e.source === channelNode.id)
          .map((e) => formatNodes.find((n) => n.id === e.target))
          .filter((n): n is CustomNode => n !== undefined);

        if (connectedFormats.length > 0) {
          connectedFormats.forEach((formatNode, formatIndex) => {
            // 포맷을 채널 중심 기준으로 상하 균등 배치
            const offset = (formatIndex - (connectedFormats.length - 1) / 2) * ROW_HEIGHT;
            const formatPosition = {
              x: START_X + COLUMN_WIDTH * 2,
              y: channelCenterY + offset,
            };
            nodePositions.set(formatNode.id, formatPosition);

            const existingFormatIndex = updatedNodes.findIndex((n) => n.id === formatNode.id);
            if (existingFormatIndex >= 0) {
              updatedNodes[existingFormatIndex] = { ...formatNode, position: formatPosition };
            } else {
              updatedNodes.push({ ...formatNode, position: formatPosition });
            }
          });
        }

        currentChannelY += channelHeight;
      });
    });

    // 연결되지 않은 채널 노드들 처리
    let globalChannelY = (inputNodes.length > 0)
      ? Math.max(...Array.from(nodePositions.values()).map(p => p.y)) + ROW_HEIGHT * 2
      : 100;

    const unconnectedChannels = channelNodes.filter((n) => !nodePositions.has(n.id));
    unconnectedChannels.forEach((node) => {
      const position = {
        x: START_X + COLUMN_WIDTH,
        y: globalChannelY,
      };
      nodePositions.set(node.id, position);
      updatedNodes.push({ ...node, position });
      globalChannelY += ROW_HEIGHT;
    });

    // 연결되지 않은 포맷 노드들 처리
    let globalFormatY = (inputNodes.length > 0)
      ? Math.max(...Array.from(nodePositions.values()).map(p => p.y)) + ROW_HEIGHT * 2
      : 100;

    const unconnectedFormats = formatNodes.filter((n) => !nodePositions.has(n.id));
    unconnectedFormats.forEach((node) => {
      const position = {
        x: START_X + COLUMN_WIDTH * 2,
        y: globalFormatY,
      };
      updatedNodes.push({ ...node, position });
      globalFormatY += ROW_HEIGHT;
    });

    setNodes(updatedNodes);
    console.log('✓ 노드 자동 정렬 완료 (입력 중앙, 채널 순서, 포맷 충돌 방지)');
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
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId && node.type === 'content_format') {
          return {
            ...node,
            data: {
              ...node.data,
              selected: !node.data.selected,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

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

  // autoLayout 함수를 외부에 노출
  useImperativeHandle(ref, () => ({
    autoLayout,
  }), [autoLayout]);

  return (
    <NodeActionsContext.Provider value={{ duplicateNode: handleNodeDuplicate, toggleFormatSelection }}>
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
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
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
      </div>
    </NodeActionsContext.Provider>
  );
});

// ReactFlowProvider로 감싸서 export
const Canvas = forwardRef<CanvasHandle, CanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export default Canvas;
