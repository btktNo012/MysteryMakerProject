// 例: CharacterSelectScreen.tsx などで使う場合

import React, { useState } from 'react';
import Modal from './components/Modal'; // 作成したModalをインポート

const CharacterSelectScreen: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCharacterName, setSelectedCharacterName] = useState('');

  // キャラクターがクリックされた時に呼ばれる関数
  const handleCharacterClick = (characterName: string) => {
    setSelectedCharacterName(characterName);
    setIsModalOpen(true); // モーダルを表示
  };

  // モーダルのYESボタンが押された時の処理
  const handleConfirm = () => {
    console.log(`${selectedCharacterName}に決定！`);
    // ここで次の画面へ遷移するロジックを呼ぶ
    setIsModalOpen(false); // モーダルを閉じる
    // onSelect(selectedCharacterId); のような親への通知処理
  };

  // モーダルのNOボタンが押された時の処理
  const handleClose = () => {
    console.log('キャンセルされました。');
    setIsModalOpen(false); // モーダルを閉じる
  };

  return (
    <div>
      <h1>キャラクターセレクト</h1>
      {/* ダミーのキャラクターボタン */}
      <button onClick={() => handleCharacterClick('探偵A')}>探偵A</button>
      <button onClick={() => handleCharacterClick('令嬢B')}>令嬢B</button>
      
      {/* --- モーダルコンポーネントの呼び出し --- */}
      <Modal
        isOpen={isModalOpen}
        message={`[${selectedCharacterName}] このキャラクターでよろしいですか？`}
        onClose={handleClose}
        onConfirm={handleConfirm}
        closeButtonText="NO" // 省略可能
        confirmButtonText="YES" // 省略可能
      />

      {/* --- 通知用モーダルの例 --- */}
      {/*
      <Modal
        isOpen={isSomeNotificationOpen}
        message={"議論が終了しました"}
        onConfirm={() => {
            // 次のフェーズへ進む処理
            setIsSomeNotificationOpen(false);
        }}
        confirmButtonText="OK"
      />
      */}
    </div>
  );
};

export default CharacterSelectScreen;