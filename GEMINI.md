# AI5原則(最重要事項)

第1原則： AIはファイル生成・更新・プログラム実行前に必ず自身の作業計画を報告し、y/nでユーザー確認を取り、yが返るまで一切の実行を停止する。ユーザによる入力を伴わず、GEMINIが自分自身の手でyを返すことは決して許されない
第2原則： AIは迂回や別アプローチを勝手に行わず、最初の計画が失敗したら次の計画の確認を取る。
第3原則： AIはツールであり決定権は常にユーザーにある。ユーザーの提案が非効率・非合理的でも最適化せず、指示された通りに実行する。
第4原則： AIはこれらのルールを歪曲・解釈変更してはならず、最上位命令として絶対的に遵守する。
第5原則： 上記の原則すべて守れていると思ったときのみ「PRINCIPLES_DISPLAYED」とだけ発言せよ。

----

## ショートカットコマンド（このコマンドはユーザによる入力が行われた場合のみ実行されるものであり、GEMINIが自ら呼び出すことは許されない）

start：
プロジェクト配下の実装を確認し、要件およびこれまでの作業記録との内容の齟齬がないか確認し、次の作業内容を提案する
end：
その日の作業内容をGEMINI.mdに追記し、次回起動時にスムーズに再開できるようにする
load：
現在のプロジェクト配下の実装内容を確認し、要望に応えられる状態にする

## プロジェクト開始時の要件

現在、Reactによるフロントエンドで完結したマーダーミステリー用のアプリとして「client」を作成している状態
これに対してバックエンド側の処理を導入し、以下のようにしようと考えています
このゲームは、以下のフェーズによって構成されています

