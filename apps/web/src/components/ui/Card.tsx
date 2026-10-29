import React from 'react';
import { css, cva, cx, type RecipeVariantProps } from '@/styled-system/css';

const cardRecipe = cva({
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
        className={cx(cardRecipe({ variant, padding }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const cardHeaderStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
  marginBottom: '4',
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cx(cardHeaderStyle, className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

const cardTitleStyle = css({
  fontSize: 'lg',
  fontWeight: 'semibold',
  color: 'slate.900',
  lineHeight: '1.3',
  margin: '0',
});

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cx(cardTitleStyle, className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

const cardDescriptionStyle = css({
  fontSize: 'sm',
  color: 'slate.500',
  margin: '0',
});

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, className, ...props }, ref) => (
    <p
      ref={ref}
      className={cx(cardDescriptionStyle, className)}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = 'CardDescription';

const cardContentStyle = css({
  flex: '1',
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cx(cardContentStyle, className)} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

const cardFooterStyle = css({
  display: 'flex',
  alignItems: 'center',
  marginTop: '5',
  paddingTop: '3',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'slate.100',
});

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cx(cardFooterStyle, className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = 'CardFooter';

