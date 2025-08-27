// src/screens/InfoDisplayScreen.tsx

import React, { useRef, useEffect } from 'react';
import TextRenderer from '../components/TextRenderer';
import './InfoDisplayScreen.css'; // 共通スタイルをインポート

// この汎用コンポーネントが受け取るPropsの型定義
interface InfoDisplayScreenProps {
  filePath: string;   // 表示するテキストファイルのパス
}

const InfoDisplayScreen: React.FC<InfoDisplayScreenProps> = ({ filePath }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filePath]);
  return (
    <div className="info-screen-container">
      <div ref={scrollRef} className="info-screen-content">
        <TextRenderer filePath={filePath} />
      </div>
    </div>
  );
};

export default React.memo(InfoDisplayScreen);
