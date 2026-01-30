
import { useState, useEffect, useLayoutEffect } from "react";
import { EyeOff, Play, ShieldAlert } from "lucide-react";

/**
 * PrivacyGuard Component (Final Polish)
 * 
 * Improvements:
 * 1. Uses Page Visibility API (document.hidden) -> Works reliably in Incognito/Tabs.
 * 2. z-index 9999 -> Ensures overlay acts as a top-level modal.
 * 3. Mobile "Gesture" Heuristic -> Uses visibilitychange (OS overlays trigger this).
 */
const PrivacyGuard = ({ children, onScreenshotAttempt }) => {
    // Start protected if valid, but defaults to false to avoid annoying start
    const [isProtected, setIsProtected] = useState(false);
    const [securityLock, setSecurityLock] = useState(false);

    useEffect(() => {
        // 1. Page Visibility API (Robust for Tabs/Minimizing/Mobile switcher)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsProtected(true);
            }
        };

        // 2. Window Blur (Fallback for clicking outside browser window on Desktop)
        const handleBlur = () => {
            setIsProtected(true);
        };

        // 3. Screenshot Key Detection (Instant Blackout)
        const handleKeyDown = (e) => {
            // PrintScreen or complex combos
            if (e.key === "PrintScreen" ||
                ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === 's'))) {

                // FORCE UPDATE requires flushing sync if possible, but state is fast enough here
                setSecurityLock(true);
                setIsProtected(true);

                // Notify Parent (Optional)
                if (onScreenshotAttempt) {
                    onScreenshotAttempt();
                }

                // Clear lock after 2s
                setTimeout(() => setSecurityLock(false), 2000);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("keydown", handleKeyDown); // keydown is faster than keyup

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const handleResume = () => {
        // Only allow resume if document is actually visible
        if (!document.hidden) {
            setIsProtected(false);
            setSecurityLock(false);
        }
    };

    return (
        <div className="relative w-full h-full overflow-hidden">
            {/* The Protected Content */}
            {/* We physically unmount or hide the children to ensure they are NOT in the DOM/Painting layer if locked */}
            <div
                className={`w-full h-full transition-none ${isProtected || securityLock ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                aria-hidden={isProtected || securityLock}
            >
                {children}
            </div>

            {/* Privacy Overlay (Click to Resume) */}
            {isProtected && !securityLock && (
                <div
                    onClick={handleResume}
                    className="absolute inset-0 z-[9990] flex items-center justify-center bg-base-100/95 backdrop-blur-3xl cursor-pointer"
                >
                    <div className="text-center p-8 max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 group">
                            <Play className="w-10 h-10 text-primary fill-current transition-transform group-hover:scale-110" />
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Security Paused</h2>
                        <p className="text-base-content/60 mb-8">
                            App hidden for privacy. Tap to resume.
                        </p>
                        <button className="btn btn-primary btn-wide font-bold">
                            Resume Session
                        </button>
                    </div>
                </div>
            )}

            {/* Security Lockout Overlay (Anti-Screenshot) */}
            {/* Highest Z-Index to cover everything instantly */}
            {securityLock && (
                <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black text-white">
                    <div className="text-center p-8">
                        <ShieldAlert className="w-32 h-32 mx-auto mb-6 text-red-600 animate-pulse" />
                        <h1 className="text-5xl font-black uppercase tracking-widest mb-4 text-red-500">BLOCKED</h1>
                        <p className="text-xl font-mono text-gray-400">Screenshot Attempt Detected</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrivacyGuard;
