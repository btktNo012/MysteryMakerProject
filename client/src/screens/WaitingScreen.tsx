import React from 'react';
import StyledButton from '../components/StyledButton';
import type { Player } from '../types';
import './WaitingScreen.css';

interface WaitingScreenProps {
  roomId: string;
  players: Player[];
  isMaster: boolean;
  maxPlayers: number;
  onLeave: () => void;
  onClose: () => void;
  onStart: () => void;
}

const WaitingScreen: React.FC<WaitingScreenProps> = ({
  roomId,
  players,
  isMaster,
  maxPlayers,
  onLeave,
  onClose,
  onStart,
}) => {
  const canStart = players.length === maxPlayers;

  return (
    <div className="waiting-container">
      <h2>ルームID: {roomId}</h2>
      <p>ルームIDを参加者に通知してください</p>
      <p>参加者が揃うまでお待ちください... ({players.length}/{maxPlayers})</p>

      <div className="player-list">
        <h3>参加者:</h3>
        <ul>
          {players.map((player) => (
            <li key={player.id}>{player.name} {player.isMaster ? '(ルームマスター)' : ''}</li>
          ))}
        </ul>
      </div>

      <div className="button-group-waiting">
        {isMaster ? (
          <>
            <StyledButton onClick={onStart} disabled={!canStart}>
              ゲーム開始
            </StyledButton>
            <StyledButton onClick={onClose} className="leave-button">
              ルームを解散する
            </StyledButton>
          </>
        ) : (
          <StyledButton onClick={onLeave} className="leave-button">
            退室する
          </StyledButton>
        )}
      </div>
    </div>
  );
};

export default WaitingScreen;