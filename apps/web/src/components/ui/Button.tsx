import React from 'react';
import { cva, type RecipeVariantProps } from '@/styled-system/css';

const buttonRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    fontWeight: 'medium',
    borderRadius: 'lg',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    outline: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    _disabled: {
      opacity: '0.6',
      cursor: 'not-allowed',
      boxShadow: 'none',
    },
    _focusVisible: {
      ring: '2px',
      ringColor: 'brand.primary',
      ringOffset: '2px',
    },
  },
  variants: {
    variant: {
      primary: {
        bg: 'brand.primary',
        color: 'white',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        _hover: {
          bg: 'brand.primaryHover',
        },
        _active: {
          bg: 'brand.primaryHover',
        },
      },
      danger: {
        bg: 'expense.600',
        color: 'white',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        _hover: {
          bg: 'expense.700',
        },
        _active: {
          bg: 'expense.800',
        },
        _focusVisible: {
          ringColor: 'expense.500',
        },
      },
      ghost: {
        bg: 'transparent',
        color: 'slate.700',
        _hover: {
          bg: 'slate.100',
          color: 'slate.900',
        },
        _active: {
          bg: 'slate.200',
        },
      },
      outline: {
        bg: 'white',
        color: 'slate.700',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'slate.300',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        _hover: {
          bg: 'slate.50',
          borderColor: 'slate.400',
          color: 'slate.900',
        },
        _active: {
          bg: 'slate.100',
        },
      },
    },
    size: {
      sm: {
        fontSize: 'xs',
        px: '3',
        py: '1.5',
        height: '8',
      },
      md: {
        fontSize: 'sm',
        px: '4',
        py: '2',
        height: '10',
      },
      lg: {
        fontSize: 'md',
        px: '6',
        py: '2.5',
        height: '12',
      },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonVariants = RecipeVariantProps<typeof buttonRecipe>;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    children?: React.ReactNode;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, size, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${buttonRecipe({ variant, size })} ${className || ''}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
