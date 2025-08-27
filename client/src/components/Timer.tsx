// src/components/Timer.tsx
import React, { useEffect, useMemo, useState } from 'react';
import './Timer.css';

// 制御型タイマー: サーバ由来のendTime(絶対時刻)とpausedRemainingMs(停止中の残り)から算出
interface TimerProps {
  endTimeMs: number | null;           // 稼働中: 絶対時刻(ms)、停止中: null
  pausedRemainingMs: number | null;   // 停止中: 残り(ms)、稼働中: null
  isTicking: boolean;                 // 稼働中/停止中
  onTimeUp?: () => void;              // 0になったら呼び出し（省略可）
  tickMs?: number;                    // 更新間隔(ms) デフォルト1000
}

const Timer: React.FC<TimerProps> = ({ endTimeMs, pausedRemainingMs, isTicking, onTimeUp, tickMs = 1000 }) => {
  const computeRemaining = useMemo(() => {
    return () => {
      if (isTicking && endTimeMs != null) {
        return Math.max(0, Math.round((endTimeMs - Date.now()) / 1000));
      }
      if (!isTicking && pausedRemainingMs != null) {
        return Math.max(0, Math.round(pausedRemainingMs / 1000));
      }
      return 0;
    };
  }, [isTicking, endTimeMs, pausedRemainingMs]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(computeRemaining());

  useEffect(() => {
    // 稼働中: 定期更新。停止中: 値を直接反映
    if (isTicking && endTimeMs != null) {
      const update = () => {
        const secs = computeRemaining();
        setRemainingSeconds(secs);
        if (secs === 0 && onTimeUp) onTimeUp();
      };
      update();
      const id = setInterval(update, tickMs);
      return () => clearInterval(id);
    } else {
      const secs = computeRemaining();
      setRemainingSeconds(secs);
      // 停止中はポーリング不要
      return;
    }
  }, [isTicking, endTimeMs, pausedRemainingMs, tickMs, computeRemaining, onTimeUp]);

  const formatTime = (totalSeconds: number): string => {
    const safe = Math.max(0, totalSeconds);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return <div className="timer-container">{formatTime(remainingSeconds)}</div>;
};

export default Timer;
