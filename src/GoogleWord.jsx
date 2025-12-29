import {AnimatePresence, motion} from 'framer-motion'

function GoogleWord({text, onDone}) {
  const letters = Array.from(text)

  return (
    <div className="block max-w-full">
      <motion.h1
        className="text-3xl sm:text-5xl font-semibold tracking-tight text-slate-900 whitespace-normal break-all"
        initial="hidden"
        animate="show"
        variants={{hidden: {}, show: {transition: {staggerChildren: 0.06}}}}
        onAnimationComplete={onDone}
      >
        {letters.map((ch,
                      i) => (
          <motion.span
            key={i}
            className="inline-block"
            variants={{
              hidden: {opacity: 0, y: 10, filter: 'blur(6px)'},
              show: {opacity: 1, y: 0, filter: 'blur(0px)', transition: {duration: 0.22}},
            }}
          >
            {ch ===
            ' ' ?
              '\u00A0' :
              ch}
          </motion.span>
        ))}
      </motion.h1>

      <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full w-full"
          initial={{x: '-100%'}}
          animate={{x: '0%'}}
          transition={{delay: 0.25, duration: 0.6, ease: 'easeOut'}}
          style={{
            background:
              'linear-gradient(90deg, #1a73e8 0%, #1a73e8 25%, #ea4335 25%, #ea4335 50%, #fbbc05 50%, #fbbc05 75%, #34a853 75%, #34a853 100%)',
          }}
        />
      </div>
    </div>
  )
}

export default GoogleWord