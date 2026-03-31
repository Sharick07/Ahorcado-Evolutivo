import { motion } from 'motion/react';
import { COLORS, GameStatus } from '../types';

interface ScenarioProps {
  scenarioId: string;
  errors: number;
  maxErrors: number;
  revealedCount: number;
  totalLetters: number;
  status: GameStatus;
}

export default function Scenario({ scenarioId, errors, maxErrors, revealedCount, totalLetters, status }: ScenarioProps) {
  const errorRatio = errors / maxErrors;
  const progressRatio = revealedCount / totalLetters;
  const isPanic = errors === maxErrors - 1;

  // Dynamic values
  const skyOpacity = 1 - errorRatio * 0.8;
  const overlayOpacity = Math.min(errorRatio * 0.25, 0.25);
  const auraScale = 0.5 + progressRatio * 1.5;

  return (
    <div className="relative w-full aspect-video bg-[#0A0608] overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      <svg viewBox="0 0 800 450" className="w-full h-full">
        {/* Sky / Background */}
        <rect width="800" height="450" fill={`url(#skyGradient)`} />
        <defs>
          <radialGradient id="skyGradient" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#1a1a2e" stopOpacity={skyOpacity} />
            <stop offset="100%" stopColor="#0A0608" />
          </radialGradient>
        </defs>

        {/* Stars (fade with errors) */}
        {[...Array(50)].map((_, i) => (
          <circle
            key={i}
            cx={Math.random() * 800}
            cy={Math.random() * 250}
            r={Math.random() * 1.5}
            fill="white"
            opacity={(1 - errorRatio) * Math.random()}
          />
        ))}

        {/* Aura of Victory */}
        <motion.ellipse
          cx="400"
          cy="225"
          rx={150 * auraScale}
          ry={100 * auraScale}
          fill={COLORS.gold}
          initial={{ opacity: 0 }}
          animate={{ opacity: progressRatio * 0.3 }}
          style={{ filter: 'blur(40px)' }}
        />

        {/* Main Scenario: Dynamic Elements based on scenarioId */}
        <g transform="translate(400, 225)">
          {scenarioId === 'libertad' && (
            <>
              {/* Elephant Body */}
              <motion.path
                d="M-60,20 Q-80,-40 0,-60 Q80,-40 60,20 L40,60 L-40,60 Z"
                fill="#444"
                animate={{
                  scale: status === GameStatus.WON ? 1.1 : 1,
                  y: status === GameStatus.WON ? -20 : 0,
                  rotate: status === GameStatus.WON ? [0, -5, 5, 0] : 0
                }}
                transition={{ repeat: status === GameStatus.WON ? Infinity : 0, duration: 2 }}
              />
              {/* Cage Bars */}
              {[...Array(7)].map((_, i) => (
                <motion.line
                  key={i}
                  x1={-70 + i * 23}
                  y1="-80"
                  x2={-70 + i * 23}
                  y2="70"
                  stroke={COLORS.accent}
                  strokeWidth="4"
                  animate={{
                    opacity: status === GameStatus.WON ? 0 : 1,
                    x: status === GameStatus.WON ? (i < 3 ? -200 : 200) : 0,
                    rotate: status === GameStatus.WON ? (i < 3 ? -90 : 90) : 0
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              ))}
            </>
          )}

          {scenarioId !== 'libertad' && (
            <motion.g
              animate={{
                rotate: status === GameStatus.WON ? 360 : 0,
                scale: status === GameStatus.WON ? 1.5 : 1
              }}
              transition={{ duration: 10, repeat: status === GameStatus.WON ? Infinity : 0, ease: "linear" }}
            >
              <circle r="50" fill="none" stroke={COLORS.gold} strokeWidth="2" strokeDasharray="10 5" />
              <motion.path
                d="M-30,0 L30,0 M0,-30 L0,30"
                stroke={COLORS.gold}
                strokeWidth="4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </motion.g>
          )}
        </g>

        {/* Cracks (appear with errors) */}
        {[...Array(errors)].map((_, i) => (
          <motion.path
            key={i}
            d={`M${100 + i * 120},${50 + (i % 3) * 100} l20,30 l-10,20 l30,10`}
            stroke={COLORS.danger}
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            style={{ filter: 'drop-shadow(0 0 5px #C84A4A)' }}
          />
        ))}

        {/* Memory Fragments (appear with hits) */}
        {[...Array(revealedCount)].map((_, i) => (
          <motion.circle
            key={i}
            cx={150 + (i * 40) % 500}
            cy={350 - (i * 20) % 100}
            r="4"
            fill={COLORS.gold}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            style={{ filter: 'drop-shadow(0 0 8px #D4A843)' }}
          />
        ))}
      </svg>

      {/* Deterioration Overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{ backgroundColor: COLORS.danger, opacity: overlayOpacity }}
      />

      {/* Panic Mode Pulse */}
      {isPanic && (
        <motion.div
          className="absolute inset-0 border-4 border-red-600 pointer-events-none"
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}
    </div>
  );
}
