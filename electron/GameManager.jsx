import React, { useState } from 'react';
import GameConfigPanel from './GameConfigPanel';
import TaixiuResultPanel from './TaixiuResultPanel';

const GameManager = () => {
    const [activeTab, setActiveTab] = useState('plinko');

    const tabs = [
        { id: 'plinko', label: 'Plinko Config', type: 'config', gameType: 'plinko', title: 'Plinko' },
        { id: 'booms', label: 'Booms Config', type: 'config', gameType: 'booms', title: 'Booms' },
        { id: 'xeng', label: 'Xèng Config', type: 'config', gameType: 'xeng', title: 'Xèng Hoa Quả' },
        { id: 'tx_nan', label: 'KQ Tài Xỉu Nan', type: 'result', roomType: 'taixiunan', title: 'Tài Xỉu Nan' },
        { id: 'tx_cao', label: 'KQ Tài Xỉu Cao', type: 'result', roomType: 'taixiucao', title: 'Tài Xỉu Cao' },
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
                    tab.type === 'config' 
                        ? <GameConfigPanel key={tab.id} gameType={tab.gameType} title={tab.title} />
                        : <TaixiuResultPanel key={tab.id} roomType={tab.roomType} title={tab.title} />
                ))}
            </div>
        </div>
    );
};

export default GameManager;