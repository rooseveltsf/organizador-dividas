import React from 'react';
import { css, cva, cx, type RecipeVariantProps } from '@/styled-system/css';

const inputRecipe = cva({
  base: {
    display: 'block',
    width: '100%',
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    backgroundColor: 'white',
    color: 'slate.900',
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    _placeholder: {
      color: 'slate.400',
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
        borderColor: 'slate.200',
        _hover: {
          borderColor: 'slate.300',
        },
        _focus: {
          borderColor: 'brand.primary',
          ringColor: 'brand.primarySoft',
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
  color: 'expense.500',
  fontWeight: 'medium',
});

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, size, errorMessage, label, id, ...props }, ref) => {
    const isError = Boolean(hasError || errorMessage);
    const autoId = React.useId();
    const inputId = id || autoId;

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
          aria-invalid={isError ? true : undefined}
          aria-errormessage={isError && errorMessage ? `${inputId}-error` : undefined}
          {...props}
        />
        {errorMessage && (
          <span id={`${inputId}-error`} role="alert" className={inputErrorMessageStyle}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

