import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface NarrativeProps {
  text: string;
  isLoading?: boolean;
}

export default function Narrative({ text, isLoading }: NarrativeProps) {
  return (
    <div className="min-h-[80px] flex items-center justify-center px-6 py-4 bg-white/5 rounded-xl border border-white/10 italic text-center">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-2"
          >
            <span className="w-2 h-2 bg-gold rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gold rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 bg-gold rounded-full animate-bounce [animation-delay:0.4s]" />
          </motion.div>
        ) : (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-gray-300 font-serif"
          >
            <ReactMarkdown>{text}</ReactMarkdown>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
