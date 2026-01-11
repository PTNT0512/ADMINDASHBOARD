import React from 'react';

const RevenueChart = ({ data = [], title = "Biểu đồ doanh thu 7 ngày gần nhất" }) => {
    if (!data || data.length === 0) return null;

    const height = 300;
    const width = 800;
    const padding = 50;

    const maxValue = Math.max(...data.map(d => d.value)) || 1;
    const minValue = 0;

    const getX = (index) => padding + (index / (data.length - 1)) * (width - 2 * padding);
    const getY = (value) => height - padding - ((value - minValue) / (maxValue - minValue)) * (height - 2 * padding);

    const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');
    const areaPath = `M ${points} L ${getX(data.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;

    return (
        <div style={{
            background: 'var(--card-bg, #fff)',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 6px 18px rgba(15,23,42,0.04)',
            border: '1px solid rgba(15,23,42,0.04)',
            marginBottom: '30px',
            marginTop: '30px'
        }}>
            <h3 style={{ margin: '0 0 20px 0', color: 'var(--text, #333)', fontSize: '16px', fontWeight: 'bold' }}>{title}</h3>
            <div style={{ width: '100%', height: 'auto', overflow: 'hidden' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = height - padding - ratio * (height - 2 * padding);
                        const val = Math.round(minValue + ratio * (maxValue - minValue));
                        return (
                            <g key={i}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(0,0,0,0.1)" strokeDasharray="4 4" />
                                <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary, #666)">
                                    {val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : val.toLocaleString()}
                                </text>
                            </g>
                        );
                    })}

                    {/* Area */}
                    <path d={areaPath} fill="rgba(33, 150, 243, 0.1)" />

                    {/* Line */}
                    <polyline points={points} fill="none" stroke="#2196f3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Points */}
                    {data.map((d, i) => (
                        <g key={i} className="chart-point">
                            <circle 
                                cx={getX(i)} 
                                cy={getY(d.value)} 
                                r="4" 
                                fill="#fff" 
                                stroke="#2196f3" 
                                strokeWidth="2"
                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            />
                            <text x={getX(i)} y={getY(d.value) - 10} textAnchor="middle" fontSize="10" fill="#2196f3" fontWeight="bold" style={{ opacity: 0.8 }}>
                                {(d.value / 1000000).toFixed(1)}M
                            </text>
                        </g>
                    ))}

                    {/* X Axis Labels */}
                    {data.map((d, i) => (
                        <text key={i} x={getX(i)} y={height - 15} textAnchor="middle" fontSize="10" fill="var(--text-secondary, #666)">
                            {d.label}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default RevenueChart;