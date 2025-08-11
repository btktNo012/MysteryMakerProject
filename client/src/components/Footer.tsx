import React from 'react';
import './Footer.css';
import { type GamePhase, type Player, type CharacterSelections, type DiscussionTimer, type Character } from '../types';
import StyledButton from '../components/StyledButton';
import Timer from './Timer';

interface OperationButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface FooterProps {
  currentPhase: GamePhase;
  players: Player[];
  myPlayer: Player | null;
  characters: Character[];
  characterSelections: CharacterSelections;
  readingTimerSeconds: number; // 0 if not active
  discussionTimer: DiscussionTimer;
  onHowTo: () => void;
  onSetStandBy: () => void;
  operationButtons: OperationButton[];
  onStartTimer?: () => void;
  onPauseTimer?: () => void;
  onResumeTimer?: () => void;
  onRequestEnd?: () => void;
}

const Footer: React.FC<FooterProps> = ({
  currentPhase,
  players,
  myPlayer,
  characters,
  characterSelections,
  readingTimerSeconds,
  discussionTimer,
  onHowTo,
  onSetStandBy,
  operationButtons,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onRequestEnd,
}) => {
  const isAfterCharacterSelect = ['commonInfo', 'individualStory', 'firstDiscussion', 'interlude', 'secondDiscussion', 'voting', 'ending', 'debriefing'].includes(currentPhase);

  const getCharacterNameByUserId = (userId: string | null): string | null => {
    if (!userId) return null;
    const charEntry = characters.find(c => characterSelections[c.id] === userId);
    return charEntry ? charEntry.name : null;
  };

  const showStandBy = ['commonInfo', 'individualStory', 'interlude'].includes(currentPhase) ||
    ((currentPhase === 'firstDiscussion' || currentPhase === 'secondDiscussion') && !discussionTimer.endTime);

  const isMaster = myPlayer?.isMaster;

  const showReadingTimer = readingTimerSeconds > 0;
  const showDiscussionTimer = !!discussionTimer.phase;
  const computeDiscussionSeconds = (): number => {
    if (!discussionTimer.endTime) return 0;
    if (discussionTimer.isTicking) {
      return Math.max(0, Math.round((discussionTimer.endTime - Date.now()) / 1000));
    }
    // paused: endTime holds remaining milliseconds
    return Math.max(0, Math.round(discussionTimer.endTime / 1000));
  };

  return (
    <footer className="app-footer" aria-label="footer">
      <div className="app-footer-inner">
        <div className="howto-area">
          <StyledButton onClick={onHowTo}>この画面について</StyledButton>
        </div>

        <div className="player-list-area">
          <strong>プレイヤーリスト</strong>
          {players.map(player => {
            const charName = isAfterCharacterSelect ? getCharacterNameByUserId(player.userId) : null;
            const isMe = myPlayer?.userId === player.userId;
            return (
              <div key={player.userId} className="player-row">
                <div className="player-name">{charName ? `${charName}@${player.name}` : player.name}</div>
                {showStandBy && (
                  isMe ? (
                    <button
                      className={`standby-button ${player.isStandBy ? 'complete' : ''}`}
                      onClick={onSetStandBy}
                      disabled={player.isStandBy}
                    >{player.isStandBy ? '準備完了！' : '準備中？'}</button>
                  ) : (
                    <div className={`standby-status ${player.isStandBy ? 'complete' : ''}`}>{player.isStandBy ? '準備完了！' : '準備中...'}</div>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="timer-area">
          {showReadingTimer && (
            <Timer initialSeconds={readingTimerSeconds} isTicking={true} onTimeUp={() => { }} />
          )}
          {!showReadingTimer && showDiscussionTimer && (
            <Timer initialSeconds={computeDiscussionSeconds()}
              isTicking={discussionTimer.isTicking}
              onTimeUp={() => { }} />
          )}
        </div>

        <div className="operation-btn-area">
          {(currentPhase === 'firstDiscussion' || currentPhase === 'secondDiscussion') && isMaster && (
            <>
              {!discussionTimer.endTime && onStartTimer && (
                <StyledButton onClick={onStartTimer}>議論開始</StyledButton>
              )}
              {discussionTimer.endTime && discussionTimer.isTicking && onPauseTimer && (
                <StyledButton onClick={onPauseTimer}>一時停止</StyledButton>
              )}
              {discussionTimer.endTime && !discussionTimer.isTicking && onResumeTimer && (
                <StyledButton onClick={onResumeTimer}>再開</StyledButton>
              )}
              {discussionTimer.endTime && onRequestEnd && (
                <StyledButton onClick={onRequestEnd} style={{ backgroundColor: '#f44336' }}>議論強制終了</StyledButton>
              )}
            </>
          )}
          {operationButtons.map((op, idx) => (
            <StyledButton key={idx} onClick={op.onClick} disabled={op.disabled}>{op.label}</StyledButton>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
