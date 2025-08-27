import { useState, useEffect, useRef, useReducer } from 'react';
import io, { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// 各画面コンポーネントをインポート
import SplashScreen from './screens/SplashScreen';
import StartScreen from './screens/StartScreen';
import WaitingScreen from './screens/WaitingScreen';
import InfoDisplayScreen from './screens/InfoDisplayScreen';
import CharacterSelectScreen from './screens/CharacterSelectScreen';
import IndividualStoryScreen from './screens/IndividualStoryScreen';
import DiscussionScreen from './screens/DiscussionScreen';
import VotingScreen from './screens/VotingScreen';
import EndingScreen from './screens/EndingScreen';
import DebriefingScreen from './screens/DebriefingScreen';
import { type ScenarioData, type Player, type CharacterSelections, type InfoCard, type DiscussionTimer, type VoteState, type VoteResult, type SkillInfoData, type GameLogEntry, type GamePhase } from './types';
import { type TabItem } from './components/Tabs';
import { useSkills } from './hooks/useSkills';
import TextRenderer from './components/TextRenderer';
import AppModals from './components/AppModals';
import LoadingOverlay from './components/LoadingOverlay';
import './style.css';
import SkillOverlay from './components/SkillOverlay';
import Breadcrumbs from './components/Breadcrumbs';
import Footer from './components/Footer';
import * as socketService from './socketService';
import { type SocketEventHandlers } from './socketService';

// --- モーダル管理用Reducer ---
type ModalType =
  'createRoom' |
  'findRoom' |
  'expMurder' |
  'screenHowto' |
  'hoReadForcedEnd' |
  'hoReadEnd' |
  'voteResult' |
  'voteTied' |
  'getCardError' |
  'confirmCloseRoom' |
  'characterSelectConfirm' |
  'skillConfirm' |
  'leaveConfirm' |
  'startHowto';
type ModalState = Record<ModalType, boolean>;
// モーダル表示状態の変更アクション
type ModalAction =
  { type: 'OPEN'; modal: ModalType } |
  { type: 'CLOSE'; modal: ModalType } |
  { type: 'CLOSE_ALL' };

// モーダル表示ステータス
const initialModalState: ModalState = {
  createRoom: false,
  findRoom: false,
  expMurder: false,
  screenHowto: false,
  hoReadForcedEnd: false,
  hoReadEnd: false,
  voteResult: false,
  voteTied: false,
  getCardError: false,
  confirmCloseRoom: false,
  characterSelectConfirm: false,
  skillConfirm: false,
  leaveConfirm: false,
  startHowto: false
};

// モーダルの状態変更処理
const modalReducer = (state: ModalState, action: ModalAction): ModalState => {
  switch (action.type) {
    case 'OPEN':
      return { ...state, [action.modal]: true };
    case 'CLOSE':
      return { ...state, [action.modal]: false };
    case 'CLOSE_ALL':
      return { ...initialModalState };
    default:
      return state;
  }
};


function App() {
  // --- ステート定義 ---
  const [gamePhase, setGamePhase] = useState<GamePhase>('splash');
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [skillInfo, setSkillInfo] = useState<SkillInfoData[] | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userId, setUserId] = useState(''); // 永続的なユーザーID
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [modalState, dispatchModal] = useReducer(modalReducer, initialModalState);
  const [getCardErrorMessage, setGetCardErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [skillMessage, setSkillMessage] = useState<string>('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSelections, setCharacterSelections] = useState<CharacterSelections>({});
  const [readingTimerEndTime, setReadingTimerEndTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [infoCards, setInfoCards] = useState<InfoCard[]>([]);
  const [discussionTimer, setDiscussionTimer] = useState<DiscussionTimer>({ endTime: null, remainingMs: null, isTicking: false, phase: null, endState: 'none' });
  const [voteState, setVoteState] = useState<VoteState>({});
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [discussionHowtoSeq, setDiscussionHowtoSeq] = useState(0);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const characterSelectionsRef = useRef(characterSelections);
  useEffect(() => {
    characterSelectionsRef.current = characterSelections;
  }, [characterSelections]);

  // スキル使用確認モーダル用のstateを追加
  const [skillConfirmModal, setSkillConfirmModal] = useState<{
    card: InfoCard | null;
  }>({ card: null });

  // モーダルを開く関数
  const openSkillConfirmationModal = (card: InfoCard) => {
    setSkillConfirmModal({ card });
    // card.nameをスキル対象にするか確認するメッセージ
    setSkillMessage(`「${card.name}」でよろしいですか？`);
    dispatchModal({ type: 'OPEN', modal: 'skillConfirm' });
  };

  // --- スキル用カスタムフックの利用 ---
  const {
    activeSkillState,
    handleUseSkill,
    handleCancelSkill,
    handleSkillTargetSelect
  } = useSkills(userId, infoCards, openSkillConfirmationModal);

  // --- スキルモーダルで「YES」が押された時の処理 ---
  const handleConfirmSkillUse = () => {
    if (socket && skillConfirmModal.card && activeSkillState.skillId) {
      socketService.emitUseActiveSkill(socket, roomId, userId, activeSkillState.skillId, { targetCardId: skillConfirmModal.card.id });
    }
    // モーダルを閉じ、スキル状態をリセット
    setSkillConfirmModal({ card: null });
    dispatchModal({ type: 'CLOSE', modal: 'skillConfirm' });
    handleCancelSkill(); // スキル状態を'inactive'に戻す
  };
  // ゲーム情報の初期化処理
  const initGameData = () => {
    // ルームIDを空にする
    setRoomId('');
    // プレイヤー情報を空にする
    setPlayers([]);
    // 自分自身のプレイヤー情報を初期化
    setMyPlayer(null);
    // キャラクターセレクト情報を初期化
    setCharacterSelections({});
    // 選択中キャラクター情報を初期化
    setSelectedCharacterId(null);
    // HO読み込みタイマー時間を初期化
    setReadingTimerEndTime(null);
    // 情報カード情報を初期化
    setInfoCards([]);
    // 議論タイマー情報を初期化
    setDiscussionTimer({ endTime: null, remainingMs: null, isTicking: false, phase: null, endState: 'none' });
    // 投票の状態を初期化
    setVoteState({});
    // 投票結果を初期化
    setVoteResult(null);
    // ゲームログ情報を初期化
    setGameLog([]);
    // ローカルストレージからルームIDを削除
    localStorage.removeItem('roomId');
  }


  // --- 副作用 ---
  useEffect(() => {
    // 1. userIdの初期化 (localStorageから取得 or 新規作成)
    let storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      storedUserId = uuidv4();
      localStorage.setItem('userId', storedUserId);
    }
    setUserId(storedUserId);

    // 2. Socket.IO接続
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    setSocket(newSocket);

    // 3. イベントハンドラをまとめる
    const handlers: SocketEventHandlers = {
      setGamePhase,
      setRoomId,
      setPlayers,
      setMyPlayer,
      setErrorMessage,
      setLoadingMessage,
      setCharacterSelections,
      setInfoCards,
      setDiscussionTimer,
      setVoteState,
      setVoteResult,
      setGameLog,
      setReadingTimerEndTime,
      setSelectedCharacterId,
      dispatchModal,
      handleRoomClosed: () => {
        // ルーム解散を受信した時の処理
        // ゲームフェーズをスタート画面に
        setGamePhase('start');
        // ゲーム情報の初期化処理
        initGameData();
      },
    };

    // 4. サーバーからのイベントリスナーを登録
    socketService.registerEventListeners(newSocket, handlers);

    // 5. App.tsxに固有、またはRefに依存するリスナーのみここに残す
    // 接続成功
    newSocket.on('connect', () => {
      console.log('Connected to server with socket ID:', newSocket.id);
      const storedRoomId = localStorage.getItem('roomId');
      const storedUsername = localStorage.getItem('username');
      const storedSpectator = localStorage.getItem('isSpectator');
      if (storedRoomId && storedUserId && storedUsername) {
        console.log(`Attempting to rejoin room ${storedRoomId} as ${storedUsername}`);
        socketService.emitJoinRoom(newSocket, storedUsername, storedUserId, storedRoomId, storedSpectator === 'true');
      }
    });

    // プレイヤー情報の更新
    newSocket.on('updatePlayers', (data: { players: Player[] }) => {
      setPlayers(data.players);
      const me = data.players.find((p: Player) => p.userId === userIdRef.current);
      if (me) {
        setMyPlayer(me);
      }
    });

    // キャラクター確定
    newSocket.on('charactersConfirmed', ({ gamePhase, readingTimerEndTime }) => {
      console.log('Characters confirmed');
      const currentSelections = characterSelectionsRef.current;
      const myCharacter = Object.keys(currentSelections).find(charId => currentSelections[charId] === userId);
      if (myCharacter) {
        setSelectedCharacterId(myCharacter);
      }
      setReadingTimerEndTime(readingTimerEndTime);
      setGamePhase(gamePhase);
    });

    // カード取得時エラー
    newSocket.on('getCardError', ({ message }: { message: string }) => {
      setGetCardErrorMessage(message);
      dispatchModal({ type: 'OPEN', modal: 'getCardError' });
    });

    // 6. クリーンアップ
    return () => {
      console.log('Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []); // このuseEffectはマウント時に一度だけ実行する

  // シナリオデータの読み込み
  useEffect(() => {
    fetch('/scenario.json')
      .then(response => response.json())
      .then(data => setScenario(data))
      .then(() => console.log("シナリオの読み込みに成功"))
      .catch(error => console.error("シナリオの読み込みに失敗:", error));
  }, []);
  // スキルデータの読み込み
  useEffect(() => {
    fetch('/skill_info.json')
      .then(response => response.json())
      .then(data => setSkillInfo(data))
      .then(() => console.log("スキルデータの読み込みに成功"))
      .catch(error => console.error("スキルデータの読み込みに失敗:", error));
  }, []);

  // HO読み込み時間のタイマー処理
  useEffect(() => {
    // HO読み込み終了時間が設定されていない場合は何もしない
    if (readingTimerEndTime === null) {
      setRemainingTime(0);
      return;
    }

    // HO読み込み時間の更新
    const updateRemainingTime = () => {
      const now = Date.now();
      // HO読み込み終了時間と現在時間の差分を取得
      const diff = Math.round((readingTimerEndTime - now) / 1000);
      setRemainingTime(diff > 0 ? diff : 0);
      // HO読み込み終了時間になった場合、モーダル表示
      if (diff <= 0) {
        // HO読み込み終了のモーダルを表示
        dispatchModal({ type: 'OPEN', modal: 'hoReadEnd' });
      }
    };

    updateRemainingTime();
    const timerId = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(timerId);
  }, [readingTimerEndTime, myPlayer]);


  // --- イベントハンドラ ---
  const handleCreateRoom = () => {
    if (!socket) return;
    if (username.trim() === '') return setErrorMessage('ユーザー名を入力してください。');
    if (username.trim().length > 6) return setErrorMessage('ユーザIDは6文字以内にしてください。');
    localStorage.setItem('username', username);
    setLoadingMessage('ルーム作成中…');
    socketService.emitCreateRoom(socket, username, userId);
  };

  // プレイヤーとして参加する処理
  const handleJoinRoom = () => {
    if (!socket) return;
    if (username.trim() === '' || roomId.trim() === '') return setErrorMessage('ユーザー名とルームIDを入力してください。');
    if (username.trim().length > 6) return setErrorMessage('ユーザIDは6文字以内にしてください。');
    localStorage.setItem('username', username);
    localStorage.setItem('isSpectator', 'false');
    setLoadingMessage('ルーム接続中…');
    socketService.emitJoinRoom(socket, username, userId, roomId, false);
  };

  // 観戦モードで参加する処理
  const handleSpectateRoom = () => {
    if (!socket) return;
    if (username.trim() === '' || roomId.trim() === '') return setErrorMessage('ユーザー名とルームIDを入力してください。');
    localStorage.setItem('username', username);
    localStorage.setItem('isSpectator', 'true');
    setLoadingMessage('ルーム接続中…');
    socketService.emitJoinRoom(socket, username, userId, roomId, true);
  };

  // ルーム退室処理
  const handleConfirmLeave = () => {
    dispatchModal({ type: 'CLOSE', modal: 'leaveConfirm' });
    // 通信が確立してない場合、何もしない
    if (!socket) return;
    // ゲームフェーズが感想戦以外、またはプレイヤーの種別が観戦者の場合、サーバにルーム退室を送信
    if (myPlayer?.isSpectator || gamePhase !== 'debriefing') socketService.emitLeaveRoom(socket, roomId, userId);
    // 状態をリセット
    setGamePhase('start');
    // ゲーム情報の初期化
    initGameData();
  };

  const handleCloseRoom = () => dispatchModal({ type: 'OPEN', modal: 'confirmCloseRoom' });
  // ルームを解散
  const handleConfirmCloseRoom = () => {
    if (!socket) return;
    socketService.emitCloseRoom(socket, roomId, userId);
    dispatchModal({ type: 'CLOSE', modal: 'confirmCloseRoom' });
  }
  const handleStartGame = () => {
    if (!socket) return;
    socketService.emitStartGame(socket, roomId, userId);
  }
  const handleCharacterSelect = (characterId: string | null) => {
    if (!socket) return;
    socketService.emitSelectCharacter(socket, roomId, userId, characterId);
  }
  const handleCharacterConfirm = () => {
    if (!socket) return;
    dispatchModal({ type: 'CLOSE', modal: 'characterSelectConfirm' });
    socketService.emitConfirmCharacters(socket, roomId, userId);
  };
  const handleExtendTimer = () => {
    if (!socket) return;
    socketService.emitExtendReadingTimer(socket, roomId, userId);
  }
  const handleProceedToDiscussion = () => {
    if (!socket) return;
    socketService.emitProceedToFirstDiscussion(socket, roomId, userId);
  }

  // 情報カード操作ハンドラ
  const handleGetCard = (cardId: string) => {
    if (!socket) return;
    socketService.emitGetCard(socket, roomId, userId, cardId);
  }
  const handleMakeCardPublic = (cardId: string) => {
    if (!socket) return;
    socketService.emitMakeCardPublic(socket, roomId, userId, cardId);
  }
  const handleTransferCard = (cardId: string, targetUserId: string) => {
    if (!socket) return;
    socketService.emitTransferCard(socket, roomId, userId, cardId, targetUserId);
  }

  // 議論タイマー操作ハンドラ
  const handleStartDiscussionTimer = (phase: 'firstDiscussion' | 'secondDiscussion', durationSeconds: number) => {
    if (!socket) return;
    socketService.emitStartDiscussionTimer(socket, roomId, userId, phase, durationSeconds);
  }
  const handlePauseDiscussionTimer = () => {
    if (!socket) return;
    socketService.emitPauseDiscussionTimer(socket, roomId, userId);
  }
  const handleResumeDiscussionTimer = () => {
    if (!socket) return;
    socketService.emitResumeDiscussionTimer(socket, roomId, userId);
  }
  const handleRequestEndDiscussion = () => {
    if (!socket) return;
    socketService.emitRequestEndDiscussion(socket, roomId, userId);
  }
  const handleCancelEndDiscussion = () => {
    if (!socket) return;
    socketService.emitCancelEndDiscussion(socket, roomId, userId);
  }
  const handleConfirmEndDiscussion = () => {
    if (!socket) return;
    socketService.emitConfirmEndDiscussion(socket, roomId, userId);
  }

  // 投票ハンドラ
  const handleSubmitVote = (votedCharacterId: string) => {
    if (!socket) return;
    socketService.emitSubmitVote(socket, roomId, userId, votedCharacterId);
  }
  const handleProceedToEnding = () => {
    if (!socket) return;
    socketService.emitChangeGamePhase(socket, roomId, 'ending');
    setGamePhase('ending');
    dispatchModal({ type: 'CLOSE', modal: 'voteResult' }); // モーダルを閉じる
  }

  // エンディング・感想戦ハンドラ
  const handleProceedToDebriefing = () => {
    if (!socket) return;
    socketService.emitChangeGamePhase(socket, roomId, 'debriefing');
    setGamePhase('debriefing');
  }

  const handleProceedToSecondDiscussion = () => {
    if (!socket) return;
    socketService.emitChangeGamePhase(socket, roomId, 'secondDiscussion');
    setGamePhase('secondDiscussion');
  };


  const shouldShowReadingTimer = gamePhase === 'commonInfo' || gamePhase === 'individualStory';
  const discussionSeconds = (gamePhase === 'firstDiscussion' || gamePhase === 'secondDiscussion')
    ? (scenario?.discussionPhaseSettings[gamePhase]?.timeLimit ?? 600)
    : 600;

  const renderScreen = () => {
    if (gamePhase !== 'splash' && (!scenario || !skillInfo)) return <div>ゲームデータを読み込んでいます...</div>;
    if (gamePhase !== 'splash' && gamePhase !== 'start' && !myPlayer) {
      return <div>プレイヤー情報を読み込んでいます...ページをリロードしてしばらく待ってもこの画面が消えない場合は、最初からやり直してください。</div>;
    }

    const characterDependentPhases: GamePhase[] = ['individualStory', 'firstDiscussion', 'secondDiscussion', 'voting', 'ending', 'debriefing'];
    if (characterDependentPhases.includes(gamePhase) && !selectedCharacterId && !myPlayer?.isSpectator) {
      // 復帰処理中に選択済みキャラIDがまだセットされていない場合があるため、characterSelectionsから再取得を試みる
      const myCharId = Object.keys(characterSelections).find(charId => characterSelections[charId] === userId);
      if (myCharId) {
        setSelectedCharacterId(myCharId);
      } else {
        return <div>キャラクターが選択されていません。選択画面に戻るか、ページをリロードしてください。</div>;
      }
    }

    const selectedChar = scenario?.characters.find(char => char.id === selectedCharacterId);

    let DISCUSSION_SECCONDS = 600;
    // 議論フェイズの場合、制限時間を設定
    if (gamePhase === 'firstDiscussion' || gamePhase === 'secondDiscussion') {
      if (scenario?.discussionPhaseSettings[gamePhase]?.timeLimit) {
        DISCUSSION_SECCONDS = scenario?.discussionPhaseSettings[gamePhase]?.timeLimit;
      }
    }

    switch (gamePhase) {
      case 'splash': return <SplashScreen onNext={() => setGamePhase('start')} />;
      case 'start': return <StartScreen title={scenario!.title}
        titleImage={scenario!.titleImage}
        onCreateRoom={() => dispatchModal({ type: 'OPEN', modal: 'createRoom' })}
        onFindRoom={() => dispatchModal({ type: 'OPEN', modal: 'findRoom' })}
        onExpMurder={() => dispatchModal({ type: 'OPEN', modal: 'expMurder' })}
        onStartHowto={() => dispatchModal({ type: 'OPEN', modal: 'startHowto' })} />;
      case 'waiting': {
        const requiredPlayers = scenario!.characters.filter(c => c.type === 'PC').length;
        return <WaitingScreen
          roomId={roomId}
          players={players}
          isMaster={myPlayer?.isMaster || false}
          maxPlayers={requiredPlayers}
          onLeave={() => dispatchModal({ type: 'OPEN', modal: 'leaveConfirm' })}
          onClose={handleCloseRoom}
          onStart={handleStartGame}
        />;
      }
      case 'introduction': return <InfoDisplayScreen filePath={scenario!.introductionFile} />;
      case 'synopsis': return <InfoDisplayScreen filePath={scenario!.synopsisFile} />;
      case 'characterSelect': return <CharacterSelectScreen characters={scenario!.characters} onBack={() => setGamePhase('synopsis')} onCharacterSelect={handleCharacterSelect} characterSelections={characterSelections} myPlayerId={userId} isMaster={myPlayer?.isMaster || false} onConfirm={() => dispatchModal({ type: 'OPEN', modal: 'characterSelectConfirm' })} players={players} isSpectator={!!myPlayer?.isSpectator} hideBack hideConfirm />;
      case 'commonInfo': return (
        <>
          <InfoDisplayScreen filePath={scenario!.commonInfo.textFile} />
        </>
      );
      case 'individualStory':
        if (!selectedChar) return <div>選択されたキャラクター情報が見つかりません。</div>;
        return (
          <>
            <IndividualStoryScreen
              character={selectedChar}
              isMaster={myPlayer?.isMaster || false}
            />
          </>
        );
      case 'firstDiscussion':
        if (!myPlayer) return <div>プレイヤー情報が見つかりません。</div>;
        const effectiveChar1 = myPlayer.isSpectator
          ? (scenario!.characters.find(c => c.type === 'PC') || scenario!.characters[0])
          : selectedChar;
        if (!effectiveChar1) return <div>表示するキャラクター情報が見つかりません。</div>;
        let tabItems1: TabItem[] = [
          { label: 'はじめに', content: <TextRenderer filePath={scenario!.introductionFile} /> },
          { label: 'あらすじ', content: <TextRenderer filePath={scenario!.synopsisFile} /> },
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: effectiveChar1.storyFile ? <TextRenderer filePath={effectiveChar1.storyFile} /> : <div /> },
          {
            label: '目的',
            content: effectiveChar1.goals ?
              (
                <div>
                  {effectiveChar1.goals && effectiveChar1.goals.length > 0 ? (
                    <ul className='goals-list'>
                      {effectiveChar1.goals.map((goal, index) => (
                        <li key={index}>{goal.text} ({goal.points}点)<ul className='goal-hint'><li>{goal.hint}</li></ul></li>
                      ))}
                    </ul>
                  ) : <p>目的はありません。</p>}
                </div>
              )
              : <div />
          },
          { label: '現場見取り図', content: effectiveChar1.mapImageFile ? <img src={effectiveChar1.mapImageFile} className="discuttion-map-image" alt="現場見取り図" style={{ maxWidth: '700px', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        if (myPlayer.isSpectator) {
          tabItems1 = tabItems1.filter(item => item.label !== '個別ストーリー' && item.label !== '目的');
        }
        return <DiscussionScreen
          title="第一議論フェイズ"
          gamePhase={gamePhase}
          character={effectiveChar1}
          tabItems={tabItems1}
          discussionTime={DISCUSSION_SECCONDS}
          infoCards={infoCards}
          players={players}
          myPlayer={myPlayer}
          scenarioData={scenario!}
          characterSelections={characterSelections}
          onGetCard={handleGetCard}
          onMakeCardPublic={handleMakeCardPublic}
          onTransferCard={handleTransferCard}
          discussionTimer={discussionTimer}
          onStartTimer={() => handleStartDiscussionTimer('firstDiscussion', DISCUSSION_SECCONDS)}
          onPauseTimer={handlePauseDiscussionTimer}
          onResumeTimer={handleResumeDiscussionTimer}
          onRequestEnd={handleRequestEndDiscussion}
          onCancelEnd={handleCancelEndDiscussion}
          onConfirmEnd={handleConfirmEndDiscussion}
          onUseSkill={handleUseSkill}
          gameLog={gameLog}
          screenHowtoTrigger={discussionHowtoSeq}
          isSpectator={!!myPlayer.isSpectator}
          hideControls
        />;
      case 'interlude': return <InfoDisplayScreen filePath={scenario!.intermediateInfo.textFile} />;
      case 'secondDiscussion':
        if (!myPlayer) return <div>プレイヤー情報が見つかりません。</div>;
        const effectiveChar2 = myPlayer.isSpectator
          ? (scenario!.characters.find(c => c.type === 'PC') || scenario!.characters[0])
          : selectedChar;
        if (!effectiveChar2) return <div>表示するキャラクター情報が見つかりません。</div>;
        let tabItems2: TabItem[] = [
          { label: 'はじめに', content: <TextRenderer filePath={scenario!.introductionFile} /> },
          { label: 'あらすじ', content: <TextRenderer filePath={scenario!.synopsisFile} /> },
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: effectiveChar2.storyFile ? <TextRenderer filePath={effectiveChar2.storyFile} /> : <div /> },
          { label: '中間情報', content: <TextRenderer filePath={scenario!.intermediateInfo.textFile} /> },
          { label: '現場見取り図', content: effectiveChar2.mapImageFile ? <img src={effectiveChar2.mapImageFile} alt="現場見取り図" style={{ maxWidth: '700px', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        if (myPlayer.isSpectator) {
          tabItems2 = tabItems2.filter(item => item.label !== '個別ストーリー');
        }
        return <DiscussionScreen
          title="第二議論フェイズ"
          gamePhase={gamePhase}
          character={effectiveChar2}
          tabItems={tabItems2}
          discussionTime={DISCUSSION_SECCONDS}
          infoCards={infoCards}
          players={players}
          myPlayer={myPlayer}
          scenarioData={scenario!}
          characterSelections={characterSelections}
          onGetCard={handleGetCard}
          onMakeCardPublic={handleMakeCardPublic}
          onTransferCard={handleTransferCard}
          discussionTimer={discussionTimer}
          onStartTimer={() => handleStartDiscussionTimer('secondDiscussion', DISCUSSION_SECCONDS)}
          onPauseTimer={handlePauseDiscussionTimer}
          onResumeTimer={handleResumeDiscussionTimer}
          onRequestEnd={handleRequestEndDiscussion}
          onCancelEnd={handleCancelEndDiscussion}
          onConfirmEnd={handleConfirmEndDiscussion}
          onUseSkill={handleUseSkill}
          gameLog={gameLog}
          screenHowtoTrigger={discussionHowtoSeq}
          isSpectator={!!myPlayer.isSpectator}
          hideControls
        />;
      case 'voting':
        if (!myPlayer) return <div>プレイヤー情報がありません。</div>;
        return <VotingScreen
          characters={scenario!.characters.filter(c => c.type === 'PC')}
          players={players}
          myPlayer={myPlayer}
          voteState={voteState}
          voteResult={voteResult}
          onSubmitVote={handleSubmitVote}
          defaultVoting={scenario!.defaultVoting} />;
      case 'ending':
        if (!voteResult) return <div>投票結果がありません。</div>;
        let targetEnding = scenario!.endings.find(end => end.votedCharId === voteResult.votedCharacterId) || scenario!.endings.find(end => end.votedCharId === 'default');
        if (!targetEnding) return <div>対応するエンディングが見つかりません。</div>;
        return <EndingScreen
          ending={targetEnding}
        />;
      case 'debriefing': return <DebriefingScreen scenario={scenario!} infoCards={infoCards} players={players} gameLog={gameLog} />;
      default: return <SplashScreen onNext={() => setGamePhase('start')} />;
    }
  };

  const phasesToShowHeaderFooter: GamePhase[] = [
    'introduction',
    'synopsis',
    'characterSelect',
    'commonInfo',
    'individualStory',
    'firstDiscussion',
    'interlude',
    'secondDiscussion',
    'voting',
    'ending',
    'debriefing',
  ];

  // ゲームフェーズごとのフッター操作ボタン(議論フェイズは個別に定義)
  const operationButtonsForPhase = (): {
    label: string; onClick: () => void; disabled?: boolean
  }[] => {
    const ops: { label: string; onClick: () => void; disabled?: boolean }[] = [];
    switch (gamePhase) {
      case 'introduction':
        // イントロダクション
        // 「NEXT」ボタン：あらすじに移動
        ops.push({ label: 'NEXT ▶', onClick: () => setGamePhase('synopsis') })
        break;
      case 'synopsis':
        // あらすじ
        // 「BACK」ボタン：イントロダクションに移動
        ops.push({ label: '◀ BACK', onClick: () => setGamePhase('introduction') });
        // 「NEXT」ボタン：キャラクターセレクトに移動
        ops.push({ label: 'NEXT ▶', onClick: () => setGamePhase('characterSelect') });
        break;
      case 'characterSelect':
        // キャラクターセレクト
        {
          // 決定済みキャラクターの数
          const assignedCount = Object.values(characterSelections).filter(id => id !== null).length;
          // 観戦者以外＝参加プレイヤーの数
          const participantCount = players.filter(p => !p.isSpectator).length;
          // 参加プレイヤーの数＝決定済みプレイヤーの場合true
          const allSelected = participantCount === assignedCount && participantCount > 0;
          ops.push({ label: '◀ BACK', onClick: () => setGamePhase('synopsis') });
          if (myPlayer?.isMaster) {
            // ルームマスターの場合のみ
            // 「CONFIRMED」ボタン：キャラクターセレクト確定モーダル表示イベント発火。全キャラクターの選択完了時のみ選択可能
            ops.push({ label: 'CONFIRMED', onClick: () => dispatchModal({ type: 'OPEN', modal: 'characterSelectConfirm' }), disabled: !allSelected });
          }
          break;
        }
      case 'commonInfo':
        // 共通情報
        // 観戦者の場合はボタン表示なし
        if (myPlayer?.isSpectator) return [];
        // 「NEXT」ボタン：個別情報へ移動
        ops.push({ label: 'NEXT ▶', onClick: () => setGamePhase('individualStory') })
        break;
      case 'individualStory': {
        // 個別情報
        // 「BACK」ボタン：共通情報へ移動
        ops.push({ label: '◀ BACK', onClick: () => setGamePhase('commonInfo') })
        if (myPlayer?.isMaster) {
          // ルームマスターの場合
          // 「第一議論へ」ボタン：第一議論フェイズへ移動
          ops.push({ label: '第一議論へ', onClick: () => dispatchModal({ type: 'OPEN', modal: 'hoReadForcedEnd' }) });
        }
        break;
      }
      case 'interlude':
        // 中間情報
        // 「第二議論へ」ボタン：第二議論フェイズへ移動
        ops.push({ label: '第二議論へ', onClick: handleProceedToSecondDiscussion });
        break;
      case 'ending':
        // エンディング
        // 「感想戦へ」ボタン：感想戦へ移動
        ops.push({ label: '感想戦へ', onClick: handleProceedToDebriefing });
        break;
      default:
        // その他（第一議論、第二議論、感想戦（別途記載））
        break;
    }
    // 投票フェイズの場合、緊急解散ボタン
    if (gamePhase === 'voting' && myPlayer?.isMaster) {
      ops.push({ label: '【緊急用】ルーム解散', onClick: () => dispatchModal({type: 'OPEN', modal: 'confirmCloseRoom' }) });
    }
    // 感想戦または観戦者の場合、退室ボタン
    if (gamePhase === 'debriefing' || myPlayer?.isSpectator) {
      ops.push({ label: '退室', onClick: () => dispatchModal({ type: 'OPEN', modal: 'leaveConfirm' }) });
    }
    return ops;
  };

  return (
    <div className="App">
      {loadingMessage && (
        <LoadingOverlay message={loadingMessage} />
      )}
      {activeSkillState.status === 'selecting_target' && (
        <SkillOverlay
          skillInfoData={skillInfo}
          skillId={activeSkillState.skillId!}
          infoCards={infoCards}
          myPlayer={myPlayer!}
          onSelectTarget={handleSkillTargetSelect}
          onCancel={handleCancelSkill}
        />
      )}
      {phasesToShowHeaderFooter.includes(gamePhase) &&
        <Breadcrumbs
          currentPhase={gamePhase}
        />}
      <div className="AppContent">
        <div className="AppContent-inner">
          {renderScreen()}
        </div>
      </div>
      {phasesToShowHeaderFooter.includes(gamePhase) &&
        <Footer
          currentPhase={gamePhase}
          players={players}
          myPlayer={myPlayer}
          characters={scenario!.characters}
          characterSelections={characterSelections}
          readingTimerSeconds={shouldShowReadingTimer ? remainingTime : 0}
          discussionTimer={discussionTimer}
          onHowTo={() => {
            if (myPlayer?.isSpectator) {
              return; // 観戦者はチュートリアル無効化
            }
            if (gamePhase === 'firstDiscussion' || gamePhase === 'secondDiscussion') {
              // 議論フェイズの場合はチュートリアルツアーを呼び出す
              setDiscussionHowtoSeq(s => s + 1);
            } else {
              // 議論フェイズ以外の場合はモーダル表示
              dispatchModal({ type: 'OPEN', modal: 'screenHowto' });
            }
          }}
          onSetStandBy={() => socket && socketService.emitSetStandBy(socket, roomId, userId, true)}
          operationButtons={operationButtonsForPhase()}
          onStartTimer={() => handleStartDiscussionTimer(gamePhase as any, discussionSeconds)}
          onPauseTimer={handlePauseDiscussionTimer}
          onResumeTimer={handleResumeDiscussionTimer}
          onRequestEnd={handleRequestEndDiscussion}
        />}

      <AppModals
        modalState={modalState}
        dispatchModal={dispatchModal}
        myPlayer={myPlayer}
        voteResult={voteResult}
        scenario={scenario}
        getCardErrorMessage={getCardErrorMessage}
        username={username}
        roomId={roomId}
        errorMessage={errorMessage}
        skillMessage={skillMessage}
        handleCharacterConfirm={handleCharacterConfirm}
        handleProceedToDiscussion={handleProceedToDiscussion}
        handleExtendTimer={handleExtendTimer}
        handleProceedToEnding={handleProceedToEnding}
        handleConfirmCloseRoom={handleConfirmCloseRoom}
        handleCreateRoom={handleCreateRoom}
        handleConfirmSkillUse={handleConfirmSkillUse}
        setUsername={setUsername}
        setErrorMessage={setErrorMessage}
        handleJoinRoom={handleJoinRoom}
        handleSpectateRoom={handleSpectateRoom}
        setRoomId={setRoomId}
        currentPhase={gamePhase}
        handleConfirmLeave={handleConfirmLeave}
      />
    </div>
  );
}

export default App;
