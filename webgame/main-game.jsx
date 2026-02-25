import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Sử dụng lại CSS chính (Tailwind)
import GameApp from './GameApp';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GameApp />
  </React.StrictMode>
);
