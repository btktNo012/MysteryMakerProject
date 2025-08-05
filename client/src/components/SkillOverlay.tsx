import React from 'react';
import './SkillOverlay.css';
import { type InfoCard, type Player, type SkillInfoData } from '../types';

interface SkillOverlayProps {
    skillInfoData: SkillInfoData[] | null;
    skillId: string;
    infoCards: InfoCard[];
    myPlayer: Player;
    onSelectTarget: (cardId: string) => void;
    onCancel: () => void;
}

const SkillOverlay: React.FC<SkillOverlayProps> = ({ skillInfoData, skillId, infoCards, myPlayer, onSelectTarget, onCancel }) => {
    // スキルIDに応じてハイライトするカードを決定
    let targetableCards: any[] = [];
    if (skillId === 'skill_01') {
        // 所持者が設定されている、かつ所持者が自分以外
        targetableCards = infoCards.filter(card => card.owner && card.owner !== myPlayer.userId);
    }
    else if (skillId === 'skill_02') {
        // 所持者が設定されている、かつ所持者が自分以外、かつ非公開
        targetableCards = infoCards.filter(card => card.owner && card.owner !== myPlayer.userId && !card.isPublic);
    }


    // skillInfoDataからskillIdをキーにスキル情報を取得
    const skillData = skillInfoData?.find(skill => skill.id === skillId);

    return (
        <div className="skill-overlay" onClick={onCancel}>
            <div className="skill-overlay-content">
                <p className="skill-guide-text">スキル「{skillData?.name}」：対象のカードを選択してください。</p>
                <div className="highlighted-cards-container">
                    {targetableCards.map(card => (
                        <div
                            key={card.id}
                            className="highlighted-card"
                            onClick={(e) => {
                                e.stopPropagation(); // オーバーレイのクリックイベントを伝播させない
                                onSelectTarget(card.id);
                            }}
                        >
                            {card.name}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SkillOverlay;