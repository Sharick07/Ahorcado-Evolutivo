import { motion } from 'motion/react';
import { COLORS } from '../types';

interface PowerBarProps {
  energy: number;
  onPower: (powerId: string) => void;
  disabled?: boolean;
}

export default function PowerBar({ energy, onPower, disabled }: PowerBarProps) {
  const powers = [
    { id: 'reveal', name: 'Revelar Letra', cost: 30, icon: '✨' },
    { id: 'hint', name: 'Pista IA', cost: 20, icon: '💭' }
  ];

  return (
    <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
      <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10">
        <div className="text-2xl">⚡</div>
        <div className="flex-1 h-4 bg-black/50 rounded-full overflow-hidden border border-white/10">
          <motion.div
            className="h-full bg-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(energy, 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="font-mono text-xl text-teal-400 w-12 text-right">{energy}</div>
      </div>

      <div className="flex gap-3 justify-center">
        {powers.map((p) => (
          <motion.button
            key={p.id}
            whileHover={energy >= p.cost && !disabled ? { scale: 1.05, backgroundColor: COLORS.teal } : {}}
            whileTap={energy >= p.cost && !disabled ? { scale: 0.95 } : {}}
            onClick={() => energy >= p.cost && !disabled && onPower(p.id)}
            disabled={energy < p.cost || disabled}
            className={`
              flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all
              ${energy >= p.cost ? 'bg-white/10 border-teal-500/50 text-white' : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'}
              ${disabled ? 'opacity-50' : ''}
            `}
          >
            <span className="text-xl mb-1">{p.icon}</span>
            <span className="text-xs font-bold uppercase tracking-wider">{p.name}</span>
            <span className="text-[10px] opacity-60 mt-1">{p.cost}⚡</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
