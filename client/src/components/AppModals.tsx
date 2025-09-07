
// src/components/AppModals.tsx
import Modal from './Modal';
import React, { useState } from 'react';
import { type Player, type ScenarioData, type VoteResult } from '../types';

// --- モーダル管理用Reducer ---
type ModalType =
  'createRoom' |
  'findRoom' |
  'expMurder' |
  'screenHowto' |
  'hoReadEnd' |
  'hoReadForcedEnd' |
  'voteResult' |
  'voteTied' |
  'getCardError' |
  'confirmCloseRoom' |
  'characterSelectConfirm' |
  'skillConfirm' |
  'leaveConfirm' |
  'startHowto';
type ModalState = Record<ModalType, boolean>;
type ModalAction =
  { type: 'OPEN'; modal: ModalType } |
  { type: 'CLOSE'; modal: ModalType } |
  { type: 'CLOSE_ALL' };


interface AppModalsProps {
  // States
  modalState: ModalState;
  myPlayer: Player | null;
  voteResult: VoteResult | null;
  scenario: ScenarioData | null;
  getCardErrorMessage: string;
  username: string;
  roomId: string;
  errorMessage: string | null;
  skillMessage: string;
  currentPhase: string;

  // Handlers
  dispatchModal: React.Dispatch<ModalAction>;
  handleCharacterConfirm: () => void;
  handleProceedToDiscussion: () => void;
  handleExtendTimer: () => void;
  handleProceedToEnding: () => void;
  handleConfirmCloseRoom: () => void;
  handleCreateRoom: () => void;
  handleConfirmSkillUse: () => void;
  setUsername: (username: string) => void;
  setErrorMessage: (message: string | null) => void;
  handleJoinRoom: () => void;
  handleSpectateRoom: () => void;
  setRoomId: (roomId: string) => void;
  handleConfirmLeave: () => void;
}

