import { forwardRef, useId, useImperativeHandle, useRef, type KeyboardEvent } from 'react';
import { css } from '@/styled-system/css';
import { Input } from './Input';

type PinDigits = readonly [string, string, string, string];
export const emptyPin: PinDigits = ['', '', '', ''];

interface PinFieldProps {
  label: string;
  value: PinDigits;
  onValueChange: (value: PinDigits) => void;
  hint?: string;
  errorMessage?: string;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'data-initial-focus'?: boolean;
}

const legendStyle = css({ fontSize: 'sm', fontWeight: 'medium', color: 'slate.700', marginBottom: '1.5' });
const digitsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 3rem))',
  gap: '2.5',
  minWidth: '0',
});
const descriptionStyle = css({ marginTop: '1.5' });
const errorStyle = css({ fontSize: 'sm', color: 'expenseText', marginTop: '1.5' });
const digitPattern = /^[0-9]$/;

export const PinField = forwardRef<HTMLInputElement, PinFieldProps>(({
  label, value, onValueChange, hint, errorMessage, disabled,
  'aria-describedby': describedBy, 'aria-invalid': invalid, 'data-initial-focus': initialFocus,
}, ref) => {
  const id = useId();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  useImperativeHandle(ref, () => inputs.current[0]!, []);
  const last = value.length - 1;
  const descriptions = [hint && id + '-hint', errorMessage && id + '-error', describedBy].filter(Boolean).join(' ');

  function focusDigit(index: number) {
    inputs.current[Math.max(0, Math.min(index, last))]?.focus();
  }

  function writeDigits(start: number, digits: string) {
    const next: [...PinDigits] = [...value];
    next.splice(start, digits.length, ...digits);
    onValueChange(next);
    focusDigit(start + digits.length);
  }

  function clearDigit(index: number) {
    const next: [...PinDigits] = [...value];
    next[index] = '';
    onValueChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;

    if (digitPattern.test(event.key)) {
      event.preventDefault();
      writeDigits(index, event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      const target = value[index] ? index : Math.max(0, index - 1);
      clearDigit(target);
      focusDigit(target);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusDigit(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  }

  return (
    <fieldset className={css({ minWidth: '0' })} disabled={disabled}>
      <legend className={legendStyle}>{label}</legend>
      <div className={digitsStyle}>
        {value.map((digit, index) => (
          <Input key={index} size="pin" type="password" inputMode="numeric" autoComplete="off"
            required maxLength={1} pattern="[0-9]"
            aria-label={`Dígito ${index + 1} de ${value.length}`}
            aria-invalid={Boolean(invalid || errorMessage) || undefined}
            aria-describedby={descriptions || undefined}
            data-initial-focus={index === 0 && initialFocus ? true : undefined}
            ref={input => { inputs.current[index] = input; }} value={digit}
            onFocus={event => event.currentTarget.select()}
            onClick={event => event.currentTarget.select()}
            onKeyDown={event => handleKeyDown(event, index)}
            onInput={event => {
              const entered = event.currentTarget.value;
              if (digitPattern.test(entered)) writeDigits(index, entered);
              else if (!entered) clearDigit(index);
            }}
            onPaste={event => {
              event.preventDefault();
              const pasted = event.clipboardData.getData('text').replace(/[^0-9]/g, '');
              if (!pasted || pasted.length > value.length) return;
              const start = pasted.length === value.length ? 0 : index;
              writeDigits(start, pasted.slice(0, value.length - start));
            }} />
        ))}
      </div>
      {hint && <p id={id + '-hint'} className={`field-hint ${descriptionStyle}`}>{hint}</p>}
      {errorMessage && <p id={id + '-error'} className={errorStyle} role="alert">{errorMessage}</p>}
    </fieldset>
  );
});
PinField.displayName = 'PinField';
