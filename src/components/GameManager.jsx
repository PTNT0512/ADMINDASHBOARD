// src/components/GameManager.jsx
import React, { useState } from 'react';
import GameConfigPanel from './GameConfigPanel.jsx';

const GameManager = () => {
    const [activeTab, setActiveTab] = useState('plinko');

    const tabs = [
        { id: 'plinko', label: 'Plinko', type: 'config', gameType: 'plinko', title: 'Cấu hình Plinko' },
        { id: 'booms', label: 'Booms', type: 'config', gameType: 'booms', title: 'Cấu hình Booms' },
        { id: 'xeng', label: 'Xèng Hoa Quả', type: 'config', gameType: 'xeng', title: 'Cấu hình Xèng Hoa Quả' },
    ];

    return (
        <div className="p-4">
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                            activeTab === tab.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="transition-all duration-300">
                {tabs.map(tab => activeTab === tab.id && (
                    <GameConfigPanel key={tab.id} gameType={tab.gameType} title={tab.title} />
                ))}
            </div>
        </div>
    );
};

export default GameManager;