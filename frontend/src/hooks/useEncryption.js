
import { useState, useCallback } from 'react';
import CryptoJS from 'crypto-js';

export const useEncryption = () => {
    const [secretKey, setSecretKey] = useState("");
    const [isEncrypted, setIsEncrypted] = useState(false);

    // Validate if a text string looks like AES ciphertext (U2FsdGVkX1...)
    const isCiphertext = (text) => {
        return text && typeof text === 'string' && text.startsWith('U2FsdGVkX1');
    };

    const encryptMessage = (text) => {
        if (!isEncrypted || !secretKey) return text;
        try {
            return CryptoJS.AES.encrypt(text, secretKey).toString();
        } catch (error) {
            console.error("Encryption failed:", error);
            return text;
        }
    };

    const decryptMessage = (text) => {
        if (!secretKey) return text; // If no key, return raw (might be gibberish)
        if (!isCiphertext(text)) return text; // Not encrypted

        try {
            const bytes = CryptoJS.AES.decrypt(text, secretKey);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);

            // If decryption fails (wrong key), bytes are empty or malformed
            if (!originalText) return "🔒 Extended Protection: Unable to decrypt";

            return originalText;
        } catch (error) {
            return text; // Return original if fail
        }
    };

    return {
        secretKey,
        setSecretKey,
        isEncrypted,
        setIsEncrypted,
        encryptMessage,
        decryptMessage,
        isCiphertext
    };
};
