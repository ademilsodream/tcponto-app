
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  type: 'dashboard' | 'table' | 'card' | 'list';
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type, count = 3 }) => {
  switch (type) {
    case 'dashboard':
      return (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="border rounded-lg p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            ))}
          </div>
          <div className="border rounded-lg p-6">
            <Skeleton className="h-6 w-1/3 mb-4" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/4" />
          <div className="border rounded-lg">
            <div className="p-4 border-b bg-gray-50">
              <div className="grid grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </div>
            </div>
            {[...Array(count)].map((_, i) => (
              <div key={i} className="p-4 border-b">
                <div className="grid grid-cols-5 gap-4">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton key={j} className="h-4" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'card':
      return (
        <div className="space-y-4">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="border rounded-lg p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="space-y-3">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return <Skeleton className="h-20 w-full" />;
  }
};
