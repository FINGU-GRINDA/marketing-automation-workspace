import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode 제거: 노드 드래그 시 재렌더링 경고 억제 (사용자 요청)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
