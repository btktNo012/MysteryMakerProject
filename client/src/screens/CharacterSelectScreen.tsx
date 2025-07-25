// src/screens/CharacterSelectScreen.tsx

import React from 'react';
import StyledButton from '../components/StyledButton';
import { type Character, type CharacterSelections, type Player } from '../types';
import './CharacterSelectScreen.css';

// このコンポーネントが受け取るPropsの型定義
interface CharacterSelectScreenProps {
  characters: Character[];
  onBack: () => void;
  onCharacterSelect: (characterId: string | null) => void; // nullを許容
  onConfirm: () => void;
  characterSelections: CharacterSelections;
  myPlayerId: string;
  isMaster: boolean;
  players: Player[];
}

// キャラクター選択画面のコンポーネント
const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({ 
  characters, 
  onBack, 
  onCharacterSelect, 
  onConfirm,
  characterSelections,
  myPlayerId,
  isMaster,
  players
}) => {

  // PC（プレイヤーキャラクター）のみをフィルタリング
  const playerCharacters = characters.filter(char => char.type === 'PC');

  // キャラクターカードがクリックされたときの処理
  const handleCardClick = (character: Character) => {
    const currentSelection = characterSelections[character.id];
    
    if (currentSelection === myPlayerId) {
      // 既に自分が選択しているキャラクターを再度クリックした場合、選択を解除
      onCharacterSelect(null);
    } else if (!currentSelection) {
      // 誰も選択していないキャラクターをクリックした場合、選択する
      onCharacterSelect(character.id);
    }
    // 他人が選択している場合は何もしない
  };

  // 全員がキャラクターを選択したかどうか
  const allPlayersSelected = players.length === Object.values(characterSelections).filter(id => id !== null).length;

  // 選択者名を取得するヘルパー関数
  const getSelectorName = (characterId: string): string | null => {
    const selectorUserId = characterSelections[characterId];
    if (!selectorUserId) return null;
    // p.id (socketId) ではなく p.userId で比較する
    const selector = players.find(p => p.userId === selectorUserId);
    return selector ? selector.name : null;
  };

  return (
    <div className="char-select-container">
      <h1>キャラクターセレクト</h1>
      <div className="char-select-content">
        <p className="char-select-info">
          演じるキャラクターを決めてください。
        </p>
        <ul className="char-list">
          {playerCharacters.map(char => {
            const selectorId = characterSelections[char.id];
            const isSelectedByMe = selectorId === myPlayerId;
            const isSelectedByOther = selectorId && !isSelectedByMe;
            const selectorName = getSelectorName(char.id);

            return (
              <li 
                key={char.id} 
                className={`char-card ${isSelectedByMe ? 'selected-me' : ''} ${isSelectedByOther ? 'selected-other' : ''}`}
                onClick={() => handleCardClick(char)}
              >
                {char.imageFile && <div className='char-image'><img src={char.imageFile} alt={char.name} /></div>}
                <div className='char-detail'>
                  <h2 className="char-name">{char.name}</h2>
                  <p className="char-profile">{char.profile}</p>
                  {selectorName && <p className="char-selector">選択者: {selectorName}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="navigation-area">
        <StyledButton onClick={onBack}>
          BACK
        </StyledButton>
        {isMaster && (
          <StyledButton onClick={onConfirm} disabled={!allPlayersSelected}>
            CONFIRMED
          </StyledButton>
        )}
      </div>
    </div>
  );
};

export default CharacterSelectScreen;
