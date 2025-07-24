// src/screens/StartScreen.tsx

import React from 'react';
import StyledButton from '../components/StyledButton'; // 共通ボタンをインポート
import './StartScreen.css';
import { APP_VERSION } from '../version'; // アプリのバージョンをインポート

// このコンポーネントが受け取るPropsの型定義
interface StartScreenProps {
  title: string;
  titleImage?: string;
  onCreateRoom: () => void; // ルーム作成モーダル表示用の関数
  onFindRoom: () => void;   // ルーム検索モーダル表示用の関数
  onExpMurder: () => void;  // マーダーミステリーの説明モーダル用の関数
}

const StartScreen: React.FC<StartScreenProps> = ({ title, titleImage, onCreateRoom, onFindRoom, onExpMurder }) => {
  const containerStyle = {
    backgroundImage: titleImage ? `url(${titleImage})` : 'none',
  };

  return (
    <div className="start-container" style={containerStyle}>
      <div className="start-content">
        <h1 className="game-title">マーダーミステリー<br/ >{title}</h1>
        <div className="button-group-start">
          <StyledButton onClick={onCreateRoom} className="start-button">
            ルームを立てる
          </StyledButton>
          <StyledButton onClick={onFindRoom} className="start-button">
            ルームに参加する
          </StyledButton>
        </div>
        <div className="button-group">
          <StyledButton onClick={onExpMurder} className="exp-muerder">
            マーダーミステリーとは？
          </StyledButton>
        </div>
      </div>
      <div className="version-label">
        version : {APP_VERSION} 
      </div>
    </div>
  );
};

export default StartScreen;