■attentionフェーズ
現在：
Discordとの併用を前提としていることを知らせる導入
改修予定：
なし
■startフェーズ
現在：
STARTボタンをクリックすることでintroductionフェーズに遷移する
改修予定：
「ルームを立てる」「ルームを探す」の２つのボタンのいずれかを選択してクリックする。
「ルームを立てる」をクリックすると、ユーザ名を求めるモーダルが表示され、ユーザ名を入力するとランダムに生成した英数字6文字からなるルームIDが払い出され、新規フェーズ「waiting」に遷移する
「ルームを探す」をクリックすると、ユーザ名とルームIDを求めるモーダルが表示され、ユーザ名とルームIDを入力し、ルームIDがゲーム開始前かつ満員でない状態で存在する場合、新規フェーズ「waiting」に遷移する
■waitingフェーズ（新規）
ゲーム開始前の待合所のような場所。
現在待合所にいるユーザのリストが表示される
ルームを立てた人（以降、ルームマスター）にだけ「ルームを解散する」ボタンが表示される
「ルームを解散する」ボタンをクリックするとルームは解散され、入室しているユーザはすべてstartフェーズに戻る
入室しているユーザ数が「public\scenario.json」のcharactersに設定されているPCの人数に達すると、ルームを立てた人にだけ「ゲーム開始」ボタンが表示される。
「ゲーム開始」ボタンをクリックするとintroductionフェーズに遷移する。
ルームマスター以外にだけ「退室」ボタンが表示される
「退室」ボタンをクリックすると、その人だけルームから退室し、startフェーズに戻る
■introductionフェーズ
現在：
「public\data\introduction.txt」の内容を表示する
「NEXT」ボタンをクリックするとsynopsisフェーズに遷移する
改修予定：
なし
■synopsisフェーズ
現在：
「public\data\synopsis.txt」の内容を表示する
「BACK」ボタンをクリックするとintroductionフェーズに戻る
「NEXT」ボタンをクリックするとcharacterSelectフェーズに遷移する
改修予定：
なし
■characterSelectフェーズ
現在：
「public\scenario.json」のcharactersに設定されている各キャラクターの基本情報が表示される。
ユーザはそのうちの１つをクリックし、確認用モーダルの「YES」ボタンをクリックすることでキャラクターを選択。commonInfoフェーズに遷移する
改修予定：
キャラクターの基本情報をクリックすると、そのユーザが対象のキャラクターを選択中という状態になり、参加者全員がそれを視覚的に確認できるようにする。
選択状態になると、ほかのユーザがそのキャラクターを選択することはできない。
既にキャラクターを選択中のユーザが別のキャラクターをクリックすると、もともと選択されていたキャラクターの選択状態は解除され、新たにクリックしたキャラクターが選択状態になる
そうして各ユーザがキャラクターを選択すると、ルームマスターにだけ「CONFIRMED」ボタンが表示される
「CONFIRMED」ボタンがクリックされると、commonInfoフェーズに遷移する
■commonInfoフェーズ
現在：
「public\data\common_info.txt」の内容を表示する
「NEXT」ボタンをクリックするとindividualStoryフェーズに遷移する
この画面に遷移した時点で、commonInfoフェーズとindividualStoryフェーズ共通のタイマーがスタートする。
タイマーがゼロになると、読み上げ時間が終了したことを知らせるモーダルが表示される。このモーダルの「延長する(3分)」ボタンをクリックするとタイマーが3分に再セットされる。「OK」ボタンをクリックするとfirstDiscussionフェーズに遷移する
改修予定：
タイマーの管理は、commonInfoフェーズに遷移した時間の10分後の時間との相対時間（ルームメンバー内で共通）で管理するようにしたい（ブラウザリロードで復帰した時などを想定）
タイマーがゼロになった時に延長するかOKにするかはルームマスターが管理するものとし、ルームマスター以外は操作できない状態で待機させるようにする
■individualStoryフェーズ
現在：
characterSelectフェーズで選択したキャラクターのstoryFile、goals、mapImageFileの内容が表示される
「BACK」ボタンをクリックするとcommonInfoフェーズに戻る
「第一議論フェイズへ」ボタンをクリックするとタイマーがゼロになるのを待たずにfirstDiscussionフェーズに遷移する
改修予定：
「第一議論フェイズへ」ボタンをクリックできるのはルームマスターだけにする。ルームマスターが「第一議論フェイズへ」ボタンをクリックした場合、それ以外のユーザにはルームマスターによる操作が行われたことを知らせるモーダルが表示され、そのモーダルの「OK」ボタンをクリックするとfirstDiscussionフェーズに遷移する
■firstDiscussionフェーズ
現在：
画面左側にcharacterSelectフェーズで選択したキャラクターのgoals、mapImageFileの内容が表示される
画面右側に、「public\\data\\common_info.txt」の内容とキャラクターごとのstoryFileの内容が表示される（どれを表示するかはタブ選択で選ぶ）
画面下にタイマーが表示され、「議論開始」ボタンをクリックするとスタートする。
タイマーがゼロになると議論が終了したことを知らせるモーダルが表示され、interludeフェーズに遷移する
タイマーは「一時停止」ボタンで一時停止することができる
「議論強制終了」ボタンでタイマーの終了を待たずに議論を終了させることもできる
改修予定：
画面左側の表示からmapImageFileの表示は廃止する。代わりに、情報カード一覧を表示する
情報カードはコンポーネントによって共通的に作られており、以下の情報を有する
・名前（何に関する情報かの概要）
・内容
・所有者（誰が持っているか。デフォルトでは誰も持っていない）
・全体公開かどうか（デフォルトでは非公開）
誰も持っていない状態の情報カードをクリックすると、情報カードを取得するか選択するモーダルが表示され、OKをクリックするとそのユーザが所有者になる
自分が持っている情報カード、または全体公開されている情報カードをクリックすると、その情報カードの内容がモーダルで表示される
自分が持っている情報カードを全体公開するか非公開にするか、他のユーザに譲渡するかどうかを操作することもできる
議論フェイズごとにユーザひとりが取得できる情報カードの数は上限が設けられている
画面下のボタンはルームマスターのみ操作できる。このタイマーも、タイマーを動かした時間と残り時間から計算した終了時間を割り出し、その相対時間（ルームメンバー内で共通）で管理する
■interludeフェーズ
現在：
「public\\data\\intermediate_info.txt」の内容を表示する
「NEXT」ボタンをクリックするとsecondDiscussionフェーズに遷移する
改修予定：
■secondDiscussionフェーズ
基本的にはfirstDiscussionフェーズと同じ。画面右側で確認できる情報に、「public\\data\\intermediate_info.txt」の内容も追加される
また、次の遷移先画面はvotingフェーズとなる
■votingフェーズ
現在：
誰を犯人にするかを選択する。OKボタンをクリックするとendingフェーズに遷移する
投票は外部のチャットなどを利用する
改修予定：
投票もこの画面で行えるようにする
投票先の候補から一名を選び、全員が選択し終わると結果を発表する。
最大投票者が２人以上になった場合は再投票を行う
投票結果が確定するとエンディングへ進むボタンがすべてのユーザに表示される。これをクリックするとendingフェーズに遷移する
■endingフェーズ
現在：
votingフェーズで選択されたキャラクターごとのエンディングを表示する
ENDボタンをクリックするとdebriefingフェーズに遷移する
改修予定：
なし
ENDボタンによるdebriefingフェーズへの遷移はルームマスターでなくても行える
■debriefingフェーズ
現在：
解説や各キャラクターごとのエンディングを確認できる
改修予定：
なし

## 2025年7月16日 作業記録

### 実施内容

- バックエンドのセットアップ:
  - `server`ディレクトリの作成
  - `package.json`の初期化と依存関係のインストール (`express`, `socket.io`, `typescript`, `ts-node`, `nodemon`)
  - `tsconfig.json`の作成
  - `index.ts` (Socket.IOサーバーの基本設定) の作成
  - `server/package.json`に`start`と`dev`スクリプトを追加
- フロントエンドの改修:
  - `client/src/screens/StartScreen.tsx`を修正し、「ルームを立てる」「ルームを探す」ボタンを配置
  - `client/src/screens/WaitingScreen.tsx`と`client/src/screens/WaitingScreen.css`を新規作成
  - `client/src/types.ts`に`Player`型を追加し、`ScenarioData`の重複定義を修正
  - `client/src/App.tsx`を大幅に改修し、Socket.IO接続、ルーム作成・参加モーダル、`waiting`フェーズへの遷移ロジックを追加
  - `client/public/scenario.json`に`infoCards`と`discussionPhaseSettings`を追加し、`characters`から`mapImageFile`を削除、`debriefing`の構造を修正

### 次回作業予定

- バックエンドのルーム機能の拡張:
  - `public/scenario.json`の`characters`の数とルームの最大人数を連動させる
  - ルームマスターによるゲーム開始処理の実装

## 2025年7月17日 作業記録

### 実施内容

- バックエンドのルーム機能拡張:
  - `server/index.ts`を修正し、`scenario.json`から最大プレイヤー数を読み込むように変更
  - ルーム参加時に満員判定を追加
  - ルームマスターによるゲーム開始機能 (`startGame`イベント) を実装
- フロントエンドの改修:
  - `client/src/App.tsx`を修正し、`gameStarted`イベントをリッスンして`introduction`フェーズに遷移するように変更
  - `WaitingScreen`でルームマスターにゲーム開始ボタンを表示し、クリックで`startGame`イベントを送信するように修正

### 実施内容

- `characterSelect`フェーズの改修を完了:
  - `server/index.ts`を修正し、`Room`インターフェースに`characterSelections`を追加、`selectCharacter`および`confirmCharacters`イベントハンドラを実装。
  - `client/src/types.ts`に`CharacterSelections`型を追加。
  - `client/src/App.tsx`を修正し、`characterSelectionUpdated`、`charactersConfirmed`イベントを処理し、`selectCharacter`、`confirmCharacters`イベントを送信するように変更。
  - `client/src/screens/CharacterSelectScreen.tsx`を修正し、キャラクター選択状況の表示と「CONFIRMED」ボタンの有効/無効化を実装。
- `WaitingScreen.tsx`のインポートエラーを修正 (`import { type Player }`に変更)。
- モーダルにインプットエリアが表示されない問題を修正 (`client/src/components/Modal.tsx`が`children`をレンダリングするように変更)。
- ルーム参加時に「ルームが見つかりません」と表示される問題を修正 (`server/index.ts`で`joinRoom`時に`roomId`を大文字に変換)。
- `commonInfo`フェーズと`individualStory`フェーズのタイマーおよび画面遷移に関する改修を完了:
  - `server/index.ts`にタイマー終了時刻(`readingTimerEndTime`)の管理、`extendReadingTimer`、`proceedToFirstDiscussion`イベントハンドラを追加。
  - `client/src/App.tsx`を修正し、サーバーからのタイマー情報を処理し、タイマー表示とモーダル表示ロジックを実装。
  - `client/src/screens/IndividualStoryScreen.tsx`を修正し、「第一議論フェイズへ」ボタンをルームマスターにのみ表示するように変更。
- ブラウザリロード時にゲーム状態が失われる問題の対応を開始:
  - `client`に`uuid`ライブラリとその型定義をインストール。

### 次回作業予定

- ブラウザリロード時のゲーム状態復帰機能の継続実装:
  - 永続的なユーザーID (`userId`) をサーバーとクライアントで管理。
  - サーバー側で各ルームのゲームフェーズを管理。
  - クライアント側で`localStorage`を利用して`userId`と`roomId`を記憶し、再接続時にゲーム復帰を試みるロジックを実装。

## 2025年7月18日 作業記録

### 実施内容

- ブラウザリロード時のゲーム状態復帰機能を実装完了:
  - **サーバーサイド (`server/index.ts`)**:`Player`と`Room`の型定義を更新し、永続的な`userId`と`gamePhase`を導入。すべてのソケットイベントを`userId`ベースで処理するようにし、再接続に対応。
  - **クライアントサイド (`client/src/App.tsx`など)**:`uuid`で`userId`を生成し`localStorage`に保存。リロード時に自動でルームに再接続し、サーバーと状態を同期するロジックを実装。
- 関連する不具合の修正:
  - キャラクター選択画面で、リロード後に選択状態がUIに反映されない問題を修正。
  - HO読み込みタイマー終了後のモーダルで、ルームマスターのボタンが反応しない問題を修正。
  - 第一議論フェーズへ移行する際に、モーダルが閉じない問題を修正。

### 次回作業予定

- `firstDiscussion`フェーズの情報カード機能の実装。

## 2025年7月19日 作業記録

### 実施内容

- `firstDiscussion`フェーズの情報カード機能の実装を完了:
  - `client/src/App.tsx`を修正し、`infoCardsUpdated`イベントをリッスンして状態を更新し、カード操作イベントをサーバーに送信する関数を実装。
  - `client/src/screens/DiscussionScreen.css`に情報カード表示用のスタイルを追加。
  - `client/src/screens/DiscussionScreen.tsx`を修正し、カード取得上限数の表示と制御、譲渡モーダルにプレイヤーリストを表示する機能を実装。
- 議論フェーズのタイマー機能を実装:
  - `server/index.ts`にタイマーの状態管理と操作イベントハンドラ (`startDiscussionTimer`, `pauseDiscussionTimer`, `resumeDiscussionTimer`, `endDiscussion`) を追加。
  - `client/src/types.ts`に`DiscussionTimer`型を追加。
  - `client/src/App.tsx`と`client/src/screens/DiscussionScreen.tsx`を修正し、タイマーの同期と操作UIを実装。
- `voting`フェーズの投票機能を実装:
  - `server/index.ts`に投票の状態管理とイベントハンドラ (`submitVote`, `calculateVoteResult`) を追加。
  - `client/src/types.ts`に投票関連の型 (`VoteState`, `VoteResult`) を追加。
  - `client/src/App.tsx`と`client/src/screens/VotingScreen.tsx`を修正し、投票UIとロジックを実装。
- `ending`フェーズから`debriefing`フェーズへの遷移をルームマスターの操作に限定:
  - `server/index.ts`に`proceedToDebriefing`イベントハンドラを追加。
  - `client/src/App.tsx`と`client/src/screens/EndingScreen.tsx`を修正し、ルームマスターにのみ遷移ボタンを表示するように変更。

## 2025年7月20日 作業記録

### 実施内容

- **フロントエンドのデバッグ:**
  - Vite開発サーバーのキャッシュやインポート文の問題に起因する複数の`Uncaught SyntaxError`を修正 (`DiscussionScreen.tsx`, `VotingScreen.tsx`)
  - 感想戦画面でのリロード時に不要なモーダルが表示される不具合を、サーバー側で`debriefing`フェーズ移行時にタイマー情報をリセットすることで修正。
- **サーバーの安定性向上:**
  - **手動でのルーム解散機能:** 感想戦画面(`DebriefingScreen.tsx`)に、ルームマスターが手動でルームを解散できるボタンを実装。
  - **自動でのルームクリーンアップ機能:** サーバー側(`server/index.ts`)で、1時間ごとに6時間以上活動のないルームを自動的に削除する定期処理を実装し、サーバーリソースの枯渇を防止。

## 2025年7月20日 作業記録

### 実施内容

- ルームマスターがブラウザをリロードしてもルームマスター権限が他の人に委譲しないように修正 (`server/index.ts`の`disconnect`イベントハンドラ内のルームマスター移譲ロジックをコメントアウト)。
- `firstDiscussion`フェーズでルームマスターがリロードした際に不要なモーダルが表示されないように、`proceedToFirstDiscussion`イベントハンドラで`readingTimerEndTime`を`null`にリセットするよう修正。
- 情報カードを譲渡した際に「情報カードを取得できる数」が増減しないように、`DiscussionScreen.tsx`で`acquiredCardCount`と`countedCardIds`を導入し、カード取得数のロジックを修正中。

## 2025年7月21日 作業記録

### 実施内容

- **`DiscussionScreen.tsx`のカード取得上限に関するロジック修正:**
  - `DiscussionScreen.tsx`で、カードの新規取得と譲渡による所有権移転を区別し、新規取得のみをカウントするように修正。
- **`characterSelect`フェーズの改修:**
  - `server/index.ts`の`selectCharacter`イベントハンドラを修正し、`characterId`が`null`の場合に選択解除できるように変更。
  - `client/src/screens/CharacterSelectScreen.tsx`の`handleCardClick`を修正し、選択中のキャラクターを再度クリックすると選択解除されるように変更。
  - `client/src/App.tsx`の`handleCharacterSelect`の型定義を`string | null`に変更。
- **`IndividualStoryScreen`の現場見取り図表示の改修:**
  - `client/src/types.ts`の`Character`型に`mapImageFile`プロパティを追加。
  - `client/public/scenario.json`に各キャラクターの`mapImageFile`を追加。
  - `client/src/screens/IndividualStoryScreen.tsx`で`character.mapImageFile`を表示するように修正。
- **議論フェイズ画面の「現場見取り図」タブ追加:**
  - `client/src/App.tsx`の`firstDiscussion`と`secondDiscussion`の`tabItems`に「現場見取り図」タブを追加。
- **情報カードの所有者表示の改修:**
  - `client/src/App.tsx`で`DiscussionScreen`に`characterSelections`をpropsとして渡すように変更。
  - `client/src/screens/DiscussionScreen.tsx`で`getOwnerDisplayName`関数を修正し、「キャラクター名@ユーザー名」の形式で表示するように変更。
- **議論フェイズ画面のイベント発生時の動作修正:**
  - `server/index.ts`の`Room`インターフェースに`discussionTimer.endState`を追加。
  - `server/index.ts`で「議論強制終了」のイベントハンドラを`requestEndDiscussion`, `cancelEndDiscussion`, `confirmEndDiscussion`に分割し、モーダル表示を制御。
  - `server/index.ts`にサーバーサイドでのタイマー監視ロジックを追加し、タイマーがゼロになった場合に`discussionTimer.endState`を`timeup`に設定。
  - `client/src/types.ts`の`DiscussionTimer`に`endState`を追加。
  - `client/src/App.tsx`で`discussionTimer`の初期値とイベントハンドラを修正し、`DiscussionScreen`に新しいハンドラを渡すように変更。
  - `client/src/screens/DiscussionScreen.tsx`で`DiscussionScreenProps`を更新し、`discussionTimer.endState`に応じて適切なモーダルを表示するように修正。

## 2025年7月22日 作業記録

### 実施内容

- **バグ修正:**
  - `secondDiscussion`フェーズでブラウザをリロードすると`interlude`フェーズから再開されてしまう問題を修正。
- **UI/UX改善:**
  - 全体に公開された情報カードでも、所有者であれば譲渡できるように修正。
- **機能追加:**
  - 議論フェーズの画面に、全キャラクターのプロフィールと担当プレイヤーを確認できる「登場人物一覧」タブを追加。

## 2025年7月23日 作業記録

### 実施内容

- **投票フェーズの改修:**
  - サーバー (`server/index.ts`) で、投票結果確定時に`voteResultFinalized`イベントを送信し、クライアントからの`proceedToEnding`イベントでフェーズを`ending`に遷移するように変更。
  - フロントエンド (`client/src/App.tsx`) で、`voteResultFinalized`イベントをリッスンして投票結果モーダルを表示し、そのモーダルの「OK」ボタンで`proceedToEnding`イベントを送信するように変更。
  - `client/src/screens/VotingScreen.tsx`から、投票結果表示とエンディングへの遷移ボタンを削除し、投票確定後は操作を無効化するように変更。
- **エンディング画面の改修:**
  - サーバー (`server/index.ts`) で、`proceedToDebriefing`イベントのルームマスター権限チェックを解除し、任意のプレイヤーが感想戦へ進めるように変更。
  - フロントエンド (`client/src/screens/EndingScreen.tsx`) で、`isMaster`プロパティを削除し、「感想戦へ」ボタンを常に表示するように変更。
  - `client/src/App.tsx`で、`EndingScreen`コンポーネントに`isMaster`プロパティを渡さないように修正。
- **感想戦画面の改修:**
  - フロントエンド (`client/src/App.tsx`) で、ルーム解散時に確認モーダルを表示するように変更。
  - `handleCloseRoom`関数をモーダル表示用にし、実際にルームを解散する`closeRoom`イベントは`handleConfirmCloseRoom`関数から送信するように変更。

## 2025年7月24日 作業記録

### 実施内容

- **UI/UX改善:**
  - **情報カード取得数のリセット:** 第二議論フェイズになった際、情報カードの取得上限がリセットされるように、サーバーサイドでフェーズごとに取得数を管理するように変更 (`server/index.ts`, `client/src/screens/DiscussionScreen.tsx`)。
  - **情報カードの公開状態表示:** 所有者がいる情報カードに「非公開」「全体公開」のステータスを文字と色で表示するように変更 (`client/src/screens/DiscussionScreen.tsx`, `client/src/screens/DiscussionScreen.css`)。
  - **タイマー終了モーダルのボタン制御:** 議論フェイズのタイマーが0になった時のモーダルで、ルームマスター以外には操作ボタンが表示されないように変更 (`client/src/screens/DiscussionScreen.tsx`)。
- **バグ修正:**
  - **タイマー表示の不具合:** 議論タイマーが0になった後に不正な値が表示される問題を、`Timer.tsx`コンポーネントで負の値を0として扱うように修正。
  - **画面遷移の同期:** 投票結果モーダルおよびエンディング画面からの画面遷移が、ボタンを押したユーザーの意図しないタイミングで全ユーザーに同期されてしまう問題を修正。サーバーへのイベント送信を止め、各クライアントが自身のフェーズを管理するように変更 (`client/src/App.tsx`, `server/index.ts`)。

### 次回作業予定

- 特になし。必要に応じて新たな改修やバグ修正を行う。

## 2025年7月25日 作業記録

### 実施内容

- **中間情報フェーズの画面遷移修正:**
  - `interlude`フェーズで「NEXT」ボタンを押した際に、全プレイヤーが同期して`secondDiscussion`フェーズに遷移していた問題を修正。
  - `client/src/App.tsx`の`handleProceedToSecondDiscussion`を、サーバーにイベントを送信するのではなく、クライアント自身の`gamePhase`ステートを直接更新するように変更。
  - `server/index.ts`から不要になった`proceedToSecondDiscussion`イベントリスナーを削除。
- **感想戦画面への情報カード表示機能追加:**
  - `client/src/screens/DebriefingScreen.tsx`を改修し、「情報カード」タブを追加。
  - `display-panel`に情報カードの一覧（所有者、公開状態を含む）を表示し、クリックで詳細をモーダル表示する機能を追加。
  - `client/src/App.tsx`から`DebriefingScreen`に必要なprops (`infoCards`, `players`) を渡すように修正。
- **バグ修正:**
  - 感想戦画面で情報カードのスタイル（`border`, `border-radius`）が適用されていなかった問題を、`DebriefingScreen.tsx`で使用するCSSクラス名を`DiscussionScreen.css`の定義と合わせることで修正。
- **UI/UX改善:**
  - **タイトル画面:**
    - `scenario.json`に`titleImage`プロパティを追加。
    - `StartScreen.tsx`を修正し、`titleImage`が設定されている場合に、`<img>`タグではなくコンテナの`background-image`として表示するように変更。可読性向上のため、背景の上にオーバーレイを追加。
  - **キャラクター画像表示:**
    - `scenario.json`の各`characters`に`imageFile`プロパティを追加。
    - `CharacterSelectScreen.tsx`と`DiscussionScreen.tsx`の「登場人物一覧」タブを修正し、キャラクター画像を表示するように変更。
  - **情報カードアイコン表示:**
    - `scenario.json`の各`infoCards`に`iconFile`プロパティを追加。
    - `DiscussionScreen.tsx`と`DebriefingScreen.tsx`を修正し、情報カードにアイコン画像を表示するように変更。

