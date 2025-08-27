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
  screenHowtoTrigger?: number; // フッター「この画面について」のトリガー
  isSpectator?: boolean; // 観戦者フラグ
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
  screenHowtoTrigger,
  isSpectator
}) => {
  const [selectedCard, setSelectedCard] = useState<InfoCard | null>(null);
  const [isCardDetailModalOpen, setIsCardDetailModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isGetCardConfirmModalOpen, setIsGetCardConfirmModalOpen] = useState(false);
  const [cardToGet, setCardToGet] = useState<InfoCard | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastWidthRef = React.useRef(0);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(0);
  const containerWidthRef = React.useRef(0);
  const pendingWidthRef = React.useRef(0);
  // 左パネルの幅（localStorageで復元）
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const RESIZER = 12;
    const MIN_LEFT = 280;
    const MIN_RIGHT = 320;
    const saved = localStorage.getItem('discussionLeftPanelWidth');
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) return n;
    }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const maxLeft = Math.max(MIN_LEFT, vw - MIN_RIGHT - RESIZER);
    const base = Math.floor(vw * 0.6);
    return Math.min(Math.max(base, MIN_LEFT), maxLeft);
  });
  const isMaster = myPlayer.isMaster;
  const userId = myPlayer.userId;
  const logContainerRef = React.useRef<HTMLDivElement>(null);
  // ガイド表示用の状態
  const [isTourActive, setIsTourActive] = useState(false);
  // 議論チュートリアルツアーのページング
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameLog]);

  // フッターからのHowToトリガーで開始
  // 観戦者はツアーを開始しない。初期マウント時(0)は開始しない。
  useEffect(() => {
    if (!isSpectator && (typeof screenHowtoTrigger === 'number') && screenHowtoTrigger > 0) {
      setIsTourActive(true);
      setTourStep(0);
    }
  }, [screenHowtoTrigger, isSpectator]);

  const highlight = (name: 'skills' | 'info' | 'log' | 'right'): boolean => {
    if (!isTourActive) return false;
    if (tourStep === 1 && name === 'info') return true;
    if (tourStep === 2 && name === 'skills') return true;
    if (tourStep === 3 && name === 'log') return true;
    if (tourStep === 4 && name === 'right') return true;
    return false;
  };

  const closeTour = () => setIsTourActive(false);
  const prevStep = () => setTourStep(s => Math.max(0, s - 1));
  const nextStep = () => setTourStep(s => Math.min(5, s + 1));



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
      // 議論が未開始（phaseがnull）の場合は取得不可
      if (!discussionTimer.phase) {
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

  // ドラッグ処理（差分計算 + rAFで描画同期）
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isResizing || !containerRef.current) return;
      const dx = e.clientX - startXRef.current; // 右へドラッグで左幅拡大
      let newWidth = startWidthRef.current + dx;
      // 左右の最小幅を担保
      const RESIZER = 12;
      const MIN_LEFT = 280;
      const MIN_RIGHT = 320;
      const maxLeft = Math.max(MIN_LEFT, containerWidthRef.current - MIN_RIGHT - RESIZER);
      if (newWidth < MIN_LEFT) newWidth = MIN_LEFT;
      if (newWidth > maxLeft) newWidth = maxLeft;

      // 左パネル幅を更新
      setLeftPanelWidth(newWidth);
    };

    // リサイズの終了
    const handleUp = () => {
      if (!isResizing) return;
      setIsResizing(false);
      // 最終幅を保存
      const toSave = pendingWidthRef.current || lastWidthRef.current || leftPanelWidth;
      try {
        localStorage.setItem('discussionLeftPanelWidth', String(toSave));
      } catch { }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);
    };
  }, [isResizing]);

  const onResizer = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    containerWidthRef.current = rect.width;
    startXRef.current = e.clientX;
    startWidthRef.current = leftPanelWidth;
    lastWidthRef.current = leftPanelWidth;
    pendingWidthRef.current = leftPanelWidth;
    // リサイズの開始
    try { (e.currentTarget as any).setPointerCapture?.(e.pointerId); } catch { }
    setIsResizing(true);
  };

  return (
    <div className={"discussion-screen" + (isResizing ? ' resizing' : '')} ref={containerRef}>
      {isTourActive && (
        <div className="tour-overlay" />
      )}
      <div className="discussion-left-panel" style={{ width: leftPanelWidth }}>
        {!isSpectator && myPlayer.skills && myPlayer.skills.length > 0 && (
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
                      onClick={() => discussionTimer.phase && !skill.used && onUseSkill(skill.id)}
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
            {!isSpectator && (
              <span>【情報取得トークン】残りのトークン: {getCardLimit - acquiredCardCount}／使用済みのトークン:{acquiredCardCount}</span>
            )}
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
                  onClick={() => { if (isSpectator && !card.isPublic) return; handleCardClick(card); }}
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

      <div className="vertical-resizer" onPointerDown={onResizer} role="separator" aria-orientation="vertical" aria-label="左パネルの幅を調整">
        <div className="resizer-hit" />
        <div className="resizer-separator" />
      </div>
      <div className={`discussion-right-panel${highlight('right') ? ' tour-highlight' : ''}`}>
        <div className="main-content">
          <Tabs items={allTabItems} />
        </div>
        {!hideControls && (
          <div className="discussion-footer">
            <div className="timer-wrapper">
              <Timer
                endTimeMs={discussionTimer.endTime}
                pausedRemainingMs={discussionTimer.remainingMs}
                isTicking={discussionTimer.isTicking}
                onTimeUp={() => { }} // サーバー側で処理
              />
            </div>
            <div className="buttons-wrapper">
              {(discussionTimer.phase !== null) && (
                <>
                  {discussionTimer.isTicking ? (
                    <StyledButton onClick={onPauseTimer}>一時停止</StyledButton>
                  ) : (
                    <StyledButton onClick={onResumeTimer} disabled={!(discussionTimer.remainingMs != null && discussionTimer.remainingMs > 0)}>
                      再開
                    </StyledButton>
                  )}
                </>
              )}
              {isMaster && (
                <>
                  {(discussionTimer.phase === null) && (
                    <StyledButton onClick={onStartTimer}>議論開始</StyledButton>
                  )}
                  {(discussionTimer.phase !== null) && (
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
      {isTourActive && (tourStep === 0 || tourStep === 1 || tourStep === 2 || tourStep === 4 || tourStep === 5) && (
        <div className={`tour-panel tour-panel-bottom show`}>
          <button className="tour-btn close" onClick={closeTour}>CLOSE</button>
          <div className="tour-actions">
            {tourStep > 0 && <button className="tour-btn back" onClick={prevStep}>◀ BACK</button>}
            {tourStep < 5 && <button className="tour-btn next" onClick={nextStep}>NEXT ▶</button>}
          </div>
          <div className="tour-panel-inner">
            <div className="tour-text">
              {tourStep === 0 && (
                <>
                  ここからは、得た情報をもとに事件の真相について他のプレイヤーと議論していきます。<br />
                  議論フェイズでは以下のことができます。<br />
                  ●情報カードの取得・確認・公開・譲渡<br />
                  ●キャラクター固有スキルの確認・使用<br />
                  ●ゲームログの確認<br />
                  ●これまでの情報の確認<br />
                  NEXTでそれぞれ確認していきましょう
                </>
              )}
              {tourStep === 1 && (
                <>
                  情報カードです。<br />
                  最初は誰も情報カードを取得していない状態ですが、議論フェイズごとに与えられる「情報取得トークン」を使い、事件現場にある手がかりを調査することができます。<br />
                  情報カードに対しては、以下のような状態があります。<br />
                  <br />
                  ●誰も所持していない情報カード<br />
                  誰も所有していない情報カードを押すと、情報カードを取得するかどうかの確認メッセージが開かれますので、「取得する」を押すことで自分が所持している状態にできます。<br />
                  （特に決められていない場合、自分の荷物を取得することもできます）<br />
                  <br />
                  ●自分が所持している情報カード<br />
                  自分が所持している情報カードをクリックすると、その情報カードの詳細を確認できます。<br />
                  他の人にも確認してもらいたい場合、「全体公開」を押すことで他のプレイヤーにも確認できるようにすることができます。<br />
                  また、「他の人に譲渡する」を押して自分以外に情報カードを譲渡することもできます。<br />
                  <br />
                  ●他の人が所持している情報カード<br />
                  全体公開してもらうまで、その詳細を確認することはできません。<br />
                  口頭で教えてもらうこともできますが、嘘をつかれてしまう可能性もあります。<br />
                  <br />
                  情報カードの取得に使えるトークンの数は右上の【情報取得トークン】から確認できます。<br />
                  使用していないトークンは議論フェイズが終了すると破棄されます。必ず使用しましょう。<br />
                </>
              )}
              {tourStep === 2 && (
                <>
                  キャラクターには、固有の「スキル」が与えられていることがあります。目的を果たすために有効に使いましょう。<br />
                  スキルには以下の種類があります。<br />
                  <br />
                  ●アクティブスキル<br />
                  アクティブスキルは、ゲーム中に一度だけ使用することができます。<br />
                  「使用する」ボタンを押すことで、効果を発揮します。<br />
                  <br />
                  ●パッシブスキル<br />
                  パッシブスキルはプレイヤーが行動しなくても常に発動し続けるスキルです。
                </>
              )}
              {tourStep === 4 && (
                <>
                  右側のパネルには今までの情報が種類ごとに記録されています。<br />
                  第一議論フェイズが終わった後に明かされる中間情報も、第二議論フェイズでは確認することができます。<br />
                  左右の境界線をドラッグして幅を調整することもできます。<br />
                </>
              )}
              {tourStep === 5 && (
                <>説明は以上です。議論はルームマスターが「議論開始」ボタンを押したら開始します。<br />議論の途中でタイマーを一時停止したい場合は一時停止ボタンで停止することができます。</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 上部メッセージ欄 */}
      {isTourActive && tourStep === 3 && (
        <div className={`tour-panel tour-panel-top show`}>
          <button className="tour-btn close" onClick={closeTour}>CLOSE</button>
          <div className="tour-actions">
            <button className="tour-btn back" onClick={prevStep}>◀ BACK</button>
            <button className="tour-btn next" onClick={nextStep}>NEXT ▶</button>
          </div>
          <div className="tour-panel-inner">
            <div className="tour-text">
              ゲームログです。<br />
              情報カードの取得、全体公開、譲渡や、アクティブスキルの発動、議論フェイズの開始といった履歴が記録されます。
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
              .filter(p => !p.isSpectator)
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
