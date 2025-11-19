import { useContext } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeActionsContext } from '../Canvas';

// 채널 타입별 색상 매핑 (해시 기반으로 일관된 색상 할당)
function getChannelColor(channelType: string) {
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-900', textLight: 'text-blue-700', button: 'bg-blue-500 hover:bg-blue-600' },
    { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-900', textLight: 'text-green-700', button: 'bg-green-500 hover:bg-green-600' },
    { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-900', textLight: 'text-orange-700', button: 'bg-orange-500 hover:bg-orange-600' },
    { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-900', textLight: 'text-pink-700', button: 'bg-pink-500 hover:bg-pink-600' },
    { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-900', textLight: 'text-indigo-700', button: 'bg-indigo-500 hover:bg-indigo-600' },
    { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-900', textLight: 'text-teal-700', button: 'bg-teal-500 hover:bg-teal-600' },
    { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-900', textLight: 'text-cyan-700', button: 'bg-cyan-500 hover:bg-cyan-600' },
    { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-900', textLight: 'text-amber-700', button: 'bg-amber-500 hover:bg-amber-600' },
  ];

  // 채널 타입 문자열을 해시하여 색상 인덱스 결정
  let hash = 0;
  for (let i = 0; i < channelType.length; i++) {
    hash = channelType.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;

  return colors[colorIndex];
}

function ChannelNode({ data, id }: any) {
  const nodeActions = useContext(NodeActionsContext);
  const channelType = data.config?.channelType || '기본';
  const color = getChannelColor(channelType);

  const handleDuplicate = (position: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeActions) {
      nodeActions.duplicateNode(id, position);
    }
  };

  const handleAddFormat = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 포맷 추가 이벤트 발생 - 부모 컴포넌트에서 처리
    window.dispatchEvent(new CustomEvent('openFormatReferenceModal', {
      detail: { channelId: id, channelConfig: data.config }
    }));
  };

  return (
    <div className="relative group">
      {/* Top + button */}
      <button
        onClick={(e) => handleDuplicate('top', e)}
        className={`absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 ${color.button} text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-bold shadow-md z-10`}
      >
        +
      </button>

      {/* Node content */}
      <div className={`px-2 py-1 ${color.bg} border-2 ${color.border} rounded-lg w-[150px] h-[80px] flex items-center relative`}>
        <Handle type="target" position={Position.Left} />
        <div className="flex-1">
          <div className={`font-semibold ${color.text} text-xs leading-tight truncate`}>{data.label}</div>
          <div className={`text-xs ${color.textLight} truncate`}>
            {channelType}
          </div>
        </div>
        <Handle type="source" position={Position.Right} />

        {/* Format Add Button */}
        <button
          onClick={handleAddFormat}
          className={`absolute -right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 ${color.button} text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold shadow-md z-10`}
          title="포맷 추가"
        >
          F
        </button>
      </div>

      {/* Bottom + button */}
      <button
        onClick={(e) => handleDuplicate('bottom', e)}
        className={`absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 ${color.button} text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-bold shadow-md z-10`}
      >
        +
      </button>
    </div>
  );
}

export default ChannelNode;
