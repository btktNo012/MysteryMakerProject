// src/screens/AttentionScreen.tsx

import React, { useState, useEffect } from 'react';
import './AttentionScreen.css';

// このコンポーネントが受け取るPropsの型定義
interface AttentionScreenProps {
  onNext: () => void; // 次の画面（スタート画面）へ遷移するための関数
}

// ヘッドフォンアイコンのSVGコンポーネント
const HeadphoneIcon = () => (

    <img 
      src="/images/logo_mmp.png"
      alt="mmp" 
      className='logo-image'
    />
  );

const AttentionScreen: React.FC<AttentionScreenProps> = ({ onNext }) => {
  // フェードアウト用のアニメーションクラスを適用するためのState
  const [isFadingOut, setIsFadingOut] = useState(false);

  // useEffect: コンポーネントがマウントされた時に一度だけ実行される
  useEffect(() => {
    // 4秒後にフェードアウトを開始するタイマー
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 4000); // 4秒 (フェードイン2秒 + 表示2秒)

    // 6秒後に次の画面へ遷移するタイマー
    const nextScreenTimer = setTimeout(() => {
      onNext();
    }, 6000); // 6秒 (フェードアウトのアニメーション時間2秒を考慮)

    // クリーンアップ関数: コンポーネントがアンマウントされる時にタイマーをクリアする
    // (例: ユーザーが画面遷移を待たずにブラウザを閉じた場合など)
    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(nextScreenTimer);
    };
  }, [onNext]); // onNext関数が変わることはないが、依存配列に含めるのが作法

  return (
    // isFadingOutがtrueになったら 'fade-out' クラスを追加する
    <div className={`attention-container ${isFadingOut ? 'fade-out' : ''}`}>
      <HeadphoneIcon />
    </div>
  );
};

export default AttentionScreen;