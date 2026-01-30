
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { VideoIcon, Settings, Clock, Trash2, Palette } from "lucide-react";

function ChatControls({ ioChannel, handleVideoCall, channelId }) {
    const navigate = useNavigate();
    const [disappearingSettings, setDisappearingSettings] = useState({
        enabled: false,
        duration: 60000, // Default 1 minute
    });

    // Listen for disappearing message settings from server
    useEffect(() => {
        if (!ioChannel) return;

        ioChannel.on("disappearing-updated", (settings) => {
            setDisappearingSettings(settings);
            toast.success(`Disappearing messages ${settings.enabled ? "enabled" : "disabled"}`);
        });

        // Request current settings when component mounts - only if ioChannel has emit method
        if (typeof ioChannel.emit === 'function') {
            ioChannel.emit("get-disappearing-settings");
        }

        return () => {
            if (ioChannel && typeof ioChannel.off === 'function') {
                ioChannel.off("disappearing-updated");
            }
        };
    }, [ioChannel]);

    const toggleDisappearing = (enabled, duration) => {
        if (!ioChannel || typeof ioChannel.emit !== 'function') {
            toast.error("Connection not ready");
            return;
        }

        const newSettings = {
            roomId: channelId,
            enabled,
            duration: parseInt(duration),
        };

        ioChannel.emit("toggle-disappearing", newSettings);
        setDisappearingSettings(newSettings);
    };

    const handleWhiteboard = () => {
        // Extract the other user's ID from the current chat URL
        const currentPath = window.location.pathname;
        const userId = currentPath.split("/chat/")[1];
        if (userId) {
            navigate(`/whiteboard/${userId}`);
        } else {
            toast.error("Could not determine user ID");
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Whiteboard Button */}
            <button onClick={handleWhiteboard} className="btn btn-ghost btn-sm btn-circle text-primary" title="Open Whiteboard">
                <Palette className="size-5" />
            </button>

            {/* Video Call Button */}
            <button onClick={handleVideoCall} className="btn btn-ghost btn-sm btn-circle text-primary" title="Start Video Call">
                <VideoIcon className="size-5" />
            </button>

            {/* Settings Dropdown */}
            <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className={`btn btn-sm btn-circle ${disappearingSettings.enabled ? 'btn-error text-white' : 'btn-ghost'}`}>
                    <Settings className="size-5" />
                </div>
                <ul tabIndex={0} className="dropdown-content z-[1] menu p-3 shadow-xl bg-base-200 border border-base-300 rounded-box w-60">
                    <li>
                        <div className="flex flex-col gap-2 cursor-default active:bg-transparent hover:bg-transparent focus:bg-transparent">
                            <div className="flex justify-between w-full">
                                <div className="flex items-center gap-2">
                                    {disappearingSettings.enabled ? <Clock className="size-4 text-error" /> : <Trash2 className="size-4 text-base-content" />}
                                    <span className="text-sm font-bold text-base-content">Disappearing</span>
                                </div>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-xs toggle-error"
                                    checked={disappearingSettings.enabled || false}
                                    onChange={(e) => toggleDisappearing(e.target.checked, disappearingSettings.duration)}
                                />
                            </div>

                            {disappearingSettings.enabled && (
                                <select
                                    className="select select-bordered select-xs w-full bg-base-100 text-base-content"
                                    value={disappearingSettings.duration}
                                    onChange={(e) => toggleDisappearing(true, e.target.value)}
                                >
                                    <option value={10000}>10 Seconds</option>
                                    <option value={60000}>1 Minute</option>
                                    <option value={3600000}>1 Hour</option>
                                    <option value={86400000}>24 Hours</option>
                                </select>
                            )}
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default ChatControls;
