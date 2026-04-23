"use client";

import { motion, AnimatePresence } from "framer-motion";

export function PhantomSignPending({ open, label }: { open: boolean; label: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="corner-box bg-paper-raised border border-ink px-8 py-6 min-w-[360px]"
          >
            <div className="caption mb-3">WAITING FOR SIGNATURE</div>
            <div className="font-display text-2xl uppercase tracking-wide">{label}</div>
            <div className="mt-4 font-mono text-xs text-muted flex items-center gap-2">
              <SpinDot /> Phantom popup open — approve in extension
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpinDot() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
      className="inline-block w-3 h-3 border border-ink border-t-accent rounded-full"
    />
  );
}
