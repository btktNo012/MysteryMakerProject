import React from 'react';
import TextRenderer from '../components/TextRenderer';
import { type Ending } from '../types';
import './InfoDisplayScreen.css'; 

interface EndingScreenProps {
  ending: Ending;
}

const EndingScreen: React.FC<EndingScreenProps> = ({ ending }) => {
  return (
    <div className="info-screen-container">
      <h1 className="info-screen-title">{ending.title}</h1>
      <div className="info-screen-content">
        <TextRenderer filePath={ending.endingFile} />
      </div>
    </div>
  );
};

export default EndingScreen;
