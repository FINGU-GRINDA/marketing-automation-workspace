import { memo } from 'react';
import { NodeResizer } from 'reactflow';

interface CanvasBoxNodeProps {
  data: {
    label: string;
  };
  selected: boolean;
}

function CanvasBoxNode({ data, selected }: CanvasBoxNodeProps) {
  return (
    <>
      <NodeResizer
        color="#94a3b8"
        isVisible={selected}
        minWidth={200}
        minHeight={150}
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom right, rgba(241, 245, 249, 0.6), rgba(226, 232, 240, 0.6))',
          border: '2px solid rgb(203, 213, 225)',
          borderRadius: '8px',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
            background: 'rgba(226, 232, 240, 0.4)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgb(51, 65, 85)' }}>
            {data.label || '박스'}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 42px)',
            padding: '16px',
            fontSize: '12px',
            color: 'rgb(148, 163, 184)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ opacity: 0.5 }}>노드를 이 박스 위에 배치하세요</span>
        </div>
      </div>
    </>
  );
}

export default memo(CanvasBoxNode);
