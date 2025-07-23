// src/screens/StartScreen.tsx

import React from 'react';
import StyledButton from '../components/StyledButton'; // 共通ボタンをインポート
import './StartScreen.css';

// このコンポーネントが受け取るPropsの型定義
interface StartScreenProps {
  title: string,
  onCreateRoom: () => void; // ルーム作成モーダル表示用の関数
  onFindRoom: () => void;   // ルーム検索モーダル表示用の関数
  onExpMurder: () => void;  // マーダーミステリーの説明モーダル用の関数
}

const StartScreen: React.FC<StartScreenProps> = ({ title, onCreateRoom, onFindRoom, onExpMurder }) => {
  return (
    <div className="start-container">
      <h1 className="game-title">マーダーミステリー<br/ >{title}</h1>
      <div className="button-group">
        <StyledButton onClick={onCreateRoom} className="start-button">
          ルームを立てる
        </StyledButton>
        <StyledButton onClick={onFindRoom} className="start-button">
          ルームを探す
        </StyledButton>
      </div>
      <div className="button-group">
        <StyledButton onClick={onExpMurder} className="exp-muerder">
          マーダーミステリーとは？
        </StyledButton>
      </div>
    </div>
  );
};

export default StartScreen;