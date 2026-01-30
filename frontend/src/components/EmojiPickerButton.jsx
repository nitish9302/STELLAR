import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Smile } from 'lucide-react';

function EmojiPickerButton({ onEmojiSelect }) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef(null);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false);
            }
        };

        if (showPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPicker]);

    const handleEmojiClick = (emojiData) => {
        onEmojiSelect(emojiData.emoji);
        setShowPicker(false);
    };

    return (
        <div className="relative" ref={pickerRef}>
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="btn btn-ghost btn-sm btn-circle"
                title="Add Emoji"
            >
                <Smile className="size-5" />
            </button>

            {showPicker && (
                <div className="absolute bottom-12 right-0 z-50">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={350}
                        height={400}
                        theme="dark"
                        searchDisabled={false}
                        skinTonesDisabled={false}
                        previewConfig={{ showPreview: false }}
                    />
                </div>
            )}
        </div>
    );
}

export default EmojiPickerButton;
