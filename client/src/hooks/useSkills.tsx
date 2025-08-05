//typescript:client/src/hooks/useSkills.ts
import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { type InfoCard } from '../types'; // 型定義を適宜インポート

// カスタムフックの戻り値の型を定義
export interface SkillHandlers {
    activeSkillState: {
        skillId: string | null;
        status: 'inactive' | 'selecting_target';
    };
    // スキル使用開始
    handleUseSkill: (skillId: string | null) => void;
    // スキル使用をキャンセル
    handleCancelSkill: () => void;
    // スキルのターゲットを選択
    handleSkillTargetSelect: (targetCardId: string) => void;
}

// カスタムフックの定義
export const useSkills = (
    socket: Socket | null,
    roomId: string,
    userId: string | null,
    infoCards: InfoCard[],
    // 確認モーダルを開くための関数をApp.tsxから受け取る
    openConfirmationModal: (card: InfoCard) => void
): SkillHandlers => {
    // アクティブスキルの状態を管理するState
    const [activeSkillState, setActiveSkillState] = useState<{
        skillId: string | null;
        status: 'inactive' | 'selecting_target';
    }>({ skillId: null, status: 'inactive' });

    // スキル使用開始
    const handleUseSkill = (skillId: string | null) => {
        // スキルIDがnullの場合は何もしない
        if (!skillId) return;
        // スキルIDごとに対象となるカードの取得条件を設定
        let targetableCards = [];
        if (skillId === 'skill_01') {
            // 交渉

            // 所持者が設定されている、かつ所持者が自分以外のカードを取得
            targetableCards = infoCards.filter(c => c.owner && c.owner !== userId);
        }
        else if (skillId === 'skill_02') {
            // 見通す
            // 所持者が設定されている、かつ所持者が自分以外、かつ非公開のカードを取得
            targetableCards = infoCards.filter(c => c.owner && c.owner !== userId && !c.isPublic);
        }
        // ターゲットがいない場合はアラートを表示
        if (targetableCards.length === 0) {
            alert('スキル対象がありません');
            return;
        }
        // アクティブスキル状態を「対象の選択中」に更新
        setActiveSkillState({ skillId, status: 'selecting_target' });
    };

    // スキル使用をキャンセル
    const handleCancelSkill = () => {
        // アクティブスキルを使用していない状態にする
        setActiveSkillState({ skillId: null, status: 'inactive' });
    };

    // スキルのターゲットが選択された（モーダルを開くところまで）
    const handleSkillTargetSelect = (targetCardId: string) => {
        // 対象の情報カードを取得
        const targetCard = infoCards.find(c => c.id === targetCardId);
        if (targetCard) {
            // App.tsx側で定義された確認モーダルを開く
            openConfirmationModal(targetCard);
        }
    };

    // App.tsxに渡すオブジェクト
    return {
        activeSkillState,
        handleUseSkill,
        handleCancelSkill,
        handleSkillTargetSelect,
        // confirmSkillUseはApp.tsx内で定義し、モーダルから直接呼び出す形になるので、ここでは返さない
    };
};