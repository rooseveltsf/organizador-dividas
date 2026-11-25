import React from 'react';
import { css, cva, cx, type RecipeVariantProps } from '@/styled-system/css';

const inputRecipe = cva({
  base: {
    display: 'block',
    width: '100%',
    minWidth: 0,
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    backgroundColor: 'bgCard',
    color: 'slate.900',
    outline: 'none',
    transition: 'background-color 150ms, border-color 150ms, color 150ms',
    _placeholder: {
      color: 'slate.500',
    },
    _disabled: {
      backgroundColor: 'slate.50',
      color: 'slate.400',
      cursor: 'not-allowed',
    },
    _focus: {
      ring: '2px',
      ringOffset: '1px',
    },
  },
  variants: {
    hasError: {
      true: {
        borderColor: 'expense.500',
        ringColor: 'expense.400',
        _focus: {
          borderColor: 'expense.600',
          ringColor: 'expense.400',
        },
      },
      false: {
        borderColor: 'fieldBorder',
        _hover: {
          borderColor: 'slate.500',
        },
        _focus: {
          borderColor: 'brand.primary',
          ringColor: 'brand.primary',
        },
      },
    },
    size: {
      sm: {
        height: '8',
        px: '2.5',
        fontSize: 'xs',
      },
      md: {
        height: '10',
        px: '3.5',
        fontSize: 'sm',
      },
      lg: {
        height: '12',
        px: '4',
        fontSize: 'md',
      },
      pin: {
        height: '12',
        px: '0',
        fontSize: 'xl',
        fontWeight: 'semibold',
        textAlign: 'center',
        '&::-ms-reveal': { display: 'none' },
      },
    },
  },
  defaultVariants: {
    hasError: false,
    size: 'md',
  },
});

export type InputVariants = RecipeVariantProps<typeof inputRecipe>;

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> &
  InputVariants & {
    errorMessage?: string;
    hint?: string;
    label?: string;
  };

const inputContainerStyle = css({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
});

const inputLabelStyle = css({
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'slate.700',
});

const inputErrorMessageStyle = css({
  fontSize: 'xs',
  color: 'expense.700',
  fontWeight: 'medium',
});

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, size, errorMessage, hint, label, id,
    'aria-describedby': describedBy, 'aria-invalid': invalid, ...props }, ref) => {
    const isError = Boolean(hasError || errorMessage || (invalid && invalid !== 'false'));
    const autoId = React.useId();
    const inputId = id || autoId;
    const descriptions = [describedBy, hint && `${inputId}-hint`, errorMessage && `${inputId}-error`]
      .filter(Boolean).join(' ') || undefined;

    return (
      <div className={inputContainerStyle}>
        {label && (
          <label htmlFor={inputId} className={inputLabelStyle}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cx(inputRecipe({ hasError: isError, size }), className)}
          aria-invalid={hasError || errorMessage ? true : invalid}
          aria-describedby={descriptions}
          {...props}
        />
        {hint && <p id={`${inputId}-hint`} className="field-hint">{hint}</p>}
        {errorMessage && (
          <span id={`${inputId}-error`} className={inputErrorMessageStyle}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

