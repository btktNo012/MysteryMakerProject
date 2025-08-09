// src/screens/InfoDisplayScreen.tsx

import React, { useRef, useEffect } from 'react';
import TextRenderer from '../components/TextRenderer';
import StyledButton from '../components/StyledButton';
import './InfoDisplayScreen.css'; // 共通スタイルをインポート

// この汎用コンポーネントが受け取るPropsの型定義
interface InfoDisplayScreenProps {
  title: string;      // 画面のタイトル (例: "あらすじ", "共通情報")
  filePath: string;   // 表示するテキストファイルのパス
  onBackFlg: boolean; // 前に戻るボタン有無フラグ（true:前に戻るボタン表示あり、false:前に戻るボタン表示なし）
  onBack: () => void; // 前に戻るための関数
  onNext: () => void; // 次へ進むための関数
}

const InfoDisplayScreen: React.FC<InfoDisplayScreenProps> = ({ title, filePath, onBackFlg, onBack, onNext }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [filePath]);
  return (
    <div className="info-screen-container">
      <h1 className="info-screen-title">{title}</h1>
      <div ref={scrollRef} className="info-screen-content">
        <TextRenderer filePath={filePath} />
      </div>
      <div className="navigation-area">
        {onBackFlg && (
          <StyledButton onClick={onBack}>
            BACK
          </StyledButton>
        )}
        <StyledButton onClick={onNext}>
          NEXT
        </StyledButton>
      </div>
    </div>
  );
};

export default React.memo(InfoDisplayScreen);