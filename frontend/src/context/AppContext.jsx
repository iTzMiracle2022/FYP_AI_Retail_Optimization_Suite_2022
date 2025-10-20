import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [dashboardState, setDashboardState] = useState({
        stats: null,
        revenueTimeframe: '14',
        activityTimeframe: '14'
    });

    const [marketingState, setMarketingState] = useState({
        results: null,
        selected: '',
        clusters: 'auto'
    });

    const [churnState, setChurnState] = useState({
        results: null,
        selectedDataset: ''
    });

    const [inventoryState, setInventoryState] = useState({
        results: null,
        selected: '',
        forecastDays: 7
    });

    const [salesState, setSalesState] = useState({
        results: null,
        selectedDs: '',
        timePeriod: 'all',
        category: 'all',
        categories: []
    });

    const value = {
        marketingState, setMarketingState,
        churnState, setChurnState,
        inventoryState, setInventoryState,
        salesState, setSalesState,
        dashboardState, setDashboardState
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
