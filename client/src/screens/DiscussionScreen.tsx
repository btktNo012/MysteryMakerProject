import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Character, InfoCard, Player, DiscussionTimer, ScenarioData, CharacterSelections } from '../types';
import Timer from '../components/Timer';
import Modal from '../components/Modal';
import Tabs, { type TabItem } from '../components/Tabs';
import StyledButton from '../components/StyledButton';
import './DiscussionScreen.css';

interface DiscussionScreenProps {
  title: string;
  gamePhase: 'firstDiscussion' | 'secondDiscussion';
  character: Character;
  tabItems: TabItem[];
  discussionTime: number; // 初期時間（秒）
  infoCards: InfoCard[];
  players: Player[];
  myPlayer: Player;
  scenarioData: ScenarioData;
  characterSelections: CharacterSelections;
  onGetCard: (cardId: string) => void;
  onMakeCardPublic: (cardId: string) => void;
  onTransferCard: (cardId: string, targetUserId: string) => void;
  discussionTimer: DiscussionTimer;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onRequestEnd: () => void; // 強制終了要求
  onCancelEnd: () => void;  // 強制終了キャンセル
  onConfirmEnd: () => void; // 強制終了確定
}

// 新しいコンポーネント
const CharacterListTab: React.FC<{
  characters: Character[];
  players: Player[];
  characterSelections: CharacterSelections;
}> = ({ characters, players, characterSelections }) => {

  const getPlayerNameByUserId = (userId: string | null) => {
    if (!userId) return null;
    const player = players.find(p => p.userId === userId);
    return player ? player.name : null;
  };

  return (
    <div className="character-list-tab">
      {characters.map(char => {
        const selectedUserId = characterSelections[char.id];
        const playerName = getPlayerNameByUserId(selectedUserId || null);
        return (
          <div key={char.id} className="character-item">
            {char.imageFile && <img src={char.imageFile} alt={char.name} className="character-item-image" />}
            <div className="character-item-details">
            <h4>
              {char.name}
              {char.type === 'PC' && (
                <span style={{ fontSize: '0.9em', color: '#888', marginLeft: '8px' }}>
                  {playerName || '未選択'}
                </span>
              )}
              <span style={{fontSize: '0.8em', color: '#777'}}>({char.type})</span>
            </h4>
              <p className="character-profile">{char.profile}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DiscussionScreen: React.FC<DiscussionScreenProps> = ({ 
  title, 
  gamePhase,
  character, 
  tabItems, 
  discussionTime, 
  infoCards, 
  players,
  myPlayer,
  scenarioData, 
  characterSelections,
  onGetCard,
  onMakeCardPublic,
  onTransferCard,
  discussionTimer,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onRequestEnd,
  onCancelEnd,
  onConfirmEnd
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(discussionTime);
  const [selectedCard, setSelectedCard] = useState<InfoCard | null>(null);
  const [isCardDetailModalOpen, setIsCardDetailModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGetCardConfirmModalOpen, setIsGetCardConfirmModalOpen] = useState(false);
  const [cardToGet, setCardToGet] = useState<InfoCard | null>(null);

  const isMaster = myPlayer.isMaster;
  const userId = myPlayer.userId;

  // --- タイマーロジック ---
  useEffect(() => {
    const { endTime, isTicking, endState } = discussionTimer;

    // 時間切れの場合、残り時間を0に設定して終了
    if (endState === 'timeup') {
      setRemainingSeconds(0);
      return;
    }

    if (!isTicking || !endTime) {
      if (endTime && !isTicking) {
        // 一時停止中：残り時間を保持
        setRemainingSeconds(Math.round(endTime / 1000));
      } else {
        // 初期状態
        setRemainingSeconds(discussionTime);
      }
      return;
    }

    // タイマー作動中
    const intervalId = setInterval(() => {
      const now = Date.now();
      const diff = Math.round((endTime - now) / 1000);
      setRemainingSeconds(diff > 0 ? diff : 0);
      if (diff <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [discussionTimer, discussionTime]);


  // --- メモ化された計算 ---
  const { getCardLimit, canGetMoreCards, allTabItems, acquiredCardCount } = useMemo(() => {
    const phaseKey = gamePhase;
    const acquiredCardCount = myPlayer.acquiredCardCount[phaseKey] ?? 0;
    const getCardLimit = scenarioData.discussionPhaseSettings[phaseKey]?.maxCardsPerPlayer ?? 99;
    const canGetMoreCards = acquiredCardCount < getCardLimit;

    const allTabItems = [
      ...tabItems,
      {
        label: '登場人物一覧',
        content: <CharacterListTab 
                    characters={scenarioData.characters} 
                    players={players} 
                    characterSelections={characterSelections} 
                 />
      }
    ];

    return { getCardLimit, canGetMoreCards, allTabItems, acquiredCardCount };
  }, [myPlayer, gamePhase, scenarioData, tabItems, players, characterSelections]);

  // --- イベントハンドラ ---
  const handlePauseResume = () => {
    if (discussionTimer.isTicking) {
      onPauseTimer();
    } else {
      onResumeTimer();
    }
  };

  const handleCardClick = (card: InfoCard) => {
    if (!card.owner) {
      // サーバー側で上限チェックを行うため、クライアント側では常に取得要求を出す
      setCardToGet(card);
      setIsGetCardConfirmModalOpen(true);
    } else if (card.owner === userId || card.isPublic) {
      setSelectedCard(card);
      setIsCardDetailModalOpen(true);
    }
  };

  const handleConfirmGetCard = () => {
    if (cardToGet) {
      onGetCard(cardToGet.id);
    }
    setIsGetCardConfirmModalOpen(false);
    setCardToGet(null);
  }

  const closeCardDetailModal = () => {
    setIsCardDetailModalOpen(false);
    setSelectedCard(null);
  }

  const handleMakePublicClick = () => {
    if (selectedCard) {
      onMakeCardPublic(selectedCard.id);
      closeCardDetailModal();
    }
  }

  const handleTransferClick = () => {
    if(selectedCard){
      setIsTransferModalOpen(true);
    }
  }

  const handleTransferConfirm = (targetUserId: string) => {
    if(selectedCard){
      onTransferCard(selectedCard.id, targetUserId);
      setIsTransferModalOpen(false);
      closeCardDetailModal();
    }
  }

  const getOwnerDisplayName = (ownerUserId: string | null): string => {
    if (!ownerUserId) return 'なし';

    const ownerPlayer = players.find(p => p.userId === ownerUserId);
    if (!ownerPlayer) return '不明';

    const characterId = Object.keys(characterSelections).find(
      key => characterSelections[key] === ownerUserId
    );
    const character = scenarioData.characters.find(c => c.id === characterId);

    const characterName = character ? character.name : 'キャラクター未選択';
    return `${characterName}@${ownerPlayer.name}`;
  };

  return (
    <div className="discussion-screen">
      <div className="discussion-left-panel">
        <div className="character-info-discussion">
            <h3>{character.name}</h3>
            <div className="goals-section">
                <h4>あなたの目的</h4>
                {character.goals && character.goals.length > 0 ? (
                <ul>
                    {character.goals.map((goal, index) => (
                    <li key={index}>{goal.text} ({goal.points}点)</li>
                    ))}
                </ul>
                ) : <p>目的はありません。</p>}
            </div>
        </div>
        <div className="info-cards-section">
            <div className="info-cards-header">
                <h4>情報カード</h4>
                <span>取得済み: {acquiredCardCount} / {getCardLimit}</span>
            </div>
            <div className="discussion-info-cards-list">
              {infoCards.map(card => {
                const ownerName = getOwnerDisplayName(card.owner);
                let cardClassName = 'info-card';
                if (card.isPublic) {
                  cardClassName += ' public';
                } else if (card.owner === userId) {
                  cardClassName += ' owned-by-me';
                } else if (card.owner) {
                  cardClassName += ' owned-by-other';
                }

                return (
                  <div 
                    key={card.id} 
                    className={cardClassName}
                    onClick={() => handleCardClick(card)}
                  >
                    {card.iconFile && <img src={card.iconFile} alt={card.name} className="info-card-icon" />}
                    <div className="info-card-name">{card.name}</div>
                    <div className="info-card-owner">所有者: {ownerName}</div>
                    {card.owner && (
                      <div className={`info-card-status ${card.isPublic ? 'public' : 'private'}`}>
                        {card.isPublic ? '全体公開' : '非公開'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
      </div>

      <div className="discussion-right-panel">
        <div className="main-content">
            <Tabs items={allTabItems} />
        </div>
        <div className="discussion-footer">
            <div className="timer-wrapper">
                <Timer 
                    initialSeconds={remainingSeconds}
                    isTicking={discussionTimer.isTicking}
                    onTimeUp={() => {}} // サーバー側で処理
                />
            </div>
            <div className="buttons-wrapper">
                {discussionTimer.endTime && (
                    <>
                        {discussionTimer.isTicking ? (
                            <StyledButton onClick={onPauseTimer}>一時停止</StyledButton>
                        ) : (
                            <StyledButton onClick={onResumeTimer}>再開</StyledButton>
                        )}
                    </>
                )}
                {isMaster && (
                    <>
                        {!discussionTimer.endTime && (
                            <StyledButton onClick={onStartTimer}>議論開始</StyledButton>
                        )}
                        {discussionTimer.endTime && (
                            <StyledButton onClick={onRequestEnd} style={{backgroundColor: '#f44336'}}>
                                議論強制終了
                            </StyledButton>
                        )}
                    </>
                )}
            </div>
        </div>
      </div>
      
      <Modal
        isOpen={isGetCardConfirmModalOpen}
        message={`情報カード「${cardToGet?.name}」を取得しますか？`}
        onConfirm={handleConfirmGetCard}
        onClose={() => setIsGetCardConfirmModalOpen(false)}
        confirmButtonText="取得する"
        closeButtonText="キャンセル"
      />

      {selectedCard && (
        <Modal
          isOpen={isCardDetailModalOpen}
          message={`【${selectedCard.name}】`}
          onClose={closeCardDetailModal}
          closeButtonText="閉じる"
        >
          <div className="modal-message">
            <p>{selectedCard.content}</p>
            {selectedCard.owner === userId && (
              <div className="card-actions">
                {!selectedCard.isPublic && (
                  <StyledButton onClick={handleMakePublicClick}>全体に公開する</StyledButton>
                )}
                <StyledButton onClick={handleTransferClick}>他の人に譲渡する</StyledButton>
              </div>
            )}
          </div>
        </Modal>
      )}

      {selectedCard && (
         <Modal
          isOpen={isTransferModalOpen}
          message={`「${selectedCard.name}」を誰に渡しますか？`}
          onClose={() => setIsTransferModalOpen(false)}
          closeButtonText="キャンセル"
        >
          <div className="transfer-player-list">
            {players
              .filter(p => p.userId !== userId) //自分以外
              .map(player => (
                <StyledButton key={player.userId} onClick={() => handleTransferConfirm(player.userId)}>
                  {getOwnerDisplayName(player.userId)}
                </StyledButton>
              ))}
          </div>
        </Modal>
      )}

      {/* ルームマスター用：議論強制終了確認モーダル */}
      {isMaster && discussionTimer.endState === 'requested' && (
        <Modal
          isOpen={true}
          message="議論を終了します。よろしいですか？"
          onConfirm={onConfirmEnd}
          onClose={onCancelEnd}
          confirmButtonText="YES"
          closeButtonText="NO"
        />
      )}

      {/* ルームマスター以外用：ルームマスター操作中モーダル */}
      {!isMaster && discussionTimer.endState === 'requested' && (
        <Modal
          isOpen={true}
          message="ルームマスターが操作中です..."
          onConfirm={undefined} // 操作不可
          onClose={undefined}   // 操作不可
          confirmButtonText="OK"
          closeButtonText="キャンセル"
        />
      )}

      {/* 全員用：議論時間終了モーダル */}
      {discussionTimer.endState === 'timeup' && (
        <Modal
          isOpen={true}
          message="議論が終了しました"
          onConfirm={isMaster ? onConfirmEnd : undefined} // マスターのみ操作可能
          confirmButtonText={isMaster ? "OK" : undefined}
        />
      )}
    </div>
  );
};

export default DiscussionScreen;
