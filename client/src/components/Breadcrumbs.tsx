import React from 'react';
import './Breadcrumbs.css';
import { type GamePhase } from '../types';

interface BreadcrumbsProps {
  currentPhase: GamePhase;
}

const PHASES_ORDER: { id: GamePhase; name: string }[] = [
  { id: 'introduction', name: 'はじめに' },
  { id: 'synopsis', name: 'あらすじ' },
  { id: 'characterSelect', name: 'キャラクター選択' },
  { id: 'commonInfo', name: '共通情報' },
  { id: 'individualStory', name: '個別ストーリー' },
  { id: 'firstDiscussion', name: '第一議論' },
  { id: 'interlude', name: '中間情報' },
  { id: 'secondDiscussion', name: '第二議論' },
  { id: 'voting', name: '投票' },
  { id: 'ending', name: 'エンディング' },
  { id: 'debriefing', name: '感想戦' },
];

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ currentPhase }) => {
  const currentIndex = PHASES_ORDER.findIndex(p => p.id === currentPhase);

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumbs-list">
        {PHASES_ORDER.map((phase, index) => {
          let statusClass = '';
          if (index < currentIndex) {
            statusClass = 'completed';
          } else if (index === currentIndex) {
            statusClass = 'active';
          }

          return (
            <li key={phase.id} className={`breadcrumb-item ${statusClass}`}>
              {phase.name}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
