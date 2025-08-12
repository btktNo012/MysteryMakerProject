import React, { useState, useMemo, useEffect } from 'react';
import type { Character, InfoCard, Player, DiscussionTimer, ScenarioData, CharacterSelections, GameLogEntry } from '../types';
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
  onUseSkill: (skillId: string | null) => void; // スキル使用
  gameLog: GameLogEntry[];
  hideControls?: boolean; // フッター移行のため画面内のタイマー・操作を隠す
  howtoTrigger?: number; // フッター「この画面について」のトリガー
}

const evaluateConditions = (card: InfoCard, players: Player[], characterSelections: CharacterSelections): boolean => {
  if (!card.conditionalInfo) {
    return true; // 条件がなければ常にtrue
  }

  const { conditions, andOr } = card.conditionalInfo;
  if (!conditions || conditions.length === 0) {
    return true; // 条件が空なら常にtrue
  }

  const results = conditions.map(condition => {
    if (condition.type === 'type_owner') {
      // 'id'で指定されたキャラクターがこのカードを所有しているか
      const ownerPlayer = players.find(p => p.userId === card.owner);
      if (!ownerPlayer) return false;
      const characterId = Object.keys(characterSelections).find(
        key => characterSelections[key] === ownerPlayer.userId
      );
      return characterId === condition.id;
    } else if (condition.type === 'type_first_ownew') {
      // 最初の所有者を取得
      const firstOwnerPlayer = players.find(p => p.userId === card.firstOwner);
      // 最初の所有者が存在しない場合はfalse
      if (!firstOwnerPlayer) return false;
      // キャラクターIDを取得
      const characterId = Object.keys(characterSelections).find(
        key => characterSelections[key] === firstOwnerPlayer.userId
      );
      // キャラクターIDが一致する場合true
      return characterId === condition.id;
    } else if (condition.type === 'type_public') {
      // 全体に共有されているか
      return card.isPublic;
    }
    return false;
  });

  if (andOr === 'AND') {
    return results.every(result => result);
  } else {
    return results.some(result => result);
  }
};


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
                {char.name}（{char.nameRuby}）
                {char.type === 'PC' && (
                  <span style={{ fontSize: '0.9em', color: '#888', marginLeft: '8px' }}>
                    {playerName || '未選択'}
                  </span>
                )}
                <span style={{ fontSize: '0.8em', color: '#777' }}>({char.type})</span>
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
  onConfirmEnd,
  onUseSkill,
  gameLog,
  hideControls,
  howtoTrigger
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(discussionTime);
  const [selectedCard, setSelectedCard] = useState<InfoCard | null>(null);
  const [isCardDetailModalOpen, setIsCardDetailModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGetCardConfirmModalOpen, setIsGetCardConfirmModalOpen] = useState(false);
  const [cardToGet, setCardToGet] = useState<InfoCard | null>(null);
  const [isRightPanelWide, setIsRightPanelWide] = useState(false);

  const isMaster = myPlayer.isMaster;
  const userId = myPlayer.userId;

  const logContainerRef = React.useRef<HTMLDivElement>(null);
  // ガイド表示用の状態
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0); // 0..4

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameLog]);

  // フッターからのHowToトリガーで開始
  useEffect(() => {
    if (howtoTrigger !== undefined) {
      setIsTourActive(true);
      setTourStep(0);
    }
  }, [howtoTrigger]);

  const highlight = (name: 'skills' | 'info' | 'log' | 'right'): boolean => {
    if (!isTourActive) return false;
    if (tourStep === 1 && name === 'skills') return true;
    if (tourStep === 2 && name === 'info') return true;
    if (tourStep === 3 && name === 'log') return true;
    if (tourStep === 4 && name === 'right') return true;
    return false;
  };

  const closeTour = () => setIsTourActive(false);
  const prevStep = () => setTourStep(s => Math.max(0, s - 1));
  const nextStep = () => setTourStep(s => Math.min(4, s + 1));

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
  const { getCardLimit, allTabItems, acquiredCardCount } = useMemo(() => {
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
  const handleCardClick = (card: InfoCard) => {
    if (!card.owner) {
      if (!discussionTimer.endTime) {
        alert('議論が開始されるまで取得できません！');
        return;
      }
      // サーバー側で上限チェックを行うため、クライアント側では常に取得要求を出す
      setCardToGet(card);
      setIsGetCardConfirmModalOpen(true);
    } else if (card.owner === userId || card.isPublic) {
      setSelectedCard(card);
      setIsCardDetailModalOpen(true);
    }
  };

  // 情報カード取得イベントハンドラ
  const handleConfirmGetCard = () => {
    if (cardToGet) {
      // サーバーにカード取得要求を送信
      onGetCard(cardToGet.id);
    }
    // モーダルを閉じる
    setIsGetCardConfirmModalOpen(false);
    // 参照中のカードをリセット
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
    if (selectedCard) {
      setIsTransferModalOpen(true);
    }
  }

  const handleTransferConfirm = (targetUserId: string) => {
    if (selectedCard) {
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
      {isTourActive && (
        <div className="tour-overlay" onClick={closeTour} />
      )}
      <div className="discussion-left-panel">
        {myPlayer.skills && myPlayer.skills.length > 0 && (
          <div className={`skills-section${highlight('skills') ? ' tour-highlight' : ''}`}>
            <div className='discussion-header'>キャラクター：{character.name}のスキル</div>
            <ul className="skills-list">
              {myPlayer.skills.map((skill, index) => (
                <li key={index} className={`skill-type-${skill.type}`}>
                  <div className='skill-text'>
                    <div className='skill-name'>{skill.name}</div>
                    <div className='skill-description'>{skill.description}</div>
                  </div>
                  {skill.type === 'active' &&
                    <button
                      className={`skill-activation-button ${skill.used ? 'used' : ''}`}
                      onClick={() => discussionTimer.endTime && !skill.used && onUseSkill(skill.id)}
                      disabled={skill.used}
                    >
                      {skill.used ? '使用済' : '使用する'}
                    </button>}
                </li>
              ))}
            </ul>
          </div>)}
        <div className={`info-cards-section${highlight('info') ? ' tour-highlight' : ''}`}>
          <div className="info-cards-header">
            <div className='discussion-header'>情報カード</div>
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
        <div className={`game-log-section${highlight('log') ? ' tour-highlight' : ''}`}>
          <div className="game-log-content" ref={logContainerRef}>
            {gameLog.map((log, index) => (
              <div key={index} className={`log-entry log-type-${log.type}`}>{log.message}</div>
            ))}
          </div>
        </div>
      </div>

      <div className={`discussion-right-panel${isRightPanelWide ? ' wide' : ''}${highlight('right') ? ' tour-highlight' : ''}`}>
        {/* 幅切り替えボタン */}
        <button
          className="right-panel-toggle-tab"
          onClick={() => setIsRightPanelWide(w => !w)}
          aria-label={isRightPanelWide ? '縮小' : '拡大'}
        >
          {isRightPanelWide ? '▶' : '◀'}
        </button>
        <div className="main-content">
          <Tabs items={allTabItems} />
        </div>
        {!hideControls && (
        <div className="discussion-footer">
          <div className="timer-wrapper">
            <Timer
              initialSeconds={remainingSeconds}
              isTicking={discussionTimer.isTicking}
              onTimeUp={() => { }} // サーバー側で処理
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
                  <StyledButton onClick={onRequestEnd} style={{ backgroundColor: '#f44336' }}>
                    議論強制終了
                  </StyledButton>
                )}
              </>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 下部メッセージ欄 */}
      {isTourActive && (tourStep === 0 || tourStep === 1 || tourStep === 2 || tourStep === 4) && (
        <div className={`tour-panel tour-panel-bottom show`}>
          <div className="tour-panel-inner">
            <div className="tour-text">
              {tourStep === 0 && (
                <>この画面ではスキル、情報カード、ゲームログ、右パネルの操作ができます。順に説明します。<br />NEXTで進みます。</>
              )}
              {tourStep === 1 && (
                <>スキル欄です。あなたのキャラクターが使えるスキルの内容と使用状況を確認できます。アクティブスキルは「使用する」から発動します。</>
              )}
              {tourStep === 2 && (
                <>情報カード欄です。クリックでカードの内容を表示し、所持中は公開・譲渡ができます。取得上限や公開状態もここで確認します。</>
              )}
              {tourStep === 4 && (
                <>右パネルです。タブで共通情報や個別ストーリーなどを切り替えられます。幅の拡大・縮小も可能です。</>
              )}
            </div>
            <div className="tour-actions">
              {tourStep > 0 && <button className="tour-btn" onClick={prevStep}>BACK</button>}
              {tourStep < 4 && <button className="tour-btn primary" onClick={nextStep}>NEXT</button>}
              {tourStep === 4 && <button className="tour-btn danger" onClick={closeTour}>CLOSE</button>}
            </div>
          </div>
        </div>
      )}

      {/* 上部メッセージ欄 */}
      {isTourActive && tourStep === 3 && (
        <div className={`tour-panel tour-panel-top show`}>
          <div className="tour-panel-inner">
            <div className="tour-text">ゲームログです。カード取得や公開、譲渡、フェーズ開始などの履歴が表示されます。状況の共有に役立ちます。</div>
            <div className="tour-actions">
              <button className="tour-btn" onClick={prevStep}>BACK</button>
              <button className="tour-btn primary" onClick={nextStep}>NEXT</button>
            </div>
          </div>
        </div>
      )}

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
            <p className="modal-card-content">{selectedCard.content}</p>
            {selectedCard.conditionalInfo && (
              evaluateConditions(selectedCard, players, characterSelections) ?
                selectedCard.conditionalInfo.trueInfo && (<p className="modal-card-content card-true-info">{selectedCard.conditionalInfo.trueInfo}</p>)
                : selectedCard.conditionalInfo.falseInfo && (<p className="modal-card-content card-false-info">{selectedCard.conditionalInfo.falseInfo}</p>)
            )}
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
