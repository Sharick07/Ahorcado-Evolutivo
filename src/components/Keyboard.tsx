import { motion } from 'motion/react';
import { COLORS } from '../types';

interface KeyboardProps {
  onKey: (key: string) => void;
  guessed: string[];
  disabled?: boolean;
}

const KEYS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

export default function Keyboard({ onKey, guessed, disabled }: KeyboardProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
      {KEYS.map((key) => {
        const isGuessed = guessed.includes(key);
        return (
          <motion.button
            key={key}
            whileHover={!isGuessed && !disabled ? { scale: 1.1, backgroundColor: COLORS.accent } : {}}
            whileTap={!isGuessed && !disabled ? { scale: 0.9 } : {}}
            onClick={() => !isGuessed && !disabled && onKey(key)}
            disabled={isGuessed || disabled}
            className={`
              w-10 h-12 rounded-lg font-bold text-lg transition-colors
              ${isGuessed ? 'bg-white/10 text-white/20 cursor-not-allowed' : 'bg-white/5 text-white hover:text-black'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {key}
          </motion.button>
        );
      })}
    </div>
  );
}