const AppModals: React.FC<AppModalsProps> = ({
  modalState,
  myPlayer,
  voteResult,
  scenario,
  getCardErrorMessage,
  username,
  roomId,
  errorMessage,
  skillMessage,
  currentPhase,
  dispatchModal,
  handleCharacterConfirm,
  handleProceedToDiscussion,
  handleExtendTimer,
  handleProceedToEnding,
  handleConfirmCloseRoom,
  handleCreateRoom,
  handleConfirmSkillUse,
  setUsername,
  setErrorMessage,
  handleJoinRoom,
  handleSpectateRoom,
  handleConfirmLeave,
  setRoomId,
}) => {
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  return (
    <>
      {/* 画面の説明モーダル */}
      <Modal
        isOpen={modalState.screenHowto}
        message={"この画面について"}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'screenHowto' })}
        closeButtonText="閉じる"
      >
        <div className="screen-howto">
          {currentPhase === 'introduction' &&
            <p>
              ゲームの導入文になります。ゲームの進行ルールが記載されていますのでよく確認しましょう。
            </p>}
          {currentPhase === 'synopsis' &&
            <p>この物語のあらすじになります。
            </p>}
          {currentPhase === 'characterSelect' &&
            <p>
              演じるキャラクターを選択してください。<br />
              選択中のキャラクターをもう一度押すことで取り消しをすることもできます。<br />
              キャラクター選択が終わりましたら、ルームマスターは「CONFIRMED」ボタンを押してゲームを開始しましょう。
            </p>}
          {currentPhase === 'commonInfo' &&
            <p>
              ここでは、全てのキャラクターが共通で知っている情報が表示されます。
            </p>}
          {currentPhase === 'individualStory' &&
            <p>
              ここでは、あなたのキャラクターだけが知っている情報や、<br />
              あなたのキャラクター視点でのストーリーの内容が表示されます。<br />
              画面の下のタイマーがゼロになると第一議論フェイズに進みます。<br />
              全て読み終わり、第一議論フェイズに進みたい場合は画面の下の「準備中…」ボタンを押して他のプレイヤーに準備が終わったことを知らせましょう。<br />
              ルームマスターはタイマーの終了を待たずに第一議論フェイズに進ませることもできます。<br />
              全員の準備ができたのを確認できたなら、第一議論フェイズに進むのもよいでしょう。<br />
            </p>}
          {currentPhase === 'interlude' &&
            <p>
              議論の途中で明かされた新たな情報が表示されます。
            </p>}
          {currentPhase === 'voting' &&
            <p>
              投票先を選択してください。<br/>
              全員の投票が終わったらエンディングに進みます。<br/>
              最多得票者が複数存在する場合は投票をやり直しになります。
            </p>}
          {currentPhase === 'ending' &&
            <p>
              投票結果に応じたエンディングが表示されます。
            </p>}
          {currentPhase === 'debriefing' &&
            <p>
              あとがき、各キャラEND＆STORY、情報カードの振り返りを確認できます。
            </p>}
        </div>
      </Modal>
      <Modal
        isOpen={modalState.characterSelectConfirm}
        message="ハンドアウト読み込み画面に移動しますか？"
        onConfirm={handleCharacterConfirm}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'characterSelectConfirm' })}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      >
        <div className='modal-message'>移動すると同時にタイマーが起動します。全員の準備が終わったことを確認してから次へ進んでください。</div>
      </Modal>
      <Modal
        isOpen={modalState.hoReadForcedEnd}
        message={"ハンドアウト読み込みを終了し、第一議論フェイズ画面に移動しますか？"}
        onConfirm={handleProceedToDiscussion}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'hoReadForcedEnd' })}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      />
      <Modal
        isOpen={modalState.hoReadEnd}
        message={myPlayer?.isMaster ? "第一議論フェイズ画面に移動しますか？" : "ルームマスターが操作中です..."}
        onConfirm={myPlayer?.isMaster ? handleProceedToDiscussion : undefined}
        onClose={myPlayer?.isMaster ? handleExtendTimer : undefined}
        confirmButtonText="はい"
        closeButtonText={myPlayer?.isMaster ? "延長する(3分)" : undefined}
      />

      <Modal
        isOpen={modalState.voteResult}
        message={`投票の結果、${scenario?.characters.find(c => c.id === voteResult?.votedCharacterId)?.name || scenario?.defaultVoting}が選ばれました`}
        onConfirm={handleProceedToEnding}
        confirmButtonText="OK"
      >
        <div className="modal-message">
          エンディングに移行します。
        </div>
      </Modal>

      <Modal
        isOpen={modalState.voteTied}
        message="最多得票者が複数存在します。再度投票を行ってください。"
        onConfirm={() => dispatchModal({ type: 'CLOSE', modal: 'voteTied' })}
        confirmButtonText="OK"
      />

      <Modal
        isOpen={modalState.getCardError}
        message={getCardErrorMessage}
        onConfirm={() => dispatchModal({ type: 'CLOSE', modal: 'getCardError' })}
        confirmButtonText="OK"
      />

      <Modal
        isOpen={modalState.confirmCloseRoom}
        message="ルームを解散します"
        onConfirm={handleConfirmCloseRoom}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'confirmCloseRoom' })}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      >
        <div className='modal-message'>本当によろしいですか？</div>
      </Modal>

      <Modal isOpen={modalState.createRoom}
        message="ユーザー名を入力してください"
        onConfirm={handleCreateRoom}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'createRoom' })}
        confirmButtonText="作成"
        closeButtonText="キャンセル">
        <div className="modal-inputs">
          <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setErrorMessage(null); }} placeholder="ユーザー名" className="modal-input" />
        </div>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </Modal>

      <Modal isOpen={modalState.findRoom}
        message="ユーザー名とルームIDを入力してください"
        onConfirm={() => joinAsSpectator ? handleSpectateRoom() : handleJoinRoom()}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'findRoom' })}
        confirmButtonText={joinAsSpectator ? '観戦' : '参加'}
        closeButtonText="キャンセル">
        <div className="modal-inputs">
          <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setErrorMessage(null); }} placeholder="ユーザー名" className="modal-input" />
          <input type="text" value={roomId} onChange={(e) => { setRoomId(e.target.value); setErrorMessage(null); }} placeholder="ルームID" className="modal-input" />
        </div>
        <div className="toggle-row" role="group" aria-label="観戦モード切替">
          <label className="toggle-switch">
            <input type="checkbox" checked={joinAsSpectator} onChange={e => setJoinAsSpectator(e.target.checked)} aria-label="観戦で入室する" />
            <span className="toggle-slider" />
            <span className='toggle-text'>プレイヤー/観戦者 切り替え</span>
          </label>
        </div>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </Modal>

      <Modal
        isOpen={modalState.startHowto}
        message="ゲームの始め方"
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'startHowto' })}
        closeButtonText="CLOSE"
      >
        <div className='start-howto'>
          <p className='start-howto-head'>始め方①：ルームを立てる</p>
          <p className='start-howto-exp'>
            「ルームを立てる」ボタンを押した後、あなたの名前を入力して「作成」ボタンを押してください。<br />
            ルームの作成に成功したらルームIDが生成されますので、それを他の参加者に教えて入室してもらってください。<br />
            ゲームを開始できる人数が揃ったらゲームを開始することができます。<br />
            ※ルームの作成には最大１分ほど時間がかかることがあります。
          </p>
          <p className='start-howto-head'>始め方②：ルームに参加する</p>
          <p className='start-howto-exp'>
            「ルームに参加する」ボタンを押した後、ルームを立てた人からルームIDを教えてもらってください。<br />
            ルームIDとあなたの名前を入力後、「参加」ボタンを押すと入室することができます。<br />
            ゲームプレイヤーとしての参加の他、観戦者として入室することもできます。<br />
            すでにこのシナリオをプレイ済みの人はここから観戦しましょう。
          </p>
        </div>
      </Modal>
      <Modal
        isOpen={modalState.expMurder}
        message="マーダーミステリーとは？"
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'expMurder' })}
        closeButtonText="CLOSE">
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
      <Modal
        isOpen={modalState.skillConfirm}
        message={skillMessage}
        onConfirm={handleConfirmSkillUse}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'skillConfirm' })}
        confirmButtonText="YES"
        closeButtonText="NO"
      />
      <Modal
        isOpen={modalState.leaveConfirm}
        message="退室しますか？"
        onConfirm={handleConfirmLeave}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'leaveConfirm' })}
        confirmButtonText="YES"
        closeButtonText="NO"
      >
        {currentPhase === 'debriefing' &&
          <>
            <p>この画面には、スタート画面の「ルームに参加する」から戻ることができます。<br />ルームID：{roomId}</p>
            <p>※14日間の間、入室されてないルームは削除されます</p>
          </>
        }
      </Modal>
    </>
  );
};

export default AppModals;
