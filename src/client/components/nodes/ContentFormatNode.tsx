import { useContext } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeActionsContext } from '../Canvas';

function ContentFormatNode({ data, id, selected }: any) {
  const nodeActions = useContext(NodeActionsContext);
  const isSelected = data.selected || false;

  const handleDuplicate = (position: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeActions) {
      nodeActions.duplicateNode(id, position);
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (nodeActions) {
      nodeActions.toggleFormatSelection(id);
    }
  };

  return (
    <div className="relative group">
      {/* Top + button */}
      <button
        onClick={(e) => handleDuplicate('top', e)}
        className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-purple-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-600 flex items-center justify-center text-sm font-bold shadow-md z-10"
      >
        +
      </button>

      {/* Node content */}
      <div className={`px-4 py-3 bg-purple-100 border-2 rounded-lg min-w-[150px] ${isSelected ? 'border-purple-700 bg-purple-200' : 'border-purple-500'}`}>
        <Handle type="target" position={Position.Left} />
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1">
            <div className="font-semibold text-purple-900">{data.label}</div>
            <div className="text-xs text-purple-700 mt-1">
              {data.config.mappedContentType || '콘텐츠 유형 설정 필요'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom + button */}
      <button
        onClick={(e) => handleDuplicate('bottom', e)}
        className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-purple-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-600 flex items-center justify-center text-sm font-bold shadow-md z-10"
      >
        +
      </button>
    </div>
  );
}

export default ContentFormatNode;
