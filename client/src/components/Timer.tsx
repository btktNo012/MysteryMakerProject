// src/components/Timer.tsx
import React, { useState, useEffect } from 'react';
import './Timer.css';

// Timerコンポーネントが受け取るPropsの型定義
interface TimerProps {
  initialSeconds: number; // 初期n時間（秒）
  isTicking: boolean;     // タイマーが作動中か (true: 作動, false: 一時停止)
  onTimeUp: () => void;   // 時間がゼロになったときに呼び出される関数
  resetTrigger?: any;      // この値が変わるとタイマーがリセットされる
}

// コンポーネント関数Timerの宣言
const Timer: React.FC<TimerProps> = ({ 
  initialSeconds, 
  isTicking, 
  onTimeUp,
  resetTrigger
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  // useEffect: isTicking と remainingSeconds の値が変わるたびに実行される
  useEffect(() => {
    // タイマーが作動中でなく、または時間が残っていない場合は何もしない
    if (!isTicking || remainingSeconds <= 0) {
      return;
    }

    // 1秒ごとに remainingSeconds を1減らすタイマーを設定
    const timerId = setInterval(() => {
      // タイマーの値を-1
      setRemainingSeconds(seconds => seconds - 1);
    }, 1000);

    // クリーンアップ関数: このuseEffectが再実行される前、またはコンポーネントがアンマウントされる時に実行される
    // これがないと、タイマーがどんどん増えてメモリリークの原因になる
    return () => clearInterval(timerId);

  }, [isTicking, remainingSeconds]); // isTickingかremainingSecondsが変わった時だけ副作用を再実行

  // useEffect: remainingSeconds が変化するたびに実行。0になったことを検知する
  useEffect(() => {
    // タイマーが作動中ではない場合は何もしない
    if (!isTicking) {
        return;
    }
    if (remainingSeconds === 0) {
      onTimeUp(); // 親コンポーネントに通知
    }
  }, [remainingSeconds, onTimeUp, isTicking]);

  // useEffect: 初期値が変更されたりリセットトリガーが変更されたら時間を初期値に戻す
  useEffect(() => {
    setRemainingSeconds(initialSeconds);
  }, [resetTrigger, initialSeconds]);


  // 秒を MM:SS 形式の文字列にフォーマットする関数
  // @param totalSeconds 残り秒数
  // return string型の「MM:SS」
  const formatTime = (totalSeconds: number): string => {
    const safeTotalSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeTotalSeconds / 60);
    const seconds = safeTotalSeconds % 60;
    // padStart(2, '0') は、文字列が2桁でない場合に左側を '0' で埋める (例: 5 -> "05")
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="timer-container">
      {formatTime(remainingSeconds)}
    </div>
  );
};

export default Timer;