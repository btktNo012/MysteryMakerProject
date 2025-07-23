// src/screens/DebriefingScreen.tsx
import React, { useState } from 'react';
import { type ScenarioData } from '../types';
import TextRenderer from '../components/TextRenderer';
import StyledButton from '../components/StyledButton';
import './DebriefingScreen.css';

interface DebriefingScreenProps {
  scenario: ScenarioData;
  isMaster: boolean;
  onCloseRoom: () => void;
}

const DebriefingScreen: React.FC<DebriefingScreenProps> = ({ scenario, isMaster, onCloseRoom }) => {
  // 表示するコンテンツのファイルパスを管理するState
  const [activeFile, setActiveFile] = useState<string | null>(null);
  // アクティブなボタンを識別するためのState
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { mainCommentary, characterEndings } = scenario.debriefing;
  
  // 表示するコンテンツのリストを結合
  const allContents = [
    { id: 'main', ...mainCommentary },
    ...characterEndings
  ];

  const handleButtonClick = (file: string, id: string) => {
    setActiveFile(file);
    setActiveId(id);
  };

  // Xへの投稿用関数
  const handleShareToX = () => {
    const scenarioTitle = scenario.title;
    const text = `マーダーミステリー『${scenarioTitle}』をプレイしました！\n\n#マダミス #マーダーミステリー\n#${scenarioTitle.replace(/\s/g, '')}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="debriefing-container">
      <h1>感想戦</h1>
      <div className="debriefing-wrapper">
        {/* --- 左パネル (ボタン) --- */}
        <div className="control-panel">
          {allContents.map(content => (
            <button
              key={content.id || content.title}
              className={`control-button ${activeId === (content.id || content.title) ? 'active' : ''}`}
              onClick={() => handleButtonClick(content.file, (content.id || content.title))}
            >
              {content.title}
            </button>
          ))}
          <div className="social-share">
            <StyledButton onClick={handleShareToX}>
              Xで感想をシェアする
            </StyledButton>
          </div>
          {isMaster && (
            <div className="room-close-action">
                <StyledButton onClick={onCloseRoom} style={{ backgroundColor: '#f44336' }}>
                    解散して最初の画面に戻る
                </StyledButton>
            </div>
          )}
        </div>
        
        {/* --- 右パネル (コンテンツ表示) --- */}
        <div className="display-panel">
          {activeFile ? (
            <TextRenderer filePath={activeFile} />
          ) : (
            <p>左のボタンを押して、解説や各エンディングを確認してください。</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebriefingScreen;