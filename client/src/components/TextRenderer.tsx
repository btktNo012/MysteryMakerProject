// src/components/TextRenderer.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkDirective from 'remark-directive';
import remarkBreaks from 'remark-breaks';
import { classDirective } from '../plugins/classDirective';
import './TextRenderer.css';

// TextRendererが受け取るPropsの型定義
interface TextRendererProps {
  filePath: string;
}

/**
 * @param filePath テキストファイルパス
 */
const TextRenderer: React.FC<TextRendererProps> = ({ filePath }) => {
  
  // 読み込んだテキストコンテンツを保持するState
  const [content, setContent] = useState<string>('');
  // 読み込み中かどうかを管理するState
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // エラーが発生したかどうかを管理するState(stringまたはnull、初期値null)
  const [error, setError] = useState<string | null>(null);

  // useEffect: filePath が変更されたときに、ファイルを再度読み込む
  useEffect(() => {
    // 読み込み処理を開始する前に、Stateを初期状態にリセット
    setIsLoading(true);
    setError(null);

    // ファイル読み込み関数（async: awaitを使用する関数であることを宣言）
    const fetchTextFile = async () => {
      try {
        // ファイルの読み込み（この処理が終了するまでは一時停止して待機）
        const response = await fetch(filePath);
        
        // fetchが成功したかチェック (例: 404 Not Found など)
        if (!response.ok) {
          throw new Error(`ファイルが見つかりません: ${response.statusText}`);
        }
        // テキストの内容を取得（この処理が終了するまでは一時停止して待機）
        const text = await response.text();
        // テキストの内容をセット
        setContent(text);
      } catch (err: any) {
        console.error("ファイルの読み込みに失敗しました:", err);
        setError("コンテンツの読み込みに失敗しました。");
      } finally {
        // 成功しても失敗しても、ローディング状態は解除する
        setIsLoading(false);
      }
    };

    fetchTextFile();

  }, [filePath]); // filePathが変わった時だけこの副作用を再実行する

  // 読み込み中の表示
  if (isLoading) {
    return <div>ローディング中...</div>;
  }

  // エラー発生時の表示
  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkDirective, classDirective, remarkBreaks]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(TextRenderer);