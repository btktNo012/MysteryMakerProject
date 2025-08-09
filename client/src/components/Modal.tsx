// src/components/Modal.tsx
import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import './Modal.css';

// モーダルが受け取るPropsの型定義
interface ModalProps {
  isOpen: boolean;            // モーダルが表示されているか
  message: string;            // 表示するメッセージ
  onClose?: () => void;       // NOボタンや背景クリック時の動作（オプション）
  onConfirm?: () => void;     // YES/OKボタンクリック時の動作（オプション）
  closeButtonText?: string;   // NOボタンのテキスト（デフォルトは'NO'）
  confirmButtonText?: string; // YES/OKボタンのテキスト（デフォルトは'YES'）
  children?: React.ReactNode; // 子要素を受け取る
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  message,
  onClose,
  onConfirm,
  closeButtonText = 'NO',
  confirmButtonText = 'YES',
  children // childrenを受け取る
}) => {
  if (!isOpen) {
    return null;
  }

  const isConfirmation = onConfirm && onClose;
  const isNotification = onConfirm && !onClose;
  const isCloseOnly = !onConfirm && onClose;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}>
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => e.stopPropagation()}>
          <p className="modal-title">{message}</p>
          {/* childrenをここでレンダリング */}
          <div className="modal-body">
            {children}
          </div>
          <div className="modal-buttons">
            {isConfirmation && (
              <>
                <button className="modal-button modal-button-no" onClick={onClose}>
                  {closeButtonText}
                </button>
                <button className="modal-button modal-button-yes" onClick={onConfirm}>
                  {confirmButtonText}
                </button>
              </>
            )}
            {isNotification && (
              <button className="modal-button modal-button-ok" onClick={onConfirm}>
                {confirmButtonText}
              </button>
            )}
            {isCloseOnly && (
              <button className="modal-button modal-button-no" onClick={onClose}>
                {closeButtonText}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Modal;