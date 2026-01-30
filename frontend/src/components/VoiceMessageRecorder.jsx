
import { useState, useRef } from "react";
import { Mic, Square, Send } from "lucide-react";
import toast from "react-hot-toast";

const VoiceMessageRecorder = ({ channel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast.error("Audio recording is not supported in this browser or context (requires HTTPS).");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const sendVoiceMessage = async () => {
        if (!audioBlob || !channel) {
            console.error("Missing blob or channel", { audioBlob, channel });
            return;
        }

        try {
            // Explicitly verify mime type support if needed, but 'audio/webm' is standard.
            const file = new File([audioBlob], `voice-message-${Date.now()}.webm`, { type: "audio/webm" });

            console.log("Uploading voice message:", file.name, file.size);

            // 1. Upload file
            const response = await channel.sendFile(file);
            const fileUrl = response.file;

            console.log("File uploaded, sending message...", fileUrl);

            // 2. Send message with explicit 'voice' type for easier detection if needed, 
            // but sticking to standard structure with 'attachments' is safer for Stream.
            await channel.sendMessage({
                text: "",
                attachments: [
                    {
                        type: "file",
                        asset_url: fileUrl,
                        mime_type: "audio/webm",
                        file_size: file.size,
                        title: file.name
                    }
                ]
            });

            setAudioBlob(null);
            toast.success("Voice message sent!");
        } catch (error) {
            console.error("Error sending voice message:", error);
            toast.error(`Failed to send: ${error.message}`);
        }
    };

    const cancelRecording = () => {
        setAudioBlob(null);
        setIsRecording(false);
        if (mediaRecorderRef.current) {
            // ensure tracks are stopped if cancelled mid-recording
            // (though stopRecording handles explicit stop, this resets state)
        }
    };

    return (
        <div className="flex items-center gap-2 mr-2">
            {/* Recording Controls */}
            {!isRecording && !audioBlob && (
                <button
                    onClick={startRecording}
                    className="btn btn-ghost btn-circle btn-sm text-primary"
                    title="Record Voice Message"
                >
                    <Mic size={20} />
                </button>
            )}

            {isRecording && (
                <button
                    onClick={stopRecording}
                    className="btn btn-error btn-circle btn-sm animate-pulse"
                    title="Stop Recording"
                >
                    <Square size={16} fill="currentColor" />
                </button>
            )}

            {/* Review & Send */}
            {audioBlob && (
                <div className="flex items-center gap-1 bg-base-200 rounded-full px-2 py-1">
                    <span className="text-xs px-2">Voice recorded</span>
                    <button
                        onClick={sendVoiceMessage}
                        className="btn btn-primary btn-circle btn-xs"
                    >
                        <Send size={12} />
                    </button>
                    <button
                        onClick={cancelRecording}
                        className="btn btn-ghost btn-circle btn-xs text-error"
                    >
                        <span className="text-xs">✕</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceMessageRecorder;
