import React, { createContext, useContext, ReactNode } from 'react';
import { CommunityLeaderboardProps, CommunityFeedProps, CommunityChatProps } from '../../types';

export type CommunityViewContextType = CommunityLeaderboardProps & CommunityFeedProps & CommunityChatProps;

export const CommunityViewContext = createContext<CommunityViewContextType | undefined>(undefined);

export const useCommunityView = () => {
    const ctx = useContext(CommunityViewContext);
    if (!ctx) throw new Error('useCommunityView must be used within CommunityViewProvider');
    return ctx;
};

export const CommunityViewProvider: React.FC<{ value: CommunityViewContextType; children: ReactNode }> = ({ value, children }) => {
    return (
        <CommunityViewContext.Provider value={value}>
            {children}
        </CommunityViewContext.Provider>
    );
};
