import React from 'react';
import { DatabaseZap, BrainCircuit, LineChart, Timer, MessageSquare, LogIn, Download } from 'lucide-react';
import { motion, useMotionValue, useMotionTemplate } from 'motion/react';
import { useAuth } from '../../services/AuthContext';
import { usePublicSettingsCtx } from '../../context/AppContext';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export function AuthView() {
  const { signInWithGoogle } = useAuth();
  const { telegramLink, telegramText } = usePublicSettingsCtx();
  const { isInstallable, installApp } = usePwaInstall();

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-slate-50/50 dark:bg-[#0f172a]/50">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] text-center max-w-6xl mx-auto px-4 lg:-mt-4 relative z-10">
      <div className="relative mb-6">
        <motion.div 
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-blue-400 dark:bg-blue-500 rounded-full blur-xl neon-icon-blur"
        />
        <div className="relative w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner z-10 neon-icon-container">
          <DatabaseZap className="w-8 h-8" />
        </div>
      </div>
      <h2 className="text-center text-[21px] min-[330px]:text-[24px] min-[370px]:text-[27px] min-[400px]:text-[30px] sm:text-4xl md:text-5xl font-extrabold tracking-tighter mb-4 whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 p-[5px]">
        Track your Mocks Intelligently
      </h2>
      <p className="text-[10px] min-[330px]:text-[11px] min-[370px]:text-xs min-[400px]:text-sm sm:text-base md:text-lg text-slate-500 dark:text-slate-400 font-bold mb-4 max-w-2xl leading-relaxed whitespace-nowrap overflow-x-hidden">
        Upload scorecards • AI extraction • track your Progress
      </p>

      <div className="w-full max-w-xl mx-auto px-2 sm:px-4 py-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 mb-10 shadow-sm ">
        <div className="text-[8px] min-[320px]:text-[8.5px] min-[340px]:text-[9px] min-[360px]:text-[10px] min-[400px]:text-[11px] sm:text-sm md:text-base text-indigo-700 dark:text-indigo-400 font-medium flex flex-col items-center gap-1.5 w-full max-w-full">
          <p className="whitespace-nowrap w-full text-center">✨ For the best experience, use larger screen</p>
          <p className="whitespace-nowrap w-full text-center">✨ click on 3-dot menu and select "Install app" for quick access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left w-full">
        <FeatureCard 
          title="AI Scorecard Extraction"
          description="Just upload a screenshot of your result. Our AI instantly parses and logs all scores."
          icon={BrainCircuit}
          color="indigo"
          spotlightColor="rgba(99, 102, 241, 0.15)"
          delay={0.1}
        />
        <FeatureCard 
          title="Deep Trend Analytics"
          description="Track your performance over time with beautiful charts and hit rates."
          icon={LineChart}
          color="emerald"
          spotlightColor="rgba(16, 185, 129, 0.15)"
          delay={0.2}
        />
        <FeatureCard 
          title="Challenges & Countdowns"
          description="Join daily task challenges to build streaks and track upcoming live exams visually."
          icon={Timer}
          color="rose"
          spotlightColor="rgba(244, 63, 94, 0.15)"
          delay={0.3}
        />
        <FeatureCard 
          title="Community Chat"
          description="Engage with aspirants, view leaderboards, share insights, and prep together."
          icon={MessageSquare}
          color="amber"
          spotlightColor="rgba(245, 158, 11, 0.15)"
          delay={0.4}
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={signInWithGoogle}
          className="relative overflow-hidden inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-white transition-all bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/40"
        >
          <motion.div
            className="absolute inset-y-0 w-[150%] bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
            animate={{ left: ["-150%", "150%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          />
          <div className="z-10 flex items-center justify-center bg-white p-1 rounded-full mr-3 border shadow-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>
          <span className="z-10 font-semibold tracking-wide">Sign In with Google</span>
        </button>

        {isInstallable && (
          <button
            onClick={installApp}
            className="inline-flex items-center justify-center px-6 py-2 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-all font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            Install as Desktop/Mobile App
          </button>
        )}

          <a
            href={telegramLink || '#'}
            target={telegramLink ? "_blank" : undefined}
            rel={telegramLink ? "noopener noreferrer" : undefined}
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg transition-colors mt-2 neon-telegram-btn"
            onClick={(e) => {
              if (!telegramLink) {
                e.preventDefault();
                alert('Telegram link is not configured yet. Set it in the Admin Settings.');
              }
            }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {telegramText}
          </a>
      </div>
    </div>
    </>
  );
}

function FeatureCard({ title, description, icon: Icon, color, delay, spotlightColor }: { title: string, description: string, icon: any, color: string, delay: number, spotlightColor: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const colors = {
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/30',
      text: 'text-indigo-600 dark:text-indigo-400',
      tint: 'from-indigo-500/5'
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      tint: 'from-emerald-500/5'
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-900/30',
      text: 'text-rose-600 dark:text-rose-400',
      tint: 'from-rose-500/5'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      tint: 'from-amber-500/5'
    }
  }[color as 'indigo' | 'emerald' | 'rose' | 'amber'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, delay }}
      onMouseMove={handleMouseMove}
      className="group relative p-4 bg-white/70 dark:bg-slate-800/70  border border-slate-200/50 dark:border-slate-700/50 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-0 overflow-hidden text-left"
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              300px circle at ${mouseX}px ${mouseY}px,
              ${spotlightColor},
              transparent 80%
            )
          `,
        }}
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${colors.tint} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className={`relative w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center mb-3 ${colors.text} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
        <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
      </div>
      <h3 className="relative font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm md:text-base">{title}</h3>
      <p className="relative text-xs md:text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </motion.div>
  );
}
