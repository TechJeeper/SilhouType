/**
 * Reliable text input — handles insertion/deletion manually so caret position
 * cannot be corrupted by unrelated DOM updates elsewhere on the page.
 */

export function initTextInput(input, { onChange } = {}) {
  input.addEventListener('beforeinput', (e) => {
    if (e.isComposing) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const value = input.value;

    switch (e.inputType) {
      case 'insertText':
      case 'insertReplacementText':
        if (e.data == null) return;
        e.preventDefault();
        applyEdit(input, value.slice(0, start) + e.data + value.slice(end), start + e.data.length);
        notify(onChange, input);
        break;

      case 'deleteContentBackward':
        e.preventDefault();
        if (start === end && start > 0) {
          applyEdit(input, value.slice(0, start - 1) + value.slice(end), start - 1);
        } else if (start !== end) {
          applyEdit(input, value.slice(0, start) + value.slice(end), start);
        }
        notify(onChange, input);
        break;

      case 'deleteContentForward':
        e.preventDefault();
        if (start === end && end < value.length) {
          applyEdit(input, value.slice(0, start) + value.slice(end + 1), start);
        } else if (start !== end) {
          applyEdit(input, value.slice(0, start) + value.slice(end), start);
        }
        notify(onChange, input);
        break;

      default:
        break;
    }
  });

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const value = input.value;
    applyEdit(input, value.slice(0, start) + text + value.slice(end), start + text.length);
    notify(onChange, input);
  });
}

function applyEdit(input, nextValue, cursor) {
  input.value = nextValue;
  input.setSelectionRange(cursor, cursor);
}

function notify(onChange, input) {
  onChange?.(input.value);
}

export function getTextValue(input) {
  return input.value;
}
