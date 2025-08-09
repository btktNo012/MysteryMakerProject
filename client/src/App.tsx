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
import { type ScenarioData, type Player, type CharacterSelections, type InfoCard, type DiscussionTimer, type VoteState, type VoteResult, type SkillInfoData, type GameLogEntry } from './types';
import { type TabItem } from './components/Tabs';
import { useSkills } from './hooks/useSkills';
import TextRenderer from './components/TextRenderer';
import Timer from './components/Timer';
import AppModals from './components/AppModals';
import './style.css';
import SkillOverlay from './components/SkillOverlay';

type GamePhase =
  'splash' |
  'start' |
  'waiting' |
  'introduction' |
  'synopsis' |
  'characterSelect' |
  'commonInfo' |
  'individualStory' |
  'firstDiscussion' |
  'interlude' |
  'secondDiscussion' |
  'voting' |
  'ending' |
  'debriefing';

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
    if (skillConfirmModal.card && activeSkillState.skillId) {
      socket?.emit('useActiveSkill', {
        roomId,
        userId,
        skillId: activeSkillState.skillId,
        payload: { targetCardId: skillConfirmModal.card.id }
      });
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

    // 3. 接続後の処理
    newSocket.on('connect', () => {
      console.log('Connected to server with socket ID:', newSocket.id);
      // 4. ゲーム復帰処理
      const storedRoomId = localStorage.getItem('roomId');
      const storedUsername = localStorage.getItem('username'); // 復帰にはusernameも必要
      if (storedRoomId && storedUserId && storedUsername) {
        console.log(`Attempting to rejoin room ${storedRoomId} as ${storedUsername}`);
        newSocket.emit('joinRoom', {
          roomId: storedRoomId,
          userId: storedUserId, // ステートではなくローカル変数を使う
          username: storedUsername
        });
      }
    });

    // --- サーバーからのイベントリスナー ---

    // ルーム作成完了
    newSocket.on('roomCreated', (data) => {
      console.log('Room created:', data);
      setRoomId(data.roomId);
      setPlayers(data.players);
      setMyPlayer(data.yourPlayer);
      setMaxPlayers(data.maxPlayers);
      setCharacterSelections(data.characterSelections);
      setInfoCards(data.infoCards);
      setDiscussionTimer(data.discussionTimer);
      setVoteState(data.votes);
      setVoteResult(data.voteResult);
      setGameLog(data.gameLog);
      setGamePhase(data.gamePhase);
      dispatchModal({ type: 'CLOSE', modal: 'createRoom' });
      localStorage.setItem('roomId', data.roomId);
    });

    // ルーム参加・復帰完了
    newSocket.on('roomJoined', (data) => {
      console.log('Room joined:', data);
      setRoomId(data.roomId);
      setPlayers(data.players);
      setMyPlayer(data.yourPlayer);
      setMaxPlayers(data.maxPlayers);
      setCharacterSelections(data.characterSelections);
      setInfoCards(data.infoCards);
      setDiscussionTimer(data.discussionTimer);
      setVoteState(data.votes);
      setVoteResult(data.voteResult);
      setGameLog(data.gameLog);
      setGamePhase(data.gamePhase);
      setReadingTimerEndTime(data.readingTimerEndTime);
      dispatchModal({ type: 'CLOSE', modal: 'findRoom' });
      dispatchModal({ type: 'CLOSE', modal: 'expMurder' });
      localStorage.setItem('roomId', data.roomId);
    });

    // プレイヤー情報更新
    newSocket.on('updatePlayers', (data: { players: Player[] }) => {
      setPlayers(data.players);

      // 自分のプレイヤー情報も更新 (refを使って最新のuserIdを参照する)
      const me = data.players.find((p: Player) => p.userId === userIdRef.current);
      if (me) {
        setMyPlayer(me);
      } else {
        console.log('Could not find myPlayer in update.');
      }
    });

    // ゲームフェーズ変更
    newSocket.on('gamePhaseChanged', (newPhase) => {
      console.log('Game phase changed to:', newPhase);
      setGamePhase(newPhase);
      if (newPhase === 'firstDiscussion') {
        dispatchModal({ type: 'CLOSE', modal: 'hoReadForcedEnd' });
        dispatchModal({ type: 'CLOSE', modal: 'hoReadEnd' });
        setReadingTimerEndTime(null);
      }
      if (newPhase === 'debriefing') {
        setReadingTimerEndTime(null);
      }
    });

    // キャラクター選択状況更新
    newSocket.on('characterSelectionUpdated', setCharacterSelections);

    // 情報カード更新
    newSocket.on('infoCardsUpdated', (updatedInfoCards) => {
      console.log('Info cards updated');
      setInfoCards(updatedInfoCards);
    });

    // ゲームログ更新
    newSocket.on('gameLogUpdated', (log) => {
      console.log('Game log updated');
      setGameLog(log);
    });

    // 議論タイマー更新
    newSocket.on('discussionTimerUpdated', (timer) => {
      console.log('Discussion timer updated', timer);
      setDiscussionTimer(timer);
    });

    // 投票状況更新
    newSocket.on('voteStateUpdated', (votes) => {
      console.log('Vote state updated', votes);
      setVoteState(votes);
    });

    // 決選投票
    newSocket.on('voteTied', () => {
      console.log('Vote tied, re-voting required.');
      dispatchModal({ type: 'OPEN', modal: 'voteTied' });
      setVoteState({}); // 投票状況をリセット
    });

    // 投票結果確定（モーダル表示用）
    newSocket.on('voteResultFinalized', ({ result, votes }) => {
      console.log('Vote result finalized', result);
      setVoteResult(result);
      setVoteState(votes);
      dispatchModal({ type: 'OPEN', modal: 'voteResult' }); // モーダルを表示
    });

    // 投票結果確定
    newSocket.on('voteResultConfirmed', ({ result, votes }) => {
      console.log('Vote result confirmed', result);
      setVoteResult(result);
      setVoteState(votes);
      // gamePhaseの変更はgamePhaseChangedイベントで処理
    });

    // キャラクター選択確定
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

    // HOタイマー延長
    newSocket.on('readingTimeExtended', ({ endTime }) => {
      setReadingTimerEndTime(endTime);
      dispatchModal({ type: 'CLOSE', modal: 'hoReadEnd' });
    });

    // エラーハンドリング
    newSocket.on('roomNotFound', () => {
      setErrorMessage('ルームが見つかりません。');
      localStorage.removeItem('roomId'); // 見つからない場合はlocalStorageから削除
    });
    newSocket.on('roomFull', () => setErrorMessage('そのルームは満員です。'));

    newSocket.on('getCardError', ({ message }: { message: string }) => {
      setGetCardErrorMessage(message);
      dispatchModal({ type: 'OPEN', modal: 'getCardError' });
    });

    // ルーム解散
    newSocket.on('roomClosed', () => {
      console.log('Room closed by server');
      // 状態をリセット
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
      // localStorageからroomIdを削除
      localStorage.removeItem('roomId');
    });

    // クリーンアップ
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
    if (username.trim() === '') return setErrorMessage('ユーザー名を入力してください。');
    localStorage.setItem('username', username);
    socket?.emit('createRoom', { username, userId });
  };

  const handleJoinRoom = () => {
    if (username.trim() === '' || roomId.trim() === '') return setErrorMessage('ユーザー名とルームIDを入力してください。');
    localStorage.setItem('username', username);
    socket?.emit('joinRoom', { username, userId, roomId });
  };

  const handleLeaveRoom = () => {
    socket?.emit('leaveRoom', { roomId, userId });
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
    socket?.emit('closeRoom', { roomId, userId });
    dispatchModal({ type: 'CLOSE', modal: 'confirmCloseRoom' });
  }
  const handleStartGame = () => socket?.emit('startGame', { roomId, userId });
  const handleCharacterSelect = (characterId: string | null) => socket?.emit('selectCharacter', { roomId, userId, characterId });
  const handleCharacterConfirm = () => {
    dispatchModal({ type: 'CLOSE', modal: 'characterSelectConfirm' });
    socket?.emit('confirmCharacters', { roomId, userId })
  };
  const handleExtendTimer = () => socket?.emit('extendReadingTimer', { roomId, userId });
  const handleProceedToDiscussion = () => socket?.emit('proceedToFirstDiscussion', { roomId, userId });

  // 情報カード操作ハンドラ
  const handleGetCard = (cardId: string) => socket?.emit('getCard', { roomId, userId, cardId });
  const handleMakeCardPublic = (cardId: string) => socket?.emit('makeCardPublic', { roomId, userId, cardId });
  const handleTransferCard = (cardId: string, targetUserId: string) => socket?.emit('transferCard', { roomId, userId, cardId, targetUserId });

  // 議論タイマー操作ハンドラ
  const handleStartDiscussionTimer = (phase: 'firstDiscussion' | 'secondDiscussion', durationSeconds: number) => socket?.emit('startDiscussionTimer', { roomId, userId, phase, durationSeconds });
  const handlePauseDiscussionTimer = () => socket?.emit('pauseDiscussionTimer', { roomId, userId });
  const handleResumeDiscussionTimer = () => socket?.emit('resumeDiscussionTimer', { roomId, userId });
  const handleRequestEndDiscussion = () => socket?.emit('requestEndDiscussion', { roomId, userId });
  const handleCancelEndDiscussion = () => socket?.emit('cancelEndDiscussion', { roomId, userId });
  const handleConfirmEndDiscussion = () => socket?.emit('confirmEndDiscussion', { roomId, userId });

  // 投票ハンドラ
  const handleSubmitVote = (votedCharacterId: string) => socket?.emit('submitVote', { roomId, userId, votedCharacterId });
  const handleProceedToEnding = () => {
    socket?.emit('changeGamePhase', { roomId, newPhase: 'ending' });
    setGamePhase('ending');
    dispatchModal({ type: 'CLOSE', modal: 'voteResult' }); // モーダルを閉じる
  }

  // エンディング・感想戦ハンドラ
  const handleProceedToDebriefing = () => {
    socket?.emit('changeGamePhase', { roomId, newPhase: 'debriefing' });
    setGamePhase('debriefing');
  }

  const handleProceedToSecondDiscussion = () => {
    socket?.emit('changeGamePhase', { roomId, newPhase: 'secondDiscussion' });
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
