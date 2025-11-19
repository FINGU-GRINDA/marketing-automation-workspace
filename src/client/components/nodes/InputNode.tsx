import { Handle, Position } from 'reactflow';

function InputNode({ data }: any) {
  return (
    <div className="px-2 py-1 bg-green-100 border-2 border-green-500 rounded-lg w-[150px] h-[80px] flex items-center">
      <div className="flex-1">
        <div className="font-semibold text-green-900 text-xs leading-tight truncate">{data.label}</div>
        <div className="text-xs text-green-700 truncate">
          {data.config.topic || '입력 대기 중...'}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default InputNode;
