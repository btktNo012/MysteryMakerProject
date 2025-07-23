import React, { useState, useMemo } from 'react';
import type { Character, Player, VoteState, VoteResult } from '../types';
import StyledButton from '../components/StyledButton';
import './VotingScreen.css';

interface VotingScreenProps {
  characters: Character[];
  players: Player[];
  myPlayer: Player;
  voteState: VoteState;
  voteResult: VoteResult | null;
  onSubmitVote: (votedCharacterId: string) => void;
  onProceedToEnding: () => void;
}

const VotingScreen: React.FC<VotingScreenProps> = ({ 
  characters, 
  players,
  myPlayer,
  voteState,
  voteResult,
  onSubmitVote,
  onProceedToEnding
}) => {
  const [selectedVote, setSelectedVote] = useState<string>('');

  const myVote = voteState[myPlayer.userId];
  const totalPlayers = players.length;
  const votedPlayers = Object.keys(voteState).length;
  const isVotingConcluded = !!voteResult; // 投票が終了したかどうかのフラグ

  const getCharacterName = (charId: string) => characters.find(c => c.id === charId)?.name || '不明';

  const handleVoteClick = () => {
    if (selectedVote) {
      onSubmitVote(selectedVote);
    }
  };

  return (
    <div className="voting-screen">
      <h1>投票フェーズ</h1>
      {isVotingConcluded ? (
        <div className="voting-concluded-message">
          <h2>投票終了</h2>
          <p>投票が締め切られました。結果発表をお待ちください。</p>
        </div>
      ) : (
        <>
          <h2>投票</h2>
          <p>犯人だと思う人物に投票してください。</p>
          <div className="vote-selection-area">
            <div className="character-list">
              {characters.map(char => (
                <div 
                  key={char.id}
                  className={`character-card ${selectedVote === char.id ? 'selected' : ''} ${myVote ? 'disabled' : ''}`}
                  onClick={() => !myVote && setSelectedVote(char.id)}
                >
                  {char.name}
                </div>
              ))}
            </div>
            <StyledButton onClick={handleVoteClick} disabled={!selectedVote || !!myVote}>
              {myVote ? `投票済み: ${getCharacterName(myVote)}` : '投票する'}
            </StyledButton>
          </div>
        </>
      )}
      <div className="vote-status">
        <h3>現在の投票状況</h3>
        <p>{votedPlayers} / {totalPlayers} 人が投票済み</p>
        <ul>
          {players.map(p => (
            <li key={p.userId} className={voteState[p.userId] ? 'voted' : 'not-voted'}>
              {p.name}: {voteState[p.userId] ? '投票済み' : '未投票'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VotingScreen;
