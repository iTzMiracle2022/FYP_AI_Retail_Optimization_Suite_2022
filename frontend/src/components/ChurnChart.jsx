import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

const ChurnChart = ({ data }) => {
    // Process data for visualization
    const churnDistribution = [
        {
            name: 'At Risk',
            value: data.filter(c => c.churn_prediction === 1).length,
            color: '#ff4444',
        },
        {
            name: 'Safe',
            value: data.filter(c => c.churn_prediction === 0).length,
            color: '#00C49F',
        },
    ];

    // Churn probability ranges
    const probabilityRanges = [
        { range: '0-20%', count: data.filter(c => c.churn_probability < 0.2).length },
        { range: '20-40%', count: data.filter(c => c.churn_probability >= 0.2 && c.churn_probability < 0.4).length },
        { range: '40-60%', count: data.filter(c => c.churn_probability >= 0.4 && c.churn_probability < 0.6).length },
        { range: '60-80%', count: data.filter(c => c.churn_probability >= 0.6 && c.churn_probability < 0.8).length },
        { range: '80-100%', count: data.filter(c => c.churn_probability >= 0.8).length },
    ];

    return (
        <div className="chart-container">
            <div className="chart-row">
                {/* Pie Chart */}
                <div className="chart-box">
                    <h3>Churn Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={churnDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {churnDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div className="chart-box">
                    <h3>Churn Probability Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={probabilityRanges}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ChurnChart;