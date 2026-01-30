
import { useState, useEffect, useCallback, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { ec as EC } from 'elliptic';

const ec = new EC('secp256k1');

export const useSecureChannel = (socket, channelId, userId) => {
    const [securityStatus, setSecurityStatus] = useState('unsecured'); // 'unsecured', 'negotiating', 'secured'
    const [sharedSecret, setSharedSecret] = useState(null);
    const [keyFingerprint, setKeyFingerprint] = useState(null);

    // Keep refs for callbacks to avoid stale closures without re-triggering effects
    const myKeyPair = useRef(null);
    const rotationTimer = useRef(null);

    // Initialize Identity on Mount
    useEffect(() => {
        if (!userId) return;
        myKeyPair.current = ec.genKeyPair();
        console.log("🔐 ECDH: Generated Local KeyPair");
    }, [userId]);

    // Socket Event Listeners for Handshake
    useEffect(() => {
        if (!socket || !channelId) return;

        const handleHandshake = (data) => {
            // data: { senderId, publicKey, type: 'init' | 'response' }
            if (data.senderId === userId) return; // Ignore self

            console.log(`🔐 ECDH: Received ${data.type} from ${data.senderId}`);

            try {
                // 1. Decode peer's public key
                const peerKey = ec.keyFromPublic(data.publicKey, 'hex');

                // 2. Derive Shared Secret (ECDH)
                const derivedSecret = myKeyPair.current.derive(peerKey.getPublic()).toString(16);

                // 3. Set Secret & Secured Status
                setSharedSecret(derivedSecret);
                setKeyFingerprint(derivedSecret.substring(0, 8)); // Show shortened hash for UI
                setSecurityStatus('secured');
                console.log("🔐 ECDH: Secure Channel Established!");

                // 4. If this was an 'init', we MUST respond with our Public Key
                if (data.type === 'init') {
                    socket.emit('handshake-signal', {
                        roomId: channelId,
                        senderId: userId,
                        publicKey: myKeyPair.current.getPublic('hex'),
                        type: 'response'
                    });
                    console.log("🔐 ECDH: Sent Handshake Response");
                }
            } catch (err) {
                console.error("🔐 ECDH Error:", err);
                setSecurityStatus('failed');
            }
        };

        socket.on('handshake-signal', handleHandshake);

        // Auto-Initiate Handshake when joining
        if (myKeyPair.current) {
            setSecurityStatus('negotiating');
            socket.emit('handshake-signal', {
                roomId: channelId,
                senderId: userId,
                publicKey: myKeyPair.current.getPublic('hex'),
                type: 'init'
            });
        }

        return () => {
            socket.off('handshake-signal', handleHandshake);
        };
    }, [socket, channelId, userId]);

    // Key Rotation Logic (Every 60s)
    useEffect(() => {
        if (securityStatus === 'secured') {
            rotationTimer.current = setInterval(() => {
                console.log("🔄 ECDH: Rotating Keys...");
                // Generate NEW keys
                myKeyPair.current = ec.genKeyPair();
                // Send NEW Init
                socket.emit('handshake-signal', {
                    roomId: channelId,
                    senderId: userId,
                    publicKey: myKeyPair.current.getPublic('hex'),
                    type: 'init'
                });
            }, 60000); // 60 seconds
        }

        return () => clearInterval(rotationTimer.current);
    }, [securityStatus, socket, channelId, userId]);


    // Encryption Wrappers
    // GHOST PROTOCOL: Constant Bitrate Padding
    const GHOST_PADDING_SIZE = 2048; // Pad packets to constant size

    const encryptMessage = useCallback((text) => {
        if (!sharedSecret) return text;
        try {
            // Apply Ghost Padding
            let paddedText = text;
            if (text.length < GHOST_PADDING_SIZE) {
                const paddingNeeded = GHOST_PADDING_SIZE - text.length;
                // Add separator and random padding
                // Use a distinct separator that is unlikely to appear in user text
                paddedText = text + "||GHST||" + "x".repeat(paddingNeeded - 8);
            }

            return 'ENC:' + CryptoJS.AES.encrypt(paddedText, sharedSecret).toString();
        } catch (e) {
            console.error("Encrypt failed", e);
            return text;
        }
    }, [sharedSecret]);

    const decryptMessage = useCallback((text) => {
        if (!text || !text.startsWith('ENC:')) return text;
        if (!sharedSecret) return "⚠️ Waiting for Keys...";

        try {
            const raw = text.substring(4); // Remove 'ENC:' prefix
            const bytes = CryptoJS.AES.decrypt(raw, sharedSecret);
            const paddedOriginal = bytes.toString(CryptoJS.enc.Utf8);

            if (!paddedOriginal) return "🔒 Decryption Failed (Key Mismatch)";

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
