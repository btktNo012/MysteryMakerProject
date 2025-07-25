// src/screens/IndividualStoryScreen.tsx
import React from 'react';
import TextRenderer from '../components/TextRenderer';
import StyledButton from '../components/StyledButton';
import { type Character } from '../types';
import './IndividualStoryScreen.css';

interface IndividualStoryScreenProps {
  character: Character;
  onBack: () => void;
  onNext: () => void;
  isMaster: boolean;
}

const IndividualStoryScreen: React.FC<IndividualStoryScreenProps> = ({ character, onBack, onNext, isMaster }) => {
  if (!character.storyFile) {
    return <div>ストーリー情報がありません。</div>;
  }

  return (
    <div className="individual-story-container">
      <h1>ハンドアウト読み込み：個別ストーリー【{character.name}】</h1>
      
      <div className="individual-story-content">
        <div className="main-content-wrapper">
          <div className="ho-left-panel">
            <div className="story-content-area">
              <TextRenderer filePath={character.storyFile} />
              {character.goals && character.goals.length > 0 && (
                <div className="goals-section">
                  <h2 className="goals-title">あなたの目的</h2>
                  <ul className="goals-list">
                    {character.goals.map((goal, index) => (
                      <li key={index} className="goal-item">
                        {goal.text} ({goal.points}点)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="ho-right-panel">
            <h2 className="map-title">現場見取り図</h2>
            {character.mapImageFile && (
              <img 
                src={character.mapImageFile} 
                alt="現場見取り図" 
                className="map-image"
              />
            )}
          </div>
        </div>
        <div className='note'>※ハンドアウトの内容は議論フェイズでも確認できます</div>
      </div>

      <div className="navigation-area">
        <StyledButton onClick={onBack}>
          BACK
        </StyledButton>
        {isMaster && (
          <StyledButton onClick={onNext}>
            第一議論フェイズへ
          </StyledButton>
        )}
      </div>
    </div>
  );
};

export default IndividualStoryScreen;