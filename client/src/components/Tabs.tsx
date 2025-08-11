// src/components/Tabs.tsx
import React, { useState, useRef, useEffect } from 'react';
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
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const activeTab = tabsRef.current[activeTabIndex];
    if (activeTab) {
      setIndicatorStyle({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
      });
      // アクティブなタブが画面外にある場合、スクロールして表示する
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTabIndex, items]);

  return (
    <div className="tabs-container">
      {/* タブのリスト */}
      <ul className="tab-list">
        {items.map((item, index) => (
          <li
            key={item.label}
            ref={el => (tabsRef.current[index] = el)}
            className={`tab-list-item ${index === activeTabIndex ? 'active' : ''}`}
            onClick={() => setActiveTabIndex(index)}
          >
            {item.label}
          </li>
        ))}
        <div className="active-tab-indicator" style={indicatorStyle} />
      </ul>

      {/* アクティブなタブのコンテンツを表示 */}
      <div className="tab-panel">
        {items[activeTabIndex].content}
      </div>
    </div>
  );
};

export default Tabs;
