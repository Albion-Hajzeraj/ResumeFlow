'use client';

type LoadingSpinnerProps = {
  size?: number;
  className?: string;
};

export function LoadingSpinner({ size = 48, className }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-b-2 border-blue-600 ${className || ''}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}
