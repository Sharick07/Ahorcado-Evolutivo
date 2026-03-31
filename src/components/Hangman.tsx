import { motion } from 'motion/react';
import { COLORS } from '../types';

interface HangmanProps {
  errors: number;
}

export default function Hangman({ errors }: HangmanProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <svg viewBox="0 0 100 100" className="w-full h-full max-w-[200px]">
        {/* Gallows - Minimalist and subtle */}
        <motion.path
          d="M 20 90 L 80 90 M 35 90 L 35 10 L 70 10 L 70 20"
          fill="none"
          stroke={COLORS.gold}
          strokeWidth="1"
          opacity="0.2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5 }}
        />

        {/* Character Parts - Minimalist lines */}
        {/* 1: Head */}
        {errors >= 1 && (
          <motion.circle 
            cx="70" cy="30" r="10" 
            stroke={COLORS.accent} strokeWidth="2" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
        {/* 2: Body */}
        {errors >= 2 && (
          <motion.line 
            x1="70" y1="40" x2="70" y2="70" 
            stroke={COLORS.accent} strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
        {/* 3: Left Arm */}
        {errors >= 3 && (
          <motion.line 
            x1="70" y1="45" x2="50" y2="55" 
            stroke={COLORS.accent} strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
        {/* 4: Right Arm */}
        {errors >= 4 && (
          <motion.line 
            x1="70" y1="45" x2="90" y2="55" 
            stroke={COLORS.accent} strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
        {/* 5: Left Leg */}
        {errors >= 5 && (
          <motion.line 
            x1="70" y1="70" x2="55" y2="85" 
            stroke={COLORS.accent} strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
        {/* 6: Right Leg */}
        {errors >= 6 && (
          <motion.line 
            x1="70" y1="70" x2="85" y2="85" 
            stroke={COLORS.accent} strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Final collapse effect if lost */}
        {errors >= 6 && (
          <motion.circle
            cx="70" cy="30" r="15"
            fill={COLORS.danger}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1.2], opacity: [0, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ filter: 'blur(10px)' }}
          />
        )}
      </svg>
    </div>
  );
}
