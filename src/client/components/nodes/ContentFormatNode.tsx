import { useContext } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeActionsContext } from '../Canvas';

function ContentFormatNode({ data, id, selected, style }: any) {
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
    <div className="relative group" style={style}>
      {/* Top + button */}
      <button
        onClick={(e) => handleDuplicate('top', e)}
        className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-purple-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-600 flex items-center justify-center text-sm font-bold shadow-md z-10"
      >
        +
      </button>

      {/* Node content */}
      <div className={`px-2 py-1 bg-purple-100 border-2 rounded-lg w-[150px] h-[80px] overflow-hidden flex items-center ${isSelected ? 'border-purple-700 bg-purple-200' : 'border-purple-500'}`}>
        <Handle type="target" position={Position.Left} />

        <div className="flex items-center gap-2 w-full">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-purple-900 text-xs leading-tight truncate">{data.label}</div>
            <div className="text-xs text-purple-600 truncate">
              {data.config.mappedContentType || '콘텐츠 유형'}
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
