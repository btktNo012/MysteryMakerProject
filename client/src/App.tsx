import { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// 各画面コンポーネントをインポート
import AttentionScreen from './screens/AttentionScreen';
import StartScreen from './screens/StartScreen';
import WaitingScreen from './screens/WaitingScreen';
import InfoDisplayScreen from './screens/InfoDisplayScreen';
import CharacterSelectScreen from './screens/CharacterSelectScreen';
import IndividualStoryScreen from './screens/IndividualStoryScreen';
import DiscussionScreen from './screens/DiscussionScreen';
import VotingScreen from './screens/VotingScreen';
import EndingScreen from './screens/EndingScreen';
import DebriefingScreen from './screens/DebriefingScreen';
import { type ScenarioData, type Player, type CharacterSelections, type InfoCard, type DiscussionTimer, type VoteState, type VoteResult } from './types';
import { type TabItem } from './components/Tabs';
import TextRenderer from './components/TextRenderer';
import Timer from './components/Timer';
import Modal from './components/Modal';
import './style.css';

type GamePhase = 'attention' | 'start' | 'waiting' | 'schedule' | 'synopsis' | 'characterSelect' | 'commonInfo' | 'individualStory' | 'firstDiscussion' | 'interlude' | 'secondDiscussion' | 'voting' | 'ending' | 'debriefing'

// --- 定数 ---
const FIRST_DISCUSSION_SECONDS = 600;
const SECOND_DISCUSSION_SECONDS = 600;

function App() {
  // --- ステート定義 ---
  const [gamePhase, setGamePhase] = useState<GamePhase>('attention');
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userId, setUserId] = useState(''); // 永続的なユーザーID
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isFindRoomModalOpen, setIsFindRoomModalOpen] = useState(false);
  const [isExpMurderModalOpen, setIsExpMurderModalOpen] = useState(false);
  const [isHoReadEndModalOpen, setIsHoReadEndModalOpen] = useState(false);
  const [isVoteResultModalOpen, setIsVoteResultModalOpen] = useState(false);
  const [isVoteTiedModalOpen, setIsVoteTiedModalOpen] = useState(false);
  const [isGetCardErrorModalOpen, setIsGetCardErrorModalOpen] = useState(false);
  const [getCardErrorMessage, setGetCardErrorMessage] = useState('');
  const [isConfirmCloseRoomModalOpen, setIsConfirmCloseRoomModalOpen] = useState(false);
  const [isCharacterSelectConfirmModalOpen, setIsCharacterSelectConfirmModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSelections, setCharacterSelections] = useState<CharacterSelections>({});
  const [readingTimerEndTime, setReadingTimerEndTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [infoCards, setInfoCards] = useState<InfoCard[]>([]);
  const [discussionTimer, setDiscussionTimer] = useState<DiscussionTimer>({ endTime: null, isTicking: false, phase: null, endState: 'none' });
  const [voteState, setVoteState] = useState<VoteState>({});
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);

  const characterSelectionsRef = useRef(characterSelections);
  useEffect(() => {
    characterSelectionsRef.current = characterSelections;
  }, [characterSelections]);

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
    const newSocket = io('http://localhost:3001');
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
          userId: storedUserId,
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
      setGamePhase(data.gamePhase);
      setIsCreateRoomModalOpen(false);
      localStorage.setItem('roomId', data.roomId);
      localStorage.setItem('username', username); // usernameも保存
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
      setGamePhase(data.gamePhase);
      setReadingTimerEndTime(data.readingTimerEndTime);
      setIsFindRoomModalOpen(false);
      setIsExpMurderModalOpen(false);
      localStorage.setItem('roomId', data.roomId);
      if (username) localStorage.setItem('username', username); // usernameも保存
    });

    // プレイヤー情報更新
    newSocket.on('updatePlayers', (data) => {
      console.log('Players updated:', data);
      setPlayers(data.players);
      // 自分のプレイヤー情報も更新
      const me = data.players.find((p: Player) => p.userId === userId);
      if (me) {
        setMyPlayer(me);
      }
    });

    // ゲームフェーズ変更
    newSocket.on('gamePhaseChanged', (newPhase) => {
      console.log('Game phase changed to:', newPhase);
      setGamePhase(newPhase);
      if (newPhase === 'firstDiscussion') {
        setIsHoReadEndModalOpen(false);
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
      setIsVoteTiedModalOpen(true);
      setVoteState({}); // 投票状況をリセット
    });

    // 投票結果確定（モーダル表示用）
    newSocket.on('voteResultFinalized', ({ result, votes }) => {
      console.log('Vote result finalized', result);
      setVoteResult(result);
      setVoteState(votes);
      setIsVoteResultModalOpen(true); // モーダルを表示
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
      setIsHoReadEndModalOpen(false);
    });

    // エラーハンドリング
    newSocket.on('roomNotFound', () => {
      setErrorMessage('ルームが見つかりません。');
      localStorage.removeItem('roomId'); // 見つからない場合はlocalStorageから削除
    });
    newSocket.on('roomFull', () => setErrorMessage('そのルームは満員です。'));

    newSocket.on('getCardError', ({ message }: { message: string }) => {
      setGetCardErrorMessage(message);
      setIsGetCardErrorModalOpen(true);
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
      // localStorageからroomIdを削除
      localStorage.removeItem('roomId');
    });

    // クリーンアップ
    return () => {
      console.log('Disconnecting socket...');
      newSocket.disconnect();
    };
  }, []); // このuseEffectはマウント時に一度だけ実行する

  useEffect(() => {
    fetch('/scenario.json')
      .then(response => response.json())
      .then(data => setScenario(data))
      .catch(error => console.error("シナリオの読み込みに失敗:", error));
  }, []);

  // タイマー処理
  useEffect(() => {
    if (readingTimerEndTime === null) {
      setRemainingTime(0);
      return;
    }

    const updateRemainingTime = () => {
      const now = Date.now();
      const diff = Math.round((readingTimerEndTime - now) / 1000);
      setRemainingTime(diff > 0 ? diff : 0);
      if (diff <= 0) {
        setIsHoReadEndModalOpen(true);
      }
    };

    updateRemainingTime();
    const timerId = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(timerId);
  }, [readingTimerEndTime, myPlayer]);


  // --- イベントハンドラ ---
  const handleCreateRoom = () => {
    if (username.trim() === '') return setErrorMessage('ユーザー名を入力してください。');
    socket?.emit('createRoom', { username, userId });
  };

  const handleJoinRoom = () => {
    if (username.trim() === '' || roomId.trim() === '') return setErrorMessage('ユーザー名とルームIDを入力してください。');
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

  const handleCloseRoom = () => setIsConfirmCloseRoomModalOpen(true);
  const handleConfirmCloseRoom = () => {
    socket?.emit('closeRoom', { roomId, userId });
    setIsConfirmCloseRoomModalOpen(false);
  }
  const handleStartGame = () => socket?.emit('startGame', { roomId, userId });
  const handleCharacterSelect = (characterId: string | null) => socket?.emit('selectCharacter', { roomId, userId, characterId });
  const handleCharacterConfirm = () => {
    setIsCharacterSelectConfirmModalOpen(false);
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
    setIsVoteResultModalOpen(false); // モーダルを閉じる
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
    if (gamePhase !== 'attention' && !scenario) return <div>シナリオを読み込んでいます...</div>;
    if (gamePhase !== 'attention' && gamePhase !== 'start' && !myPlayer) {
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

    switch (gamePhase) {
      case 'attention': return <AttentionScreen onNext={() => setGamePhase('start')} />;
      case 'start': return <StartScreen title={scenario!.title} titleImage={scenario!.titleImage} onCreateRoom={() => setIsCreateRoomModalOpen(true)} onFindRoom={() => setIsFindRoomModalOpen(true)} onExpMurder={() => setIsExpMurderModalOpen(true)} />;
      case 'waiting': return <WaitingScreen roomId={roomId} players={players} isMaster={myPlayer?.isMaster || false} maxPlayers={maxPlayers} onLeave={handleLeaveRoom} onClose={handleCloseRoom} onStart={handleStartGame} />;
      case 'schedule': return <InfoDisplayScreen title="進行スケジュール" filePath={scenario!.scheduleFile} onBackFlg={false} onBack={() => { }} onNext={() => setGamePhase('synopsis')} />;
      case 'synopsis': return <InfoDisplayScreen title="あらすじ" filePath={scenario!.synopsisFile} onBackFlg={true} onBack={() => setGamePhase('schedule')} onNext={() => setGamePhase('characterSelect')} />;
      case 'characterSelect': return <CharacterSelectScreen characters={scenario!.characters} onBack={() => setGamePhase('synopsis')} onCharacterSelect={handleCharacterSelect} characterSelections={characterSelections} myPlayerId={userId} isMaster={myPlayer?.isMaster || false} onConfirm={()=>setIsCharacterSelectConfirmModalOpen(true)} players={players} />;
      case 'commonInfo': return (
        <>
          <InfoDisplayScreen title="ハンドアウト読み込み：共通情報" filePath={scenario!.commonInfo.textFile} onBackFlg={false} onBack={() => { }} onNext={() => setGamePhase('individualStory')} />
        </>
      );
      case 'individualStory':
        if (!selectedChar) return <div>選択されたキャラクター情報が見つかりません。</div>;
        return (
          <>
            <IndividualStoryScreen character={selectedChar} onBack={() => setGamePhase('commonInfo')} onNext={handleProceedToDiscussion} isMaster={myPlayer?.isMaster || false} />
          </>
        );
      case 'firstDiscussion':
        if (!selectedChar || !myPlayer) return <div>選択されたキャラクター情報が見つかりません。</div>;
        const tabItems1: TabItem[] = [
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: selectedChar.storyFile ? <TextRenderer filePath={selectedChar.storyFile} /> : <div /> },
          { label: '現場見取り図', content: selectedChar.mapImageFile ? <img src={selectedChar.mapImageFile} alt="現場見取り図" style={{ maxWidth: '100%', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        return <DiscussionScreen
          title="第一議論フェイズ"
          gamePhase={gamePhase}
          character={selectedChar}
          tabItems={tabItems1}
          discussionTime={FIRST_DISCUSSION_SECONDS}
          infoCards={infoCards}
          players={players}
          myPlayer={myPlayer}
          scenarioData={scenario!}
          characterSelections={characterSelections}
          onGetCard={handleGetCard}
          onMakeCardPublic={handleMakeCardPublic}
          onTransferCard={handleTransferCard}
          discussionTimer={discussionTimer}
          onStartTimer={() => handleStartDiscussionTimer('firstDiscussion', FIRST_DISCUSSION_SECONDS)}
          onPauseTimer={handlePauseDiscussionTimer}
          onResumeTimer={handleResumeDiscussionTimer}
          onRequestEnd={handleRequestEndDiscussion}
          onCancelEnd={handleCancelEndDiscussion}
          onConfirmEnd={handleConfirmEndDiscussion}
        />;
      case 'interlude': return <InfoDisplayScreen title="中間情報" filePath={scenario!.intermediateInfo.textFile} onBackFlg={false} onBack={() => { }} onNext={handleProceedToSecondDiscussion} />;
      case 'secondDiscussion':
        if (!selectedChar || !myPlayer) return <div>選択されたキャラクター情報が見つかりません。</div>;
        const tabItems2: TabItem[] = [
          { label: '共通情報', content: <TextRenderer filePath={scenario!.commonInfo.textFile} /> },
          { label: '個別ストーリー', content: selectedChar.storyFile ? <TextRenderer filePath={selectedChar.storyFile} /> : <div /> },
          { label: '中間情報', content: <TextRenderer filePath={scenario!.intermediateInfo.textFile} /> },
          { label: '現場見取り図', content: selectedChar.mapImageFile ? <img src={selectedChar.mapImageFile} alt="現場見取り図" style={{ maxWidth: '100%', height: 'auto' }} /> : <div>地図情報はありません。</div> }
        ];
        return <DiscussionScreen
          title="第二議論フェイズ"
          gamePhase={gamePhase}
          character={selectedChar}
          tabItems={tabItems2}
          discussionTime={SECOND_DISCUSSION_SECONDS}
          infoCards={infoCards}
          players={players}
          myPlayer={myPlayer}
          scenarioData={scenario!}
          characterSelections={characterSelections}
          onGetCard={handleGetCard}
          onMakeCardPublic={handleMakeCardPublic}
          onTransferCard={handleTransferCard}
          discussionTimer={discussionTimer}
          onStartTimer={() => handleStartDiscussionTimer('secondDiscussion', SECOND_DISCUSSION_SECONDS)}
          onPauseTimer={handlePauseDiscussionTimer}
          onResumeTimer={handleResumeDiscussionTimer}
          onRequestEnd={handleRequestEndDiscussion}
          onCancelEnd={handleCancelEndDiscussion}
          onConfirmEnd={handleConfirmEndDiscussion}
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
          onProceedToEnding={handleProceedToEnding} />;
      case 'ending':
        if (!voteResult) return <div>投票結果がありません。</div>;
        let targetEnding = scenario!.endings.find(end => end.votedCharId === voteResult.votedCharacterId) || scenario!.endings.find(end => end.votedCharId === 'default');
        if (!targetEnding) return <div>対応するエンディングが見つかりません。</div>;
        return <EndingScreen
          ending={targetEnding}
          onNext={handleProceedToDebriefing}
        />;
      case 'debriefing': return <DebriefingScreen scenario={scenario!} infoCards={infoCards} players={players} isMaster={myPlayer?.isMaster || false} onCloseRoom={handleCloseRoom} />;
      default: return <AttentionScreen onNext={() => setGamePhase('start')} />;
    }
  };

  return (
    <div className="App">
      {shouldShowReadingTimer && remainingTime > 0 && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: '1001' }}>
          <Timer initialSeconds={remainingTime} isTicking={true} onTimeUp={() => { }} />
        </div>
      )}

      {renderScreen()}

      <Modal
        isOpen={isCharacterSelectConfirmModalOpen}
        message="ハンドアウト読み込み画面に移動しますか？"
        onConfirm={handleCharacterConfirm}
        onClose={() => setIsCharacterSelectConfirmModalOpen(false)}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      >
        <div className='modal-message'>移動すると同時にタイマーが起動します。全員の準備が終わったことを確認してから次へ進んでください。</div>
      </Modal>
      <Modal
        isOpen={isHoReadEndModalOpen}
        message={myPlayer?.isMaster ? "第一議論フェイズ画面に移動しますか？" : "ルームマスターが操作中です..."}
        onConfirm={myPlayer?.isMaster ? handleProceedToDiscussion : undefined}
        onClose={myPlayer?.isMaster ? handleExtendTimer : undefined}
        confirmButtonText="OK"
        closeButtonText={myPlayer?.isMaster ? "延長する(3分)" : undefined}
      />

      <Modal
        isOpen={isVoteResultModalOpen}
        message={`投票の結果、${scenario?.characters.find(c => c.id === voteResult?.votedCharacterId)?.name || ''}が選ばれました`}
        onConfirm={handleProceedToEnding}
        confirmButtonText="OK"
      >
        <div className="modal-message">
          エンディングに移行します。
        </div>
      </Modal>

      <Modal
        isOpen={isVoteTiedModalOpen}
        message="決選投票となりました。再度投票を行ってください。"
        onConfirm={() => setIsVoteTiedModalOpen(false)}
        confirmButtonText="OK"
      />

      <Modal
        isOpen={isGetCardErrorModalOpen}
        message={getCardErrorMessage}
        onConfirm={() => setIsGetCardErrorModalOpen(false)}
        confirmButtonText="OK"
      />

      <Modal
        isOpen={isConfirmCloseRoomModalOpen}
        message="解散するとすべてのメンバーがタイトル画面に移動します。"
        onConfirm={handleConfirmCloseRoom}
        onClose={() => setIsConfirmCloseRoomModalOpen(false)}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      >
        <div className='modal-message'>よろしいですか？</div>
      </Modal>

      <Modal isOpen={isCreateRoomModalOpen} message="ユーザー名を入力してください" onConfirm={handleCreateRoom} onClose={() => setIsCreateRoomModalOpen(false)} confirmButtonText="作成" closeButtonText="キャンセル">
        <div className="modal-inputs">
          <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setErrorMessage(null); }} placeholder="ユーザー名" className="modal-input" />
        </div>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </Modal>

      <Modal isOpen={isFindRoomModalOpen} message="ユーザー名とルームIDを入力してください" onConfirm={handleJoinRoom} onClose={() => setIsFindRoomModalOpen(false)} confirmButtonText="参加" closeButtonText="キャンセル">
        <div className="modal-inputs">
          <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setErrorMessage(null); }} placeholder="ユーザー名" className="modal-input" />
          <input type="text" value={roomId} onChange={(e) => { setRoomId(e.target.value); setErrorMessage(null); }} placeholder="ルームID" className="modal-input" />
        </div>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </Modal>

      <Modal isOpen={isExpMurderModalOpen} message="マーダーミステリーとは？" onClose={() => setIsExpMurderModalOpen(false)} closeButtonText="閉じる">
        <div className="modal-message">
          マーダーミステリーは、参加者が殺人事件などの謎に挑む推理型の体験ゲームです。<br />
          各プレイヤーは物語内の登場人物を演じ、限られた情報と証言をもとに事件の真相を探ります。<br />
          犯人役もプレイヤーの中に潜んでおり、自らの正体を隠しながら捜査をかく乱します。<br />
          物語と推理、演技が融合した、没入感の高い対話型エンターテインメントです！<br />
          詳しくは<a href='https://www.bodoge-intl.com/list/insapo/murder/' target='_blank'>こちら（外部サイト）</a>をご覧ください<br />
          <a href='https://www.bodoge-intl.com/list/insapo/murder/' target='_blank'>
            <img
              src={"/images/murder-exp-400x229.png"}
              alt="マーダーミステリーが面白い！"
            />
          </a>
        </div>
      </Modal>
    </div>
  );
}

export default App;
