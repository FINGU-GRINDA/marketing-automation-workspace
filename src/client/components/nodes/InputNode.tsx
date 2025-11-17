import { Handle, Position } from 'reactflow';

function InputNode({ data }: any) {
  return (
    <div className="px-4 py-3 bg-green-100 border-2 border-green-500 rounded-lg min-w-[150px]">
      <div className="font-semibold text-green-900">{data.label}</div>
      <div className="text-xs text-green-700 mt-1">
        {data.config.topic || '입력 대기 중...'}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default InputNode;
