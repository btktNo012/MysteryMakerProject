// src/components/StyledButton.tsx
import React from 'react';
import './StyledButton.css';

// StyledButtonが受け取るPropsの型定義
// React.ButtonHTMLAttributes<HTMLButtonElement> を継承することで、
// 通常の <button> が持つすべての属性 (onClick, disabled, typeなど) を受け取れるようにする
interface StyledButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // children はボタンの中に表示されるテキストやアイコンのこと
  // React.ReactNode型にすることで、文字列だけでなく、アイコンなどのReact要素も入れられる
  children: React.ReactNode;
}

const StyledButton: React.FC<StyledButtonProps> = ({ children, ...props }) => {
  // `...props` は、受け取ったpropsの中から `children` 以外をすべて集めたオブジェクト
  // これをそのまま <button> に渡すことで、onClickやdisabledなどが適用される
  return (
    <button className="styled-button" {...props}>
      {children}
    </button>
  );
};

export default StyledButton;