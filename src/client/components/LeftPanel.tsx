import { memo } from 'react';
import type { Node, Workspace } from '../types';
import InputNodeForm from './forms/InputNodeForm';
import ChannelNodeForm from './forms/ChannelNodeForm';
import ContentFormatNodeForm from './forms/ContentFormatNodeForm';
import RedditSearchNodeForm from './forms/RedditSearchNodeForm';
import SearchNodeForm from './forms/SearchNodeForm';
import ContentNodeForm from './forms/ContentNodeForm';

interface LeftPanelProps {
  selectedNode: Node | null;
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  onCreateFormatNode?: (channelNodeId: string, formatName: string) => void;
  onSuggestFormats?: (channelNodeId: string) => void;
  onOpenFormatReference?: (channelId: string, channelConfig: ChannelNodeConfig) => void;
}

function LeftPanel({ selectedNode, workspace, setWorkspace, onCreateFormatNode, onSuggestFormats, onOpenFormatReference }: LeftPanelProps) {
  
  // 노드 설정 업데이트
  const updateNodeConfig = (nodeId: string, newConfig: any) => {
    const updatedNodes = workspace.nodes.map((node) => {
      if (node.id === nodeId) {
        // 채널 타입이 변경되면 label도 업데이트
        let newLabel = node.data.label;
        if (newConfig.kind === 'channel' && newConfig.name) {
          newLabel = newConfig.name;
        } else if (newConfig.kind === 'content_format' && newConfig.name) {
          newLabel = newConfig.name;
        } else if (newConfig.kind === 'input' && newConfig.title) {
          newLabel = newConfig.title;
        } else if (newConfig.kind === 'reddit_search') {
          newLabel = 'Reddit 서치';
        }

        // 완전히 새로운 노드 객체 생성 (deep copy)
        return {
          ...node,
          data: {
            label: newLabel,
            config: { ...newConfig }
          }
        };
      }
      return node;
    });

    // 완전히 새로운 workspace 객체 생성
    setWorkspace({
      ...workspace,
      nodes: updatedNodes,
      edges: [...workspace.edges] // edges도 새 배열로 복사
    });
  };

  return (
    <div className="h-full bg-white overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">노드 설정</h2>

        {!selectedNode ? (
          <div className="text-sm text-gray-500 text-center py-8">
            노드를 선택하면
            <br />
            설정을 편집할 수 있습니다
          </div>
        ) : (
          <div className="space-y-4">
            {/* 노드 타입별 폼 렌더링 */}
            {selectedNode.type === 'input' && (
              <InputNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
              />
            )}
            {selectedNode.type === 'channel' && (
              <ChannelNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
                onCreateFormatNode={onCreateFormatNode}
                onSuggestFormats={onSuggestFormats}
                onOpenFormatReference={onOpenFormatReference}
                workspace={workspace}
                setWorkspace={setWorkspace}
              />
            )}
            {selectedNode.type === 'content_format' && (
              <ContentFormatNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
              />
            )}
            {selectedNode.type === 'reddit_search' && (
              <RedditSearchNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
              />
            )}
            {selectedNode.type === 'search' && (
              <SearchNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
              />
            )}
            {selectedNode.type === 'content' && (
              <ContentNodeForm
                node={selectedNode}
                onUpdate={(config) => updateNodeConfig(selectedNode.id, config)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(LeftPanel);
