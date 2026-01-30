
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

import {
    Channel,
    ChannelHeader,
    Chat,
    MessageInput,
    MessageList,
    Thread,
    Window,
    useMessageContext
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import ChatControls from "../components/ChatControls";
import VoiceMessageRecorder from "../components/VoiceMessageRecorder";
import EmojiPickerButton from "../components/EmojiPickerButton";
import DisappearingBanner from "../components/DisappearingBanner";
import { CustomMessage } from "../components/CustomMessage";
import PrivacyGuard from "../components/PrivacyGuard";

import { io } from "socket.io-client";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

import { EncryptionProvider, useEncryptionContext } from "../context/EncryptionContext";
import { Shield, ShieldAlert, ShieldCheck, RefreshCw } from "lucide-react";

const SecurityBadge = () => {
    const { securityStatus, keyFingerprint } = useEncryptionContext();

    if (securityStatus === 'unsecured') return null;

    return (
        <div className="absolute top-16 left-4 z-40 flex flex-col items-start gap-1 animate-in fade-in slide-in-from-top-2">
            <div className={`badge gap-2 p-3 font-mono font-bold shadow-lg ${securityStatus === 'secured' ? 'badge-success text-white' :
                securityStatus === 'negotiating' ? 'badge-warning' : 'badge-error'
                }`}>
                {securityStatus === 'secured' && <ShieldCheck size={14} />}
                {securityStatus === 'negotiating' && <RefreshCw size={14} className="animate-spin" />}
                {securityStatus === 'failed' && <ShieldAlert size={14} />}

                {securityStatus === 'secured' ? 'SECURE' : securityStatus.toUpperCase()}

                {keyFingerprint && (
                    <span className="opacity-50 text-[10px] ml-1 pt-0.5 border-l border-white/30 pl-2">
                        {keyFingerprint}
                    </span>
                )}
            </div>

            {/* Ghost Protocol Indicator */}
            {securityStatus === 'secured' && (
                <div className="badge badge-ghost badge-sm text-[10px] gap-1 opacity-70">
                    👻 GHOST PROTOCOL
                </div>
            )}
        </div>
    );
};

const ChatPageContent = ({ socket }) => {
    const { id: targetUserId } = useParams();
    const { encryptMessage } = useEncryptionContext(); // isEncrypted handled internally

    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);

    const { authUser } = useAuthUser();

    const { data: tokenData } = useQuery({
        queryKey: ["streamToken", authUser?._id],
        queryFn: getStreamToken,
        enabled: !!authUser,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    useEffect(() => {
        const initChat = async () => {
            if (!tokenData?.token || !authUser) {
                console.log("Waiting for token or auth user...", { token: !!tokenData?.token, user: !!authUser });
                return;
            }

            try {
                console.log("Initializing stream chat client...");

                const client = StreamChat.getInstance(STREAM_API_KEY);


                if (client.userID && client.userID !== authUser._id) {
                    await client.disconnectUser();
                    console.log("Disconnected previous Stream user");
                }

                if (!client.userID) {
                    await client.connectUser(
                        {
                            id: authUser._id,
                            name: authUser.fullName,
                            image: authUser.profilePic,
                        },
                        tokenData.token
                    );
                    console.log("Stream user connected:", authUser.fullName);
                }

                const channelId = [authUser._id, targetUserId].sort().join("-");
                const currChannel = client.channel("messaging", channelId, {
                    members: [authUser._id, targetUserId],
                });

                await currChannel.watch();

                setChatClient(client);
                setChannel(currChannel);
            } catch (error) {
                console.error("Error initializing chat:", error);
                toast.error("Could not connect to chat. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        initChat();

        // Optional: cleanup when component unmounts
        return () => {
            if (chatClient) {
                // chatClient.disconnectUser().catch((err) => console.log("Cleanup error:", err));
            }
        };
    }, [tokenData, authUser, targetUserId]);

    const handleVideoCall = () => {
        if (channel) {
            const callUrl = `${window.location.origin}/call/${channel.id}`;
            channel.sendMessage({ text: `I've started a video call. Join me here: ${callUrl}` });
            toast.success("Video call link sent successfully!");
        }
    };

    // Disappearing Messages Logic
    useEffect(() => {
        if (!channel || !chatClient || !authUser) return;

        const handleNewMessage = (event) => {
            // Check if disappearing is ON for this channel
            const settings = channel.data?.disappearingSettings;

            if (settings?.enabled) {
                // Only expire my own messages to avoid conflict (assume other client expires theirs)
                if (event.message.user.id === authUser._id) {
                    const duration = settings.duration || 10000;
                    const timeoutId = setTimeout(async () => {
                        try {
                            await chatClient.deleteMessage(event.message.id);
                            console.log(`Message ${event.message.id} expired.`);
                        } catch (err) {
                            console.error("Failed to expire message:", err);
                        }
                    }, duration);
                }
            }
        };

        channel.on('message.new', handleNewMessage);

        // Also listen for channel updates to react to settings changes immediately? 
        // (Simpler to just use current settings on new message for now)

        return () => {
            channel.off('message.new', handleNewMessage);
        };
    }, [channel, chatClient, authUser]);

    // Force re-render on channel updates
    const [channelUpdateVersion, setChannelUpdateVersion] = useState(0);

    // Listen for channel updates to refresh state (e.g. appearing settings)
    useEffect(() => {
        if (!channel) return;

        const handleChannelUpdate = () => {
            // Just increment version to trigger re-render of components tracking channel data
            setChannelUpdateVersion(v => v + 1);
        };

        channel.on('channel.updated', handleChannelUpdate);

        return () => {
            // Cleanup
            channel.off('channel.updated', handleChannelUpdate);
        };
    }, [channel]);

    // Override Message Input Submit
    const overrideSubmitHandler = async (message) => {
        console.log("🔵 overrideSubmitHandler called with:", message);

        const { text, attachments } = message;
        let finalBody = text;

        // Auto-encrypt if provider says we are secured
        if (encryptMessage && finalBody) {
            console.log("🔐 Encrypting message...");
            finalBody = encryptMessage(text);
        }

        try {
            console.log("📤 Sending message to channel...");
            await channel.sendMessage({
                text: finalBody,
                attachments
            });
            console.log("✅ Message sent successfully");
        } catch (err) {
            console.error("❌ Send failed", err);
            toast.error("Failed to send message");
        }
    };

    const handleScreenshotAttempt = async () => {
        if (channel && chatClient) {
            try {
                await channel.sendMessage({
                    text: "📸 Screenshot attempt detected! 🚨",
                    type: 'system', // Differentiate this message
                });
                toast.error("Screenshot attempt logged!");
            } catch (err) {
                console.error("Failed to send screenshot alert:", err);
            }
        }
    };


    if (loading) {
        console.log("ChatPage: Loading state is true");
        return <ChatLoader />;
    }

    if (!chatClient || !channel) {
        console.log("ChatPage: loaded but missing client/channel", { chatClient: !!chatClient, channel: !!channel });
        return <ChatLoader />;
    }

    console.log("ChatPage: Rendering Chat UI");

    // Persistent Banner Component
    const DisappearingBanner = () => {
        // Read directly from channel data
        const settings = channel?.data?.disappearingSettings;
        if (!settings?.enabled) return null;

        const durationText = settings.duration === 10000 ? "10s"
            : settings.duration === 60000 ? "1m"
                : settings.duration === 3600000 ? "1h"
                    : "24h";

        return (
            <div className="bg-error/10 text-error text-xs font-bold text-center py-1 flex items-center justify-center gap-2 border-b border-error/20">
                <span>⚠️ Disappearing Messages are ON ({durationText})</span>
            </div>
        );
    };

    return (
        <div className="h-[93vh]">
            <Chat client={chatClient}>
                <Channel
                    channel={channel}
                    Message={CustomMessage} // Use custom message component
                >
                    <PrivacyGuard onScreenshotAttempt={handleScreenshotAttempt}>

                        {/* Automated Security Badge */}
                        <SecurityBadge />

                        <div className="w-full relative h-full flex flex-col">
                            <Window>
                                {/* Combined Header Area */}
                                <div className="relative">
                                    <ChannelHeader />
                                    {/* ChatControls positioned absolutely within ChannelHeader */}
                                    <div className="absolute top-0 right-0 h-full flex items-center pr-3">
                                        <ChatControls ioChannel={socket} handleVideoCall={handleVideoCall} key={channelUpdateVersion} channelId={channel.id} />
                                    </div>
                                </div>


                                {/* Disappearing Message Banner */}
                                <DisappearingBanner socket={socket} />

                                <MessageList />
                                <div className="flex items-center w-full p-2 gap-2">
                                    <VoiceMessageRecorder channel={channel} />
                                    <div className="flex-1">
                                        {/* Wrapping in div to ensure correct layout */}
                                        <MessageInput
                                            focus
                                            overrideSubmitHandler={overrideSubmitHandler}
                                        />
                                    </div>
                                    <EmojiPickerButton
                                        onEmojiSelect={(emoji) => {
                                            console.log('🎯 Emoji clicked:', emoji);
                                            const textarea = document.querySelector('.str-chat__textarea__textarea');
                                            if (textarea) {
                                                const currentValue = textarea.value || '';
                                                const newValue = currentValue + emoji;

                                                // Set value using native setter
                                                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                                                setter.call(textarea, newValue);

                                                // Trigger events
                                                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                                                textarea.focus();

                                                console.log('✅ Emoji added:', newValue);
                                            } else {
                                                console.error('❌ Textarea not found');
                                            }
                                        }}
                                    />
                                </div>
                            </Window>
                        </div>
                    </PrivacyGuard>
                    <Thread />
                </Channel>
            </Chat>
        </div>
    );
};

const ChatPage = () => {
    const { id: targetUserId } = useParams();
    const { authUser } = useAuthUser();
    const [socket, setSocket] = useState(null);

    // Define channelId BEFORE using it in useEffect
    const channelId = authUser && targetUserId ? [authUser._id, targetUserId].sort().join("-") : null;

    useEffect(() => {
        const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : '/';
        const newSocket = io(backendUrl, { transports: ['websocket', 'polling'] });
        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, []);

    // Join Room for Handshake
    useEffect(() => {
        if (socket && channelId) {
            socket.emit('join-room', channelId);
            console.log("🔐 ECDH Socket Joined Room:", channelId);
        }
    }, [socket, channelId]);

    return (
        <EncryptionProvider socket={socket} channelId={channelId} userId={authUser?._id}>
            <ChatPageContent socket={socket} />
        </EncryptionProvider>
    );
};

export default ChatPage;
