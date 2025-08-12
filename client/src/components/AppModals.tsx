
// src/components/AppModals.tsx
import Modal from './Modal';
import React, { useState } from 'react';
import TextRenderer from './TextRenderer';
import { type Player, type ScenarioData, type VoteResult } from '../types';

// --- モーダル管理用Reducer ---
type ModalType =
  'createRoom' |
  'findRoom' |
  'expMurder' |
  'howto' |
  'hoReadEnd' |
  'hoReadForcedEnd' |
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
  setRoomId,
}) => {
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  return (
    <>
      {/* 画面の説明モーダル */}
      <Modal
        isOpen={modalState.howto}
        message={"この画面について"}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'howto' })}
        closeButtonText="閉じる"
      >
        <div className="modal-message">
          {currentPhase === 'firstDiscussion' || currentPhase === 'secondDiscussion' ? (
            scenario ? <TextRenderer filePath={scenario.discussionPhaseSettings.howto} /> : null
          ) : (
            <>
              {currentPhase === 'introduction' && <p>この画面では、ゲームのイントロダクション（導入）を表示します。</p>}
              {currentPhase === 'synopsis' && <p>この画面では、物語のあらすじを確認します。</p>}
              {currentPhase === 'commonInfo' && <p>この画面では、全員共通のハンドアウトを読みます。</p>}
              {currentPhase === 'individualStory' && <p>この画面では、あなたのキャラクターの個別情報と目的を読みます。</p>}
              {currentPhase === 'ending' && <p>投票結果に応じたエンディングを表示します。</p>}
              {currentPhase === 'debriefing' && <p>あとがき、各キャラEND＆STORY、情報カードの振り返りを確認できます。</p>}
            </>
          )}
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
        message={`投票の結果、${scenario?.characters.find(c => c.id === voteResult?.votedCharacterId)?.name || ''}が選ばれました`}
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
        message="解散するとすべてのメンバーがタイトル画面に移動します。"
        onConfirm={handleConfirmCloseRoom}
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'confirmCloseRoom' })}
        confirmButtonText="はい"
        closeButtonText="いいえ"
      >
        <div className='modal-message'>よろしいですか？</div>
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
          <span>通常参加</span>
          <label className="toggle-switch">
            <input type="checkbox" checked={joinAsSpectator} onChange={e => setJoinAsSpectator(e.target.checked)} aria-label="観戦で入室する" />
            <span className="toggle-slider" />
          </label>
          <span>観戦</span>
        </div>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
      </Modal>

      <Modal
        isOpen={modalState.expMurder}
        message="マーダーミステリーとは？"
        onClose={() => dispatchModal({ type: 'CLOSE', modal: 'expMurder' })}
        closeButtonText="閉じる">
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
    </>
  );
};

export default AppModals;
