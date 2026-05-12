import React, { createContext, useContext, ReactNode } from 'react';

// CommunityContext will hold all the state variables for the CommunityHub.
export const CommunityContext = createContext<any>(undefined);

export const useCommunity = () => {
    const ctx = useContext(CommunityContext);
    if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
    return ctx;
};
