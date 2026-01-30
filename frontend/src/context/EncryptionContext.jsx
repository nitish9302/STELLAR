
import React, { createContext, useContext } from 'react';
import { useEncryption } from '../hooks/useEncryption'; // Legacy Manual
import { useSecureChannel } from '../hooks/useSecureChannel'; // New Automated

const EncryptionContext = createContext(null);

export const EncryptionProvider = ({ children, socket, channelId, userId, mode = 'automated' }) => {
    // We can support both modes, but prioritizing Automated as requested.
    const automated = useSecureChannel(socket, channelId, userId);

    // Return values matching the interface expected by consumers
    const value = {
        ...automated,
        isEncrypted: automated.securityStatus === 'secured', // Backward compat for UI flags if needed
    };

    return (
        <EncryptionContext.Provider value={value}>
            {children}
        </EncryptionContext.Provider>
    );
};

export const useEncryptionContext = () => useContext(EncryptionContext);
