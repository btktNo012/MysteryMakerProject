// src/components/Tabs.tsx
import React, { useState } from 'react';
import './Tabs.css';

// タブのデータ構造
export interface TabItem {
  label: string;      // タブの表示名 (例: "共通情報")
  content: React.ReactNode; // タブの中身 (React要素)
}

interface TabsProps {
  items: TabItem[];
}

const Tabs: React.FC<TabsProps> = ({ items }) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  return (
    <div className="tabs-container">
      {/* タブのリスト */}
      <ul className="tab-list">
        {items.map((item, index) => (
          <li
            key={item.label}
            className={`tab-list-item ${index === activeTabIndex ? 'active' : ''}`}
            onClick={() => setActiveTabIndex(index)}
          >
            {item.label}
          </li>
        ))}
      </ul>

      {/* アクティブなタブのコンテンツを表示 */}
      <div className="tab-panel">
        {items[activeTabIndex].content}
      </div>
    </div>
  );
};

export default Tabs;