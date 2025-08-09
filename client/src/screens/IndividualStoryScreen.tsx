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
            <div className="story-content-area">
              <TextRenderer filePath={character.storyFile} />
              {character.goals && character.goals.length > 0 && (
                <div className="goals-section">
                  <h2 className="goals-title">あなたの目的</h2>
                  <ul className="goals-list">
                    {character.goals.map((goal, index) => (
                      <li key={index} className="goal-item">
                        {goal.text} ({goal.points}点)
                        <ul><li>{goal.hint}</li></ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <h4 className="map-title">現場見取り図</h4>
              {character.mapImageFile && (
                <img
                  src={character.mapImageFile}
                  alt="現場見取り図"
                  className="map-image"
                />
              )}
              {character.skills && character.skills.length > 0 && (
                <div className="skills-section">
                  <h4>スキル</h4>
                  <div>あなたのキャラクターには、固有のスキルが設定されています。目標を達成したり真実を追求するのに活用していきましょう</div>
                  <ul className="skills-list">
                    {character.skills.map((skill, index) => (
                      <li key={index} className={`skill-type-${skill.type}`}>
                        <div className='skill-text'>
                          <div className='skill-name'>{skill.name}</div>
                          <div className='skill-description'>{skill.description}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>)}
            </div>
        </div>
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

export default React.memo(IndividualStoryScreen);