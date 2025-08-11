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
import Timer from './components/Timer';
import AppModals from './components/AppModals';
import './style.css';
import SkillOverlay from './components/SkillOverlay';
import Breadcrumbs from './components/Breadcrumbs';
import * as socketService from './socketService';
import { type SocketEventHandlers } from './socketService';

// --- モーダル管理用Reducer ---
type ModalType =
  'createRoom' |
  'findRoom' |
  'expMurder' |
  'hoReadForcedEnd' |
  'hoReadEnd' |
  'voteResult' |
  'voteTied' |
  'getCardError' |
  'confirmCloseRoom' |
  'characterSelectConfirm' |
  'skillConfirm';
type ModalState = Record<ModalType, boolean>;
type ModalAction =
  { type: 'OPEN'; modal: ModalType } |
  { type: 'CLOSE'; modal: ModalType } |
  { type: 'CLOSE_ALL' };

const initialModalState: ModalState = {
  createRoom: false,
  findRoom: false,
  expMurder: false,
  hoReadForcedEnd: false,
  hoReadEnd: false,
  voteResult: false,
  voteTied: false,
  getCardError: false,
  confirmCloseRoom: false,
  characterSelectConfirm: false,
  skillConfirm: false
};

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
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [modalState, dispatchModal] = useReducer(modalReducer, initialModalState);
  const [getCardErrorMessage, setGetCardErrorMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skillMessage, setSkillMessage] = useState<string>('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSelections, setCharacterSelections] = useState<CharacterSelections>({});
  const [readingTimerEndTime, setReadingTimerEndTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [infoCards, setInfoCards] = useState<InfoCard[]>([]);
  const [discussionTimer, setDiscussionTimer] = useState<DiscussionTimer>({ endTime: null, isTicking: false, phase: null, endState: 'none' });
  const [voteState, setVoteState] = useState<VoteState>({});
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);

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
      setMaxPlayers,
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
        setGamePhase('start');
        setRoomId('');
        setPlayers([]);
        setMyPlayer(null);
        setCharacterSelections({});
        setSelectedCharacterId(null);
        setReadingTimerEndTime(null);
        setInfoCards([]);
        setDiscussionTimer({ endTime: null, isTicking: false, phase: null, endState: 'none' });
        setVoteState({});
        setVoteResult(null);
        setGameLog([]);
        localStorage.removeItem('roomId');
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
      if (storedRoomId && storedUserId && storedUsername) {
        console.log(`Attempting to rejoin room ${storedRoomId} as ${storedUsername}`);
        socketService.emitJoinRoom(newSocket, storedUsername, storedUserId, storedRoomId);
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
    localStorage.setItem('username', username);
    socketService.emitCreateRoom(socket, username, userId);
  };

  const handleJoinRoom = () => {
    if (!socket) return;
    if (username.trim() === '' || roomId.trim() === '') return setErrorMessage('ユーザー名とルームIDを入力してください。');
    localStorage.setItem('username', username);
    socketService.emitJoinRoom(socket, username, userId, roomId);
  };

  const handleLeaveRoom = () => {
    if (!socket) return;
    socketService.emitLeaveRoom(socket, roomId, userId);
    // 状態をリセット
    setGamePhase('start');
    setRoomId('');
    setPlayers([]);
    setMyPlayer(null);
    setInfoCards([]);
    setDiscussionTimer({ endTime: null, isTicking: false, phase: null, endState: 'none' });
    setVoteState({});
    setVoteResult(null);
    localStorage.removeItem('roomId');
  };

  const handleCloseRoom = () => dispatchModal({ type: 'OPEN', modal: 'confirmCloseRoom' });
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

  const renderScreen = () => {
    if (gamePhase !== 'splash' && (!scenario || !skillInfo)) return <div>ゲームデータを読み込んでいます...</div>;
    if (gamePhase !== 'splash' && gamePhase !== 'start' && !myPlayer) {
      return <div>プレイヤー情報を読み込んでいます...ページをリロードしてしばらく待ってもこの画面が消えない場合は、最初からやり直してください。</div>;
    }

    const characterDependentPhases: GamePhase[] = ['individualStory', 'firstDiscussion', 'secondDiscussion', 'voting', 'ending', 'debriefing'];
    if (characterDependentPhases.includes(gamePhase) && !selectedCharacterId) {
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
      case 'start': return <StartScreen title={scenario!.title} titleImage={scenario!.titleImage} onCreateRoom={() => dispatchModal({ type: 'OPEN', modal: 'createRoom' })} onFindRoom={() => dispatchModal({ type: 'OPEN', modal: 'findRoom' })} onExpMurder={() => dispatchModal({ type: 'OPEN', modal: 'expMurder' })} />;
      case 'waiting': return <WaitingScreen roomId={roomId} players={players} isMaster={myPlayer?.isMaster || false} maxPlayers={maxPlayers} onLeave={handleLeaveRoom} onClose={handleCloseRoom} onStart={handleStartGame} />;
      case 'introduction': return <InfoDisplayScreen title="はじめに" filePath={scenario!.introductionFile} onBackFlg={false} onBack={() => { }} onNext={() => setGamePhase('synopsis')} />;
      case 'synopsis': return <InfoDisplayScreen title="あらすじ" filePath={scenario!.synopsisFile} onBackFlg={true} onBack={() => setGamePhase('introduction')} onNext={() => setGamePhase('characterSelect')} />;
      case 'characterSelect': return <CharacterSelectScreen characters={scenario!.characters} onBack={() => setGamePhase('synopsis')} onCharacterSelect={handleCharacterSelect} characterSelections={characterSelections} myPlayerId={userId} isMaster={myPlayer?.isMaster || false} onConfirm={() => dispatchModal({ type: 'OPEN', modal: 'characterSelectConfirm' })} players={players} />;
      case 'commonInfo': return (
        <>
          <InfoDisplayScreen title="ハンドアウト読み込み：共通情報" filePath={scenario!.commonInfo.textFile} onBackFlg={false} onBack={() => { }} onNext={() => setGamePhase('individualStory')} />
        </>
      );
      case 'individualStory':
        if (!selectedChar) return <div>選択されたキャラクター情報が見つかりません。</div>;
        return (
          <>
            <IndividualStoryScreen
              character={selectedChar}
              onBack={() => setGamePhase('commonInfo')}
              onNext={() => dispatchModal({ type: 'OPEN', modal: 'hoReadForcedEnd' })}
              isMaster={myPlayer?.isMaster || false} />
          </>
        );
      case 'firstDiscussion':
        if (!selectedChar || !myPlayer) return <div>選択されたキャラクター情報が見つかりません。</div>;
        const tabItems1: TabItem[] = [
          { label: '遊び方', content: <TextRenderer filePath={scenario!.discussionPhaseSettings.howto} /> },
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: selectedChar.storyFile ? <TextRenderer filePath={selectedChar.storyFile} /> : <div /> },
          { label: '現場見取り図', content: selectedChar.mapImageFile ? <img src={selectedChar.mapImageFile} className="discuttion-map-image" alt="現場見取り図" style={{ maxWidth: '700px', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        return <DiscussionScreen
          title="第一議論フェイズ"
          gamePhase={gamePhase}
          character={selectedChar}
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
        />;
      case 'interlude': return <InfoDisplayScreen title="中間情報" filePath={scenario!.intermediateInfo.textFile} onBackFlg={false} onBack={() => { }} onNext={handleProceedToSecondDiscussion} />;
      case 'secondDiscussion':
        if (!selectedChar || !myPlayer) return <div>選択されたキャラクター情報が見つかりません。</div>;
        const tabItems2: TabItem[] = [
          { label: '遊び方', content: <TextRenderer filePath={scenario!.discussionPhaseSettings.howto} /> },
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: selectedChar.storyFile ? <TextRenderer filePath={selectedChar.storyFile} /> : <div /> },
          { label: '中間情報', content: <TextRenderer filePath={scenario!.intermediateInfo.textFile} /> },
          { label: '現場見取り図', content: selectedChar.mapImageFile ? <img src={selectedChar.mapImageFile} alt="現場見取り図" style={{ maxWidth: '700px', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        return <DiscussionScreen
          title="第二議論フェイズ"
          gamePhase={gamePhase}
          character={selectedChar}
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
        />;
      case 'voting':
        if (!myPlayer) return <div>プレイヤー情報がありません。</div>;
        return <VotingScreen
          characters={scenario!.characters.filter(c => c.type === 'PC')}
          players={players}
          myPlayer={myPlayer}
          voteState={voteState}
          voteResult={voteResult}
          onSubmitVote={handleSubmitVote} />;
      case 'ending':
        if (!voteResult) return <div>投票結果がありません。</div>;
        let targetEnding = scenario!.endings.find(end => end.votedCharId === voteResult.votedCharacterId) || scenario!.endings.find(end => end.votedCharId === 'default');
        if (!targetEnding) return <div>対応するエンディングが見つかりません。</div>;
        return <EndingScreen
          ending={targetEnding}
          onNext={handleProceedToDebriefing}
        />;
      case 'debriefing': return <DebriefingScreen scenario={scenario!} infoCards={infoCards} players={players} isMaster={myPlayer?.isMaster || false} onCloseRoom={handleCloseRoom} />;
      default: return <SplashScreen onNext={() => setGamePhase('start')} />;
    }
  };

  const phasesToShowBreadcrumbs: GamePhase[] = [
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

  return (
    <div className="App">
      {shouldShowReadingTimer && remainingTime > 0 && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: '1001' }}>
          <Timer initialSeconds={remainingTime} isTicking={true} onTimeUp={() => { }} />
        </div>
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
      {phasesToShowBreadcrumbs.includes(gamePhase) && <Breadcrumbs currentPhase={gamePhase} />}
      {renderScreen()}

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
        setRoomId={setRoomId}
      />
    </div>
  );
}

export default App;