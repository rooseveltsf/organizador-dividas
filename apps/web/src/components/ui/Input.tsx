import React from 'react';
import { cva, type RecipeVariantProps } from '@/styled-system/css';

export const inputRecipe = cva({
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
          borderColor: 'brand.500',
          ringColor: 'brand.500',
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

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, size, errorMessage, label, id, ...props }, ref) => {
    const isError = Boolean(hasError || errorMessage);

    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {label && (
          <label
            htmlFor={id}
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#334155',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`${inputRecipe({ hasError: isError, size })} ${className || ''}`.trim()}
          {...props}
        />
        {errorMessage && (
          <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