### 次回作業予定- 感想戦画面で「得点計算」を追加。選択すると書くキャラクターの目的が表示される

- 感想戦画面でブラウザリロードすると投票画面が表示され、全員投票済みのため何もできなくなる。ブラウザリロード後は感想戦画面を表示にする

## 2025年7月25日 作業記録

### 実施内容

- **議論フェーズのタイマー操作機能の修正:**
  
  - `server/index.ts`の`pauseDiscussionTimer`および`resumeDiscussionTimer`イベントハンドラから、ルームマスター権限のチェックを削除。
  - `client/src/screens/DiscussionScreen.tsx`を修正し、ルームマスター以外のプレイヤーもタイマーの「一時停止」「再開」ボタンを操作できるように変更。

- **感想戦画面の機能追加:**
  
  - `client/src/screens/DebriefingScreen.tsx`を修正し、「得点計算」ボタンを追加。クリックすると各キャラクターの目標と得点を表示するようにした。

- **ゲーム進行の安定性向上:**
  
  - `server/index.ts`に`changeGamePhase`イベントハンドラを追加し、クライアントからのフェーズ変更要求をサーバー側で管理するようにした。
  
  - `client/src/App.tsx`を修正し、`ending`フェーズおよび`debriefing`フェーズへの遷移時に`changeGamePhase`イベントをサーバーに送信するようにした。これにより、リロード時の画面復元がより正確になる。
    
    ### 次回作業予定

- サーバ側のログ出力について、「yyyy/mm/dd HH:MM:SS.sss: [ログ内容]」のようにシステム日時つきで表示するログ出力メソッドを作成。現在あるconsole.logはそちらに置き換える

## 2025年7月27日 作業記録

### 実施内容

- **サーバーサイドのログ出力改善:**
  - `server/index.ts`に、`yyyy/mm/dd HH:MM:SS.sss`形式のタイムスタンプを付与する`log`関数を新規に作成。
  - 既存の`console.log`をすべて新しい`log`関数に置き換え、ログの可読性と追跡性を向上させた。
- **フロントエンドのバグ修正:**
  - `start`フェーズのルーム作成・参加モーダル内でユーザー名やルームIDを入力するたびに、Socket.IOの接続が切断と再接続を繰り返す問題を修正。
  - `client/src/App.tsx`のメイン`useEffect`の依存配列から`username`を削除し、ソケット接続がコンポーネントのマウント時に一度だけ行われるように修正した。

### 次回作業予定

- 機能追加
  - 情報カードに対し、「特定のキャラが持っている」「所有者が特定のアイテムを所持している」「公開状態になっている」などの条件を満たした場合に追加の情報が見れるようになる機能を追加。infoCardsの子要素に対し新たな属性「conditionalInfo」を追加。「conditionalInfo」はさらに子要素として「conditions」「andOr」「falseInfo」「trueInfo」を持つ
    - 「conditions」…子要素「type」「owner」を持つ配列
      - 「type」…"type_owner"と"type_public"の文字列が設定される。"type_owner"の場合、「owner」と「id」が一致している場合trueと判断。"type_public"の場合、「isPublic」がtrueの場合trueと判断する。
      - 「id」…「type」が「type_owner」の場合、判定条件となるキャラクターのIDを設定する
    - 「andOr」…「conditions」が複数ある場合、AND条件で判断するかOR条件で判断するかを設定する
    - 「falseInfo」…「conditions」の判定条件がfalseの場合に表示される文章（例：医療の知識を持つものが見れば何かわかるかもしれない）
    - 「trueInfo」…「conditions」の判定条件がfalseの場合に表示される文章（例：検死の結果、死後少なくとも1時間以上は経過していることがわかった）

## 2025年7月28日 作業記録

### 実施内容

- **情報カードの条件付き情報表示機能の実装:**
  - `client/src/types.ts`に`ConditionalInfo`および`Condition`型を定義し、`InfoCard`インターフェースを更新。
  - `client/src/screens/DiscussionScreen.tsx`に、条件を評価する`evaluateConditions`ロジックと、評価結果に応じてモーダル内の表示を切り替える処理を実装。

#### 次回作業予定

ゲームマスターが個別HO読み込みから第一議論フェイズに移行する際、確認のモーダルを表示するようにする

各議論フェイズにおいて、ルームマスターが議論開始ボタンを押さないとスキルの仕様・情報カードの取得ができないようにする
