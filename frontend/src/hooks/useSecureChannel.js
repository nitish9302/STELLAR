
import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';

// 👻 GHOST PROTOCOL 2.0: Deteministic Channel Keys
// We switched from Ephemeral ECDH to Deterministic Keys derived from Channel ID
// This allows history to be readable across sessions (Persistent Chat)
// while still providing "Encryption" features (obfuscation + privacy from casual sniffing).

const APP_SECRET_SALT = "STELLAR_GHOST_PROTOCOL_V2_SALT_#9928";

export const useSecureChannel = (socket, channelId, userId) => {
    const [securityStatus, setSecurityStatus] = useState('unsecured');
    const [sharedSecret, setSharedSecret] = useState(null);
    const [keyFingerprint, setKeyFingerprint] = useState(null);

    // Initialize Deterministic Key
    useEffect(() => {
        if (!channelId || !userId) return;

        try {
            // Derive a consistent key for this channel
            // This means anyone in the channel (who knows the ID) can derive the key if they have the code.
            // This is "Client-Side Encryption" for privacy, not "End-to-End" for absolute secrecy against the server.
            const derivedKey = CryptoJS.SHA256(channelId + APP_SECRET_SALT).toString();

            setSharedSecret(derivedKey);
            setKeyFingerprint(derivedKey.substring(0, 8));
            setSecurityStatus('secured');

            console.log("👻 Ghost Protocol V2: Channel Key Derived");
        } catch (err) {
            console.error("Key Derivation Failed", err);
            setSecurityStatus('failed');
        }

    }, [channelId, userId]);

    // Encryption Constants
    const GHOST_PADDING_SIZE = 2048;

    const encryptMessage = useCallback((text) => {
        if (!sharedSecret) return text;
        try {
            // Apply Ghost Padding (Obfuscate Length)
            let paddedText = text;
            if (text.length < GHOST_PADDING_SIZE) {
                const paddingNeeded = GHOST_PADDING_SIZE - text.length;
                paddedText = text + "||GHST||" + "x".repeat(paddingNeeded - 8);
            }

            return 'ENC:' + CryptoJS.AES.encrypt(paddedText, sharedSecret).toString();
        } catch (e) {
            console.error("Encrypt failed", e);
            return text;
        }
    }, [sharedSecret]);

    const decryptMessage = useCallback((text) => {
        if (!text) return text;

        // Handle Legacy/Plaintext messages
        if (!text.startsWith('ENC:')) return text;

        if (!sharedSecret) return "Loading Keys..."; // Should be fast

        try {
            const raw = text.substring(4); // Remove 'ENC:' prefix

            let bytes;
            try {
                bytes = CryptoJS.AES.decrypt(raw, sharedSecret);
            } catch (cryptoErr) {
                // If AES fails completely (e.g. malformed)
                return "🔒 Message Locked (Data Corrupt)";
            }

            const paddedOriginal = bytes.toString(CryptoJS.enc.Utf8);

            // If decryption produced empty string (wrong key)
            if (!paddedOriginal) {
                // This happens for OLD messsages encrypted with the OLD Ephemeral Keys.
                // We cannot recover them.
                return "🔒 Message Locked (Session Expired)";
            }

            // Ghost Protocol: Strip Padding
            if (paddedOriginal.includes("||GHST||")) {
                return paddedOriginal.split("||GHST||")[0];
            }

            return paddedOriginal;
        } catch (e) {
            return "🔒 Decryption Error";
        }
    }, [sharedSecret]);

    return {
        securityStatus,
        keyFingerprint,
        encryptMessage,
        decryptMessage
    };
};
