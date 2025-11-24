import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './Header';
import LeftPanel from './LeftPanel';
import Canvas, { type CanvasHandle } from './Canvas';
import RightPanel from './RightPanel';
import FormatReferenceModal from './FormatReferenceModal';
import type { Workspace, Node, GeneratedContent, ContentFormatNodeConfig, ExecutedPath, ChannelNodeConfig } from '../types';
import { api } from '../apiClient';

interface WorkspacePageProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onWorkspaceChange: (id: string) => void;
  onWorkspaceCreate: (name: string) => void;
  onWorkspaceRename: (id: string, newName: string) => void;
  onWorkspaceDelete: (id: string) => void;
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  generatedContents: GeneratedContent[];
  setGeneratedContents: (contents: GeneratedContent[]) => void;
}

function WorkspacePage({
  workspaces,
  currentWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreate,
  onWorkspaceRename,
  onWorkspaceDelete,
  workspace,
  setWorkspace,
  generatedContents,
  setGeneratedContents,
}: WorkspacePageProps) {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executedPaths, setExecutedPaths] = useState<ExecutedPath[]>([]);
  const [skippedPaths, setSkippedPaths] = useState<ExecutedPath[]>([]);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showRunModeModal, setShowRunModeModal] = useState(false);

  // 포맷 참조 모달 상태
  const [showFormatReferenceModal, setShowFormatReferenceModal] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelConfig, setSelectedChannelConfig] = useState<ChannelNodeConfig | null>(null);
  const [isGeneratingFormat, setIsGeneratingFormat] = useState(false);

  // Refs to avoid infinite loops
  const workspaceRef = useRef(workspace);
  const canvasRef = useRef<CanvasHandle>(null);

  // 재렌더링 감지 시스템
  const renderCountRef = useRef(0);
  const renderTimestampsRef = useRef<number[]>([]);
  const recoveryInProgressRef = useRef(false);

  // Update workspace ref when workspace changes
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  // 과도한 재렌더링 감지 및 자동 복구
  useEffect(() => {
    if (recoveryInProgressRef.current) return;

    renderCountRef.current += 1;
    const now = Date.now();
    renderTimestampsRef.current.push(now);

    // 5초 이상 오래된 타임스탬프 제거
    renderTimestampsRef.current = renderTimestampsRef.current.filter(
      (timestamp) => now - timestamp < 5000
    );

    // 재렌더링 경고 비활성화 (사용자 요청)
    // 경고 메시지는 표시하지 않지만, 실제 무한 루프는 방지됨

    // 정상 상태면 1초마다 카운터 리셋
    const timeout = setTimeout(() => {
      if (renderCountRef.current < 50) {
        renderCountRef.current = 0;
      }
    }, 1000);

    return () => clearTimeout(timeout);
  });

  // Auto-save every 1 minute (60000ms)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await api.updateWorkspace(workspaceRef.current.id, {
          nodes: workspaceRef.current.nodes,
          edges: workspaceRef.current.edges,
        });
        console.log('✓ Auto-saved at', new Date().toLocaleTimeString());
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []); // Empty dependency - won't re-create interval

  // 포맷 참조 모달 이벤트 리스너
  useEffect(() => {
    const handleOpenModal = (event: CustomEvent) => {
      const { channelId, channelConfig } = event.detail;
      setSelectedChannelId(channelId);
      setSelectedChannelConfig(channelConfig);
      setShowFormatReferenceModal(true);
    };

    window.addEventListener('openFormatReferenceModal', handleOpenModal as EventListener);
    return () => window.removeEventListener('openFormatReferenceModal', handleOpenModal as EventListener);
  }, []);

  // 레퍼런스 기반 포맷 생성 핸들러
  const handleOpenFormatReference = useCallback((channelId: string, channelConfig: ChannelNodeConfig) => {
    setSelectedChannelId(channelId);
    setSelectedChannelConfig(channelConfig);
    setShowFormatReferenceModal(true);
  }, []);

  // 워크스페이스 저장
  const handleSave = useCallback(async () => {
    try {
      const { workspace: updated } = await api.updateWorkspace(workspaceRef.current.id, {
        nodes: workspaceRef.current.nodes,
        edges: workspaceRef.current.edges,
      });
      setWorkspace(updated);
      alert('저장되었습니다!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('저장에 실패했습니다.');
    }
  }, [setWorkspace]);

  // 플로우 실행 (자동 생성 모드)
  const executeAutoMode = useCallback(() => {
    setShowRunModeModal(false);
    setIsRunning(true);
    setGeneratedContents([]); // 기존 결과 초기화
    setExecutedPaths([]); // 경로 표시 초기화
    setSkippedPaths([]);

    // EventSource로 SSE 연결 (자동 생성 모드)
    const eventSource = new EventSource(`/api/workspaces/${workspace.id}/run`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'path_start') {
          // 실행 중인 경로 표시
          console.log('✓ 경로 시작:', data.path);
          setExecutedPaths([data.path]); // 현재 실행 중인 경로만 표시
        } else if (data.type === 'path_complete') {
          // 경로 완료 - 표시 제거, 결과 추가
          console.log('✓ 경로 완료:', data.path);
          setExecutedPaths([]); // 경로 표시 제거
          setGeneratedContents((prev) => [...prev, data.content]);
        } else if (data.type === 'done') {
          // 전체 완료
          console.log('✓ 플로우 실행 완료');
          setExecutedPaths([]); // 모든 경로 표시 제거
          setSkippedPaths(data.response.skippedPaths || []);
          alert(`${data.response.results.length}개의 콘텐츠가 생성되었습니다!`);
          eventSource.close();
          setIsRunning(false);
        } else if (data.type === 'error') {
          console.error('플로우 실행 오류:', data.response.error);
          alert(`실행 실패: ${data.response.error}`);
          eventSource.close();
          setIsRunning(false);
        }
      } catch (error) {
        console.error('SSE 메시지 파싱 오류:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE 연결 오류:', error);
      alert('플로우 실행에 실패했습니다.');
      eventSource.close();
      setIsRunning(false);
    };
  }, [workspace.id, setGeneratedContents]);

  // 플로우 실행 (수동 선택 모드)
  const executeManualMode = useCallback(() => {
    setShowRunModeModal(false);
    setIsRunning(true);
    setGeneratedContents([]);
    setExecutedPaths([]);
    setSkippedPaths([]);

    // 선택된 포맷 ID 수집
    const selectedFormatIds = workspace.nodes
      .filter((node) => node.type === 'content_format' && node.data.selected)
      .map((node) => node.id);

    if (selectedFormatIds.length === 0) {
      alert('선택된 포맷이 없습니다. 포맷 노드의 체크박스를 선택해주세요.');
      setIsRunning(false);
      return;
    }

    // EventSource로 SSE 연결 (수동 선택 모드)
    const params = new URLSearchParams({
      mode: 'manual',
      selectedFormats: selectedFormatIds.join(','),
    });
    const eventSource = new EventSource(`/api/workspaces/${workspace.id}/run?${params.toString()}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'path_start') {
          console.log('✓ 경로 시작:', data.path);
          setExecutedPaths([data.path]);
        } else if (data.type === 'path_complete') {
          console.log('✓ 경로 완료:', data.path);
          setExecutedPaths([]);
          setGeneratedContents((prev) => [...prev, data.content]);
        } else if (data.type === 'done') {
          console.log('✓ 플로우 실행 완료');
          setExecutedPaths([]);
          setSkippedPaths(data.response.skippedPaths || []);
          alert(`${data.response.results.length}개의 콘텐츠가 생성되었습니다!`);
          eventSource.close();
          setIsRunning(false);
        } else if (data.type === 'error') {
          console.error('플로우 실행 오류:', data.response.error);
          alert(`실행 실패: ${data.response.error}`);
          eventSource.close();
          setIsRunning(false);
        }
      } catch (error) {
        console.error('SSE 메시지 파싱 오류:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE 연결 오류:', error);
      alert('플로우 실행에 실패했습니다.');
      eventSource.close();
      setIsRunning(false);
    };
  }, [workspace.id, workspace.nodes, setGeneratedContents]);

  // 플로우 실행 버튼 클릭 (모달 띄우기)
  const handleRun = useCallback(() => {
    setShowRunModeModal(true);
  }, []);

  // 서치 실행 버튼 클릭 (체크된 서치 노드들 실행)
  const handleSearchExecute = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.executeCheckedSearchNodes();
    }
  }, []);

  // 생성 결과 삭제
  const handleDeleteContent = useCallback((contentId: string) => {
    setGeneratedContents((prev) => prev.filter((c) => c.id !== contentId));
  }, [setGeneratedContents]);

  // 특정 포맷 재생성
  const handleRegenerateContent = useCallback(async (channelNodeId: string, formatNodeId: string, previousContent: string, prompt?: string) => {
    try {
      setIsRunning(true);

      // 해당 경로만 실행 (입력 노드 찾기)
      const channelNode = workspace.nodes.find((n) => n.id === channelNodeId);
      if (!channelNode) {
        alert('채널 노드를 찾을 수 없습니다.');
        return;
      }

      // 채널에 연결된 입력 노드 찾기
      const inputEdge = workspace.edges.find((e) => e.target === channelNodeId);
      if (!inputEdge) {
        alert('입력 노드를 찾을 수 없습니다.');
        return;
      }

      const inputNodeId = inputEdge.source;
      const inputNode = workspace.nodes.find((n) => n.id === inputNodeId);

      // 대화 히스토리를 포함한 프롬프트 작성
      let originalWorkspace = workspace;
      if (inputNode) {
        let additionalData = '';

        if (prompt) {
          // 프롬프트가 있으면 이전 결과 + 수정 요청 형식으로
          additionalData = `\n\n=== 이전 생성 결과 ===\n${previousContent}\n\n=== 수정 요청 ===\n${prompt}\n\n위 이전 결과를 참고하여 수정 요청사항을 반영해서 새로운 버전을 작성해주세요.`;
        } else {
          // 프롬프트 없이 재생성
          additionalData = '';
        }

        if (additionalData) {
          const modifiedNodes = workspace.nodes.map((n) => {
            if (n.id === inputNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  config: {
                    ...n.data.config,
                    rawData: n.data.config.rawData + additionalData
                  }
                }
              };
            }
            return n;
          });

          // 임시 워크스페이스로 저장
          await api.updateWorkspace(workspace.id, {
            nodes: modifiedNodes,
            edges: workspace.edges,
          });
        }
      }

      // 전체 플로우 실행 후 해당 포맷의 결과만 필터링
      console.log("[UI] 플로우 실행 시도 - 선택된 포맷:", formatNodeId);
      const response = await api.runFlow(workspace.id);

      // 원래 워크스페이스로 복원
      if (inputNode && prompt) {
        await api.updateWorkspace(workspace.id, {
          nodes: originalWorkspace.nodes,
          edges: originalWorkspace.edges,
        });
      }

      if (response.success) {
        // 새로 생성된 결과 중 해당 포맷의 것만 찾기
        const newContent = response.results.find(
          (r) => r.channelNodeId === channelNodeId && r.contentFormatNodeId === formatNodeId
        );

        if (newContent) {
          // 기존 결과 중 같은 포맷의 것 제거하고 새 결과 추가
          setGeneratedContents((prev) => {
            const filtered = prev.filter(
              (c) => !(c.channelNodeId === channelNodeId && c.contentFormatNodeId === formatNodeId)
            );
            return [...filtered, newContent];
          });
          alert(prompt ? '이전 결과를 참고하여 수정되었습니다!' : '콘텐츠가 재생성되었습니다!');
        } else {
          alert('재생성에 실패했습니다.');
        }
      } else {
        alert(`실행 실패: ${response.error}`);
      }
    } catch (error) {
      console.error('Regenerate failed:', error);
      alert('재생성에 실패했습니다.');
    } finally {
      setIsRunning(false);
    }
  }, [workspace, setGeneratedContents]);

  // 콘텐츠 태그에서 포맷 노드 자동 생성
  const handleCreateFormatNode = useCallback((channelNodeId: string, formatName: string) => {
    // 새 포맷 노드 생성
    const newFormatNodeId = uuidv4();
    const newFormatNode: Node = {
      id: newFormatNodeId,
      type: 'content_format',
      position: { x: 650, y: 250 }, // 임시 위치, autoLayout으로 재정렬됨
      data: {
        label: formatName,
        config: {
          kind: 'content_format',
          name: formatName,
          mappedContentType: '',
          formatExampleText: '',
          formatStructureDescription: '',
          generationPromptTemplate: '',
        } as ContentFormatNodeConfig,
      },
      style: {
        width: 150,
        height: 80,
        backgroundColor: '#f8fafc',
        border: '2px solid #e2e8f0',
        borderRadius: '8px'
      }
    };

    // 채널 노드와 포맷 노드를 연결하는 엣지 생성
    const newEdge = {
      id: uuidv4(),
      source: channelNodeId,
      target: newFormatNodeId,
    };

    // workspace에 노드와 엣지 추가
    const updatedWorkspace = {
      ...workspace,
      nodes: [...workspace.nodes, newFormatNode],
      edges: [...workspace.edges, newEdge],
    };

    setWorkspace(updatedWorkspace);

    // 자동 정렬 실행
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.autoLayout();
      }
    }, 100); // Canvas가 새 노드를 반영할 시간을 줌

    console.log(`✓ 포맷 노드 생성: ${formatName}`);
  }, [workspace, setWorkspace]);

  // 레퍼런스 기반 포맷 생성
  const handleGenerateFormatFromReference = useCallback(async (data: {
    channelId: string;
    channelType: string;
    textReference: string;
    articleReferences: string[];
    targetLanguage: string;
  }) => {
    if (!selectedChannelId || !selectedChannelConfig) return;

    try {
      setIsGeneratingFormat(true);
      console.log('🤖 AI 포맷 생성 시작...');

      const response = await api.generateFormatFromReference({
        ...data,
        workspaceId: workspace.id // workspaceId 추가
      });

      if (response.success && response.data) {
        const responseData = response.data;

        // 서버에서 생성된 노드와 엣지가 있는 경우 워크스페이스를 다시 로드
        if (responseData.node && responseData.edge) {
          console.log('✅ 포맷 노드 및 엣지가 서버에서 생성됨');

          try {
            // 서버에서 업데이트된 워크스페이스를 다시 로드
            const updatedWorkspace = await api.getWorkspace(workspace.id);
            if (updatedWorkspace) {
              setWorkspace(updatedWorkspace.workspace);
            }

            // 자동 정렬 실행 (노드 렌더링 후 안정적으로 실행)
            setTimeout(() => {
              try {
                if (canvasRef.current) {
                  canvasRef.current.autoLayout();
                }
              } catch (layoutError) {
                console.error('자동 정렬 중 오류:', layoutError);
                // 레이아웃 오류가 있어도 사용자 경험은 계속 진행
              }
            }, 300);

            // AI 포맷 생성 완료 팝업 표시 및 모달 닫기
            setTimeout(() => {
              alert('AI 포맷 생성이 완료되었습니다!');
              setShowFormatReferenceModal(false);
            }, 500); // 정렬이 완료된 후 팝업 표시
          } catch (workspaceError) {
            console.error('워크스페이스 로드 중 오류:', workspaceError);
            alert('포맷은 생성되었으나 워크스페이스 새로고침에 실패했습니다. 페이지를 새로고침해주세요.');
            setShowFormatReferenceModal(false); // 오류 경우에도 모달 닫기
          }
        } else {
          // 기존 방식으로 포맷 데이터 처리 (하위 호환성)
          const formatData = responseData.formatData || responseData;
        console.log('✅ AI 포맷 생성 성공:', formatData.formatName);

        // 새 포맷 노드 생성
        const newFormatNodeId = uuidv4();
        const newFormatNode: Node = {
          id: newFormatNodeId,
          type: 'content_format',
          position: {
            x: 650,
            y: 250 + Math.random() * 100 // 약간의 랜덤 위치
          },
          data: {
            label: formatData.formatName,
            config: {
              kind: 'content_format',
              name: formatData.formatName,
              mappedContentType: formatData.formatType,

              // 전략 요약 영역
              overallStrategy: formatData.overallStrategy,

              // 블록 정보 확장
              formatBlocks: formatData.blocks?.map((block: any) => ({
                id: uuidv4(),
                title: block.name,
                recommendedLength: block.recommendedLength,
                coreStrategy: block.coreStrategy || '',
                keyMoves: block.keyMoves || [],
                dos: block.dos || [],
                donts: block.donts || []
              })) || []

            } as ContentFormatNodeConfig,
          },
          style: {
            width: 150,
            height: 80,
            backgroundColor: '#f8fafc',
            border: '2px solid #e2e8f0',
            borderRadius: '8px'
          }
        };

        // 채널 노드와 포맷 노드를 연결하는 엣지 생성
        const newEdge = {
          id: uuidv4(),
          source: selectedChannelId,
          target: newFormatNodeId,
          type: 'smoothstep',
          style: { stroke: '#8b5cf6', strokeWidth: 2 }
        };

        // workspace에 노드와 엣지 추가
        const updatedWorkspace = {
          ...workspace,
          nodes: [...workspace.nodes, newFormatNode],
          edges: [...workspace.edges, newEdge],
        };

        console.log('🔄 워크스페이스 업데이트 시도:', {
          nodeId: newFormatNode.id,
          nodeName: formatData.formatName,
          edgeId: newEdge.id,
          totalNodes: updatedWorkspace.nodes.length,
          totalEdges: updatedWorkspace.edges.length
        });

        try {
          await api.updateWorkspace(workspace.id, updatedWorkspace);
          setWorkspace(updatedWorkspace);
          console.log('✅ 워크스페이스 저장 성공');

          // 자동 정렬 실행 (노드 렌더링 후 안정적으로 실행)
          setTimeout(() => {
            try {
              if (canvasRef.current) {
                canvasRef.current.autoLayout();
              }
            } catch (layoutError) {
              console.error('자동 정렬 중 오류:', layoutError);
              // 레이아웃 오류가 있어도 사용자 경험은 계속 진행
            }
          }, 300);

          // AI 포맷 생성 완료 팝업 표시 및 모달 닫기
          setTimeout(() => {
            alert('AI 포맷 생성이 완료되었습니다!');
            setShowFormatReferenceModal(false);
          }, 500); // 정렬이 완료된 후 팝업 표시
        } catch (saveError) {
          console.error('❌ 워크스페이스 저장 실패:', saveError);
          alert('포맷 저장에 실패했습니다. 나중에 다시 시도해주세요.');
          setShowFormatReferenceModal(false); // 오류 경우에도 모달 닫기
        }
        } // 기존 방식 처리의 else 블록 끝
      } else {
        alert('포맷 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Format generation failed:', error);
      alert('AI 포맷 생성에 실패했습니다.');
    } finally {
      setIsGeneratingFormat(false);
    }
  }, [selectedChannelId, selectedChannelConfig, workspace, setWorkspace]);

  // AI 포맷 제안
  const handleSuggestFormats = useCallback(async (channelNodeId: string) => {
    try {
      setIsRunning(true);
      console.log(`\n=== AI 포맷 제안 요청: 채널 ${channelNodeId} ===`);

      const response = await api.suggestFormats(workspace.id, channelNodeId);

      if (response.success && response.workspace) {
        // 서버에서 반환한 전체 workspace로 업데이트
        setWorkspace(response.workspace);

        // 자동 정렬 실행
        setTimeout(() => {
          if (canvasRef.current) {
            canvasRef.current.autoLayout();
          }
        }, 100);

        console.log(`✓ ${response.formats.length}개 포맷 노드 생성 완료`);
        alert(`AI가 ${response.formats.length}개의 적합한 포맷을 제안했습니다!`);
      } else {
        alert('포맷 제안에 실패했습니다.');
      }
    } catch (error) {
      console.error('Format suggestion failed:', error);
      alert('AI 포맷 제안에 실패했습니다.');
    } finally {
      setIsRunning(false);
    }
  }, [workspace.id, setWorkspace]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 재렌더링 무한루프 감지 시 복구 모달 */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-xl font-bold text-gray-900">시스템 오류 감지</h2>
            </div>
            <p className="text-gray-700 mb-4">
              과도한 재렌더링이 감지되어 시스템이 불안정할 수 있습니다.
              <br />
              현재 작업 내용이 자동으로 저장되었습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  recoveryInProgressRef.current = false;
                  setShowRecoveryModal(false);
                  renderCountRef.current = 0;
                  renderTimestampsRef.current = [];
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                계속 작업
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                새로고침
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              권장: 새로고침을 통해 시스템을 안정화하세요
            </p>
          </div>
        </div>
      )}

      {/* 플로우 실행 방식 선택 모달 */}
      {showRunModeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">실행 방식 선택</h2>
            <p className="text-gray-600 mb-6">
              플로우를 어떤 방식으로 실행하시겠습니까?
            </p>

            <div className="space-y-3">
              {/* 자동 생성 */}
              <button
                onClick={executeAutoMode}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                <div className="font-semibold mb-1">🤖 자동 생성</div>
                <div className="text-sm text-blue-100">
                  AI가 채널 적합성을 판단하고 최적의 포맷을 선택하여 콘텐츠를 생성합니다.
                </div>
              </button>

              {/* 선택된 포맷만 실행 */}
              <button
                onClick={executeManualMode}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-left"
              >
                <div className="font-semibold mb-1">✅ 선택된 포맷</div>
                <div className="text-sm text-purple-100">
                  체크박스로 선택한 포맷에 대해서만 콘텐츠를 생성합니다.
                </div>
              </button>

              {/* 취소 */}
              <button
                onClick={() => setShowRunModeModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        onWorkspaceCreate={onWorkspaceCreate}
        onWorkspaceRename={onWorkspaceRename}
        onWorkspaceDelete={onWorkspaceDelete}
        workspaceName={workspace.name}
        onSave={handleSave}
        onRun={handleRun}
        isRunning={isRunning}
        onSearchExecute={handleSearchExecute}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-64 border-r bg-white overflow-y-auto">
          <LeftPanel
            selectedNode={selectedNode}
            workspace={workspace}
            setWorkspace={setWorkspace}
            onCreateFormatNode={handleCreateFormatNode}
            onSuggestFormats={handleSuggestFormats}
            onOpenFormatReference={handleOpenFormatReference}
          />
        </div>

        {/* Canvas */}
        <Canvas
          ref={canvasRef}
          workspace={workspace}
          setWorkspace={setWorkspace}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          executedPaths={executedPaths}
          skippedPaths={skippedPaths}
        />

        {/* Right Panel */}
        <div className="w-80 border-l bg-white overflow-y-auto">
          <RightPanel
            generatedContents={generatedContents}
            workspace={workspace}
            onDeleteContent={handleDeleteContent}
            onRegenerateContent={handleRegenerateContent}
          />
        </div>
      </div>

      {/* Format Reference Modal */}
      {showFormatReferenceModal && selectedChannelConfig && (
        <FormatReferenceModal
          isOpen={showFormatReferenceModal}
          onClose={() => setShowFormatReferenceModal(false)}
          channelConfig={selectedChannelConfig}
          channelId={selectedChannelId || ''}
          onGenerateFormat={handleGenerateFormatFromReference}
          isGenerating={isGeneratingFormat}
        />
      )}
    </div>
  );
}

export default WorkspacePage;
