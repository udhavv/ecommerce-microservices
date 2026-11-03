'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number; // Current value (0 - 5)
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showScore?: boolean;
  scoreClass?: string;
}

const SIZE_MAP = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-7 w-7',
};

export default function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  showScore = false,
  scoreClass = 'text-xs font-bold text-slate-700 ml-1.5',
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : rating;
  const starSize = SIZE_MAP[size];

  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: maxStars }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= Math.round(displayRating);

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange && onChange(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            className={`${
              interactive
                ? 'cursor-pointer transition-transform hover:scale-115 focus:outline-none p-0.5'
                : 'cursor-default'
            }`}
            aria-label={`${starValue} of ${maxStars} stars`}
          >
            <Star
              className={`${starSize} transition-colors ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-slate-100 text-slate-300'
              }`}
            />
          </button>
        );
      })}

      {showScore && (
        <span className={scoreClass}>
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  );
}
