import React from 'react';
import { css, cva, cx, type RecipeVariantProps } from '@/styled-system/css';

const selectRecipe = cva({
  base: {
    display: 'block',
    width: '100%',
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    backgroundColor: 'white',
    color: 'slate.900',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    transition: 'all 0.2s ease-in-out',
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
        pl: '2.5',
        pr: '8',
        fontSize: 'xs',
      },
      md: {
        height: '10',
        pl: '3.5',
        pr: '10',
        fontSize: 'sm',
      },
      lg: {
        height: '12',
        pl: '4',
        pr: '12',
        fontSize: 'md',
      },
    },
  },
  defaultVariants: {
    hasError: false,
    size: 'md',
  },
});

export type SelectVariants = RecipeVariantProps<typeof selectRecipe>;

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> &
  SelectVariants & {
    errorMessage?: string;
    label?: string;
    children?: React.ReactNode;
  };

const selectContainerStyle = css({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
});

const selectLabelStyle = css({
  fontSize: 'sm',
  fontWeight: 'medium',
  color: 'slate.700',
});

const selectWrapperStyle = css({
  position: 'relative',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
});

const chevronIconStyle = css({
  position: 'absolute',
  right: '3',
  pointerEvents: 'none',
  color: 'slate.400',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const selectErrorMessageStyle = css({
  fontSize: 'xs',
  color: 'expense.500',
  fontWeight: 'medium',
});

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, size, errorMessage, label, id, children, disabled, ...props }, ref) => {
    const isError = Boolean(hasError || errorMessage);
    const autoId = React.useId();
    const selectId = id || autoId;

    return (
      <div className={selectContainerStyle}>
        {label && (
          <label htmlFor={selectId} className={selectLabelStyle}>
            {label}
          </label>
        )}
        <div className={selectWrapperStyle}>
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cx(selectRecipe({ hasError: isError, size }), className)}
            aria-invalid={isError ? true : undefined}
            aria-errormessage={isError && errorMessage ? `${selectId}-error` : undefined}
            {...props}
          >
            {children}
          </select>
          <div className={chevronIconStyle} aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        {errorMessage && (
          <span id={`${selectId}-error`} role="alert" className={selectErrorMessageStyle}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
