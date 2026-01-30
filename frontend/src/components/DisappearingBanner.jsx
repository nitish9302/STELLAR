import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';

function DisappearingBanner({ socket }) {
    const [settings, setSettings] = useState({ enabled: false, duration: 60000 });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        console.log('🔔 DisappearingBanner mounted, socket:', socket);
        if (!socket || typeof socket.on !== 'function') {
            console.log('❌ Socket not ready or invalid');
            return;
        }

        socket.on("disappearing-updated", (newSettings) => {
            console.log('📢 Disappearing settings updated:', newSettings);
            setSettings(newSettings);
            setDismissed(false); // Show banner again when settings change
        });

        // Request current settings
        if (typeof socket.emit === 'function') {
            console.log('📤 Requesting disappearing settings...');
            socket.emit("get-disappearing-settings");
        }

        return () => {
            if (socket && typeof socket.off === 'function') {
                socket.off("disappearing-updated");
            }
        };
    }, [socket]);

    console.log('🎨 Banner render - enabled:', settings.enabled, 'dismissed:', dismissed);

    if (!settings.enabled || dismissed) return null;

    const formatDuration = (ms) => {
        if (ms < 60000) return `${ms / 1000} seconds`;
        if (ms < 3600000) return `${ms / 60000} minute${ms / 60000 > 1 ? 's' : ''}`;
        if (ms < 86400000) return `${ms / 3600000} hour${ms / 3600000 > 1 ? 's' : ''}`;
        return `${ms / 86400000} day${ms / 86400000 > 1 ? 's' : ''}`;
    };

    return (
        <div className="bg-error/10 border-l-4 border-error px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-error" />
                <span className="font-medium text-error">
                    Disappearing messages enabled
                </span>
                <span className="text-base-content/70">
                    • Messages delete after {formatDuration(settings.duration)}
                </span>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="btn btn-ghost btn-xs btn-circle"
                title="Dismiss"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}

export default DisappearingBanner;
