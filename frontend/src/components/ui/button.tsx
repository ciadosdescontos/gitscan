'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-bold uppercase tracking-wider transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-2 border-foreground bg-foreground text-background shadow-brutal hover:bg-brutal-yellow hover:text-foreground hover:shadow-none hover:translate-x-1 hover:translate-y-1',
        destructive:
          'border-2 border-foreground bg-brutal-red text-white shadow-brutal hover:bg-red-600 hover:shadow-none hover:translate-x-1 hover:translate-y-1',
        outline:
          'border-2 border-foreground bg-background text-foreground shadow-brutal hover:bg-foreground hover:text-background hover:shadow-none hover:translate-x-1 hover:translate-y-1',
        secondary:
          'border-2 border-foreground bg-secondary text-foreground shadow-brutal hover:bg-foreground hover:text-background hover:shadow-none hover:translate-x-1 hover:translate-y-1',
        ghost:
          'border-2 border-transparent hover:border-foreground hover:bg-secondary',
        link:
          'text-foreground underline-offset-4 hover:underline font-bold',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-8 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
