import React from 'react';
import { cva, type RecipeVariantProps } from '@/styled-system/css';

export const cardRecipe = cva({
  base: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    borderRadius: '2xl',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'slate.200',
    transition: 'all 0.2s ease-in-out',
  },
  variants: {
    variant: {
      elevated: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        _hover: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
          borderColor: 'slate.300',
        },
      },
      outline: {
        boxShadow: 'none',
        _hover: {
          borderColor: 'slate.300',
        },
      },
      flat: {
        backgroundColor: 'slate.50',
        borderColor: 'transparent',
        boxShadow: 'none',
      },
    },
    padding: {
      none: {
        p: '0',
      },
      sm: {
        p: '3',
      },
      md: {
        p: '5',
      },
      lg: {
        p: '6',
      },
    },
  },
  defaultVariants: {
    variant: 'elevated',
    padding: 'md',
  },
});

export type CardVariants = RecipeVariantProps<typeof cardRecipe>;

export type CardProps = React.HTMLAttributes<HTMLDivElement> &
  CardVariants & {
    children?: React.ReactNode;
  };

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant, padding, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${cardRecipe({ variant, padding })} ${className || ''}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      marginBottom: '1rem',
    }}
    className={className}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className,
  ...props
}) => (
  <h3
    style={{
      fontSize: '1.125rem',
      fontWeight: 600,
      color: '#0f172a',
      lineHeight: 1.3,
      margin: 0,
    }}
    className={className}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className,
  ...props
}) => (
  <p
    style={{
      fontSize: '0.875rem',
      color: '#64748b',
      margin: 0,
    }}
    className={className}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div style={{ flex: 1 }} className={className} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      marginTop: '1.25rem',
      paddingTop: '0.75rem',
      borderTop: '1px solid #f1f5f9',
    }}
    className={className}
    {...props}
  >
    {children}
  </div>
);
