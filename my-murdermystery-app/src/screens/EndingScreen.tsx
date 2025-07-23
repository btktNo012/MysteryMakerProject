import React from 'react';
import TextRenderer from '../components/TextRenderer';
import StyledButton from '../components/StyledButton';
import { type Ending } from '../types';
import './InfoDisplayScreen.css'; 

interface EndingScreenProps {
  ending: Ending;
  onNext: () => void;
}

const EndingScreen: React.FC<EndingScreenProps> = ({ ending, onNext }) => {
  return (
    <div className="info-screen-container">
      <h1 className="info-screen-title">{ending.title}</h1>
      <div className="info-screen-content">
        <TextRenderer filePath={ending.endingFile} />
      </div>
      <div className="navigation-area">
        <StyledButton onClick={onNext}>
          感想戦へ
        </StyledButton>
      </div>
    </div>
  );
};

export default EndingScreen;
