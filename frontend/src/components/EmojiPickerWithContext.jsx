import EmojiPickerButton from './EmojiPickerButton';

function EmojiPickerWithContext() {
    const handleEmojiSelect = (emoji) => {
        console.log('🎯 Emoji selected:', emoji);

        // Find the textarea
        const textarea = document.querySelector('.str-chat__textarea__textarea');
        if (!textarea) {
            console.error('❌ Textarea not found');
            return;
        }

        console.log('✅ Textarea found, current value:', textarea.value);

        // Get current selection
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const currentValue = textarea.value || '';

        // Create new value with emoji inserted
        const newValue = currentValue.substring(0, start) + emoji + currentValue.substring(end);
        console.log('📝 New value will be:', newValue);

        // Update the textarea value using native setter to bypass React
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        ).set;
        nativeTextAreaValueSetter.call(textarea, newValue);

        // Dispatch both input and change events to trigger React's handlers
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(inputEvent);
        textarea.dispatchEvent(changeEvent);

        // Set cursor position and focus
        const newCursorPos = start + emoji.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();

        console.log('✅ Emoji inserted successfully');
    };

    return <EmojiPickerButton onEmojiSelect={handleEmojiSelect} />;
}

export default EmojiPickerWithContext;
