
import { MessageSimple, useMessageContext } from "stream-chat-react";
import { useEncryptionContext } from "../context/EncryptionContext";

export const CustomMessage = (props) => {
    const { message } = useMessageContext();

    // 1. HIDDEN TRACE: If message is deleted, don't render anything
    if (message.deleted_at || message.type === 'deleted') {
        return null;
    }

    // 2. VOICE MESSAGE: Check for audio attachment
    const voiceAttachment = message.attachments?.find(
        (a) => (a.type === "file" || a.type === "audio") && a.mime_type?.startsWith("audio/")
    );

    // 3. ENCRYPTION: Decrypt text if needed
    const { decryptMessage, isEncrypted } = useEncryptionContext() || {};

    // Create a modified message object with decrypted text
    const displayMessage = {
        ...message,
        text: (isEncrypted && message.text) ? decryptMessage(message.text) : message.text
    };

    if (voiceAttachment) {
        return (
            <div className={`str-chat__message-simple__content ${props.isMyMessage ? 'str-chat__message-simple__content--me' : ''}`}>
                <div className="p-2 bg-base-100 rounded-lg mb-1">
                    <audio controls src={voiceAttachment.asset_url} className="w-full max-w-xs" />
                </div>
                <MessageSimple {...props} message={displayMessage} />
            </div>
        );
    }

    return <MessageSimple {...props} message={displayMessage} />;
};
