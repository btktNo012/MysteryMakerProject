// src/screens/DebriefingScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { type ScenarioData, type InfoCard, type Player, type GameLogEntry } from '../types';
import TextRenderer from '../components/TextRenderer';
import StyledButton from '../components/StyledButton';
import Modal from '../components/Modal';
import './DebriefingScreen.css';
import './DiscussionScreen.css'; // 流用

interface DebriefingScreenProps {
  scenario: ScenarioData;
  infoCards: InfoCard[];
  players: Player[];
  gameLog: GameLogEntry[];
}

const DebriefingScreen: React.FC<DebriefingScreenProps> = ({ scenario, infoCards, players, gameLog }) => {
  const [activeContent, setActiveContent] = useState<'commentary' | 'infoCards' | 'goals' | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<InfoCard | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { mainCommentary, characterInfo } = scenario.debriefing;
  const allContents = [
    { id: 'main', ...mainCommentary },
    ...characterInfo
  ];

  const handleCommentaryButtonClick = (file: string, id: string) => {
    setActiveContent('commentary');
    setActiveFile(file);
    setActiveId(id);
  };

  const handleInfoCardsButtonClick = () => {
    setActiveContent('infoCards');
    setActiveFile(null);
    setActiveId('infoCards');
  };

  const handleGoalsButtonClick = () => {
    setActiveContent('goals');
    setActiveFile(null);
    setActiveId('goals');
  };

  const handleCardClick = (card: InfoCard) => {
    setSelectedCard(card);
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameLog]);

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return 'なし';
    const owner = players.find(p => p.userId === ownerId);
    return owner ? owner.name : '不明';
  };

  const handleShareToX = () => {
    const scenarioTitle = scenario.title;
    const text = `マーダーミステリー『${scenarioTitle}』をプレイしました！\n\n#マダミス #マーダーミステリー\n#${scenarioTitle.replace(/\s/g, '')}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="debriefing-container">
      <div className="debriefing-wrapper">
        <div className="control-panel">
          {allContents.map(content => (
            <button
              key={content.id || content.title}
              className={`control-button ${activeId === (content.id || content.title) ? 'active' : ''}`}
              onClick={() => handleCommentaryButtonClick(content.file, (content.id || content.title))}
            >
              {content.title}
            </button>
          ))}
          <button
            className={`control-button ${activeId === 'infoCards' ? 'active' : ''}`}
            onClick={handleInfoCardsButtonClick}
          >
            情報カード＆ゲームログ
          </button>
          <button
            className={`control-button ${activeId === 'goals' ? 'active' : ''}`}
            onClick={handleGoalsButtonClick}
          >
            得点計算
          </button>
          <div className="social-share">
            <StyledButton onClick={handleShareToX}>
              Xで感想をシェアする
            </StyledButton>
          </div>
        </div>
        
        <div className="display-panel">
          {activeContent === 'commentary' && activeFile && (
            <div className="panel-content-scroll">
              <TextRenderer filePath={activeFile} />
            </div>
          )}
          {activeContent === 'infoCards' && (
            <>
              <div className="debriefing-info-cards-list"> 
                {infoCards.map(card => (
                  <div key={card.id} className="info-card" onClick={() => handleCardClick(card)}>
                    {card.iconFile && <img src={card.iconFile} alt={card.name} className="info-card-icon" />}
                    <div className="info-card-name">{card.name}</div>
                    <div className="info-card-owner">
                      所有者: {getOwnerName(card.owner)}
                    </div>
                    <div className={`info-card-status ${card.isPublic ? 'public' : 'private'}`}>
                      {card.isPublic ? '全体公開' : '非公開'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="game-log-section">
                <div className="game-log-content" ref={logContainerRef}>
                  {gameLog.map((log, index) => (
                    <div key={index} className={`log-entry log-type-${log.type}`}>{log.message}</div>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeContent === 'goals' && (
            <div className="panel-content-scroll">
              <div className="goals-display">
                {scenario.characters.filter(c => c.type === 'PC').map(character => (
                  <div key={character.id} className="character-goals">
                    <h3>{character.name}</h3>
                    <ul>
                      {character.goals && character.goals.map((goal, index) => (
                        <li key={index}>{goal.text} ({goal.points}点)<ul><li>{goal.judge}</li></ul></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!activeContent && (
            <div className="panel-content-scroll">
              <p>左のボタンを押して、あとがきや各エンディング、情報カード＆ゲームログ、得点計算を確認してください。</p>
            </div>
          )}
        </div>
      </div>

      {selectedCard && (
        <Modal
          isOpen={true}
          message={selectedCard.name}
          onClose={() => setSelectedCard(null)}
          closeButtonText="閉じる"
        >
          <div className="modal-message" style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            <p className="modal-card-content">{selectedCard.content}</p>
            {selectedCard.conditionalInfo?.trueInfo && (<p className="modal-card-content card-true-info">{selectedCard.conditionalInfo.trueInfo}</p>)}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DebriefingScreen;
