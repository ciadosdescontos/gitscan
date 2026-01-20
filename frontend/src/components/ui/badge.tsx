import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border-2 border-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-foreground text-background',
        secondary:
          'bg-secondary text-foreground',
        destructive:
          'bg-brutal-red text-white',
        outline:
          'bg-background text-foreground',
        critical:
          'bg-brutal-red text-white',
        high:
          'bg-brutal-yellow text-foreground',
        medium:
          'bg-brutal-blue text-white',
        low:
          'bg-secondary text-foreground',
        info:
          'bg-background text-foreground',
        success:
          'bg-brutal-green text-white',
        warning:
          'bg-brutal-yellow text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
