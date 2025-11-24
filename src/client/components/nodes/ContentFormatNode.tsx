import { memo, useContext } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeActionsContext } from '../Canvas';

function ContentFormatNode({ data, id, selected, style }: any) {
  const nodeActions = useContext(NodeActionsContext);
  const isSelected = data.selected ?? false; // undefined 처리를 위해 ?? 사용

  
  const handleDuplicate = (position: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeActions) {
      nodeActions.duplicateNode(id, position);
    } else {
      console.log('🟣 nodeActions is null!');
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    console.log('🟣 Checkbox clicked for node:', data.label, 'current selected:', isSelected);
    console.log('🟣 checkbox checked value:', e.target.checked);
    console.log('🟣 nodeActions exists:', !!nodeActions);

    if (nodeActions) {
      console.log('🟣 Calling toggleFormatSelection...');
      nodeActions.toggleFormatSelection(id);
    } else {
      console.error('🟣 ERROR: nodeActions context is not available!');
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
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-3 h-3 text-purple-600 rounded focus:ring-purple-500 flex-shrink-0 cursor-pointer relative z-10"
            />
          </div>
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

export default memo(ContentFormatNode);
