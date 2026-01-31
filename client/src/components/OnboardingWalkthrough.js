import React, { useState, useEffect, useCallback } from 'react';
import {
  Music, Calendar, Share2, ListMusic, Settings, ChevronRight,
  ChevronLeft, X, Sparkles, QrCode, ThumbsUp, Shield, Check
} from 'lucide-react';

const ONBOARDING_KEY = 'votebeats_onboarding_completed';

/**
 * Check if the DJ has completed onboarding
 */
export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

/**
 * Mark onboarding as completed
 */
export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, 'true');
}

/**
 * Reset onboarding so it can be replayed
 */
export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    iconColor: 'from-primary-500 to-accent-500',
    title: 'Welcome to VoteBeats!',
    subtitle: 'Your interactive DJ song request platform',
    description: 'VoteBeats lets your dance attendees request and vote on songs in real-time. You stay in full control of the queue while giving your audience a voice.',
    highlights: [
      { icon: Music, text: 'Attendees search and request songs from millions of tracks' },
      { icon: ThumbsUp, text: 'Real-time voting lets the crowd pick favorites' },
      { icon: Shield, text: 'Built-in content filtering keeps events family-friendly' },
      { icon: ListMusic, text: 'You approve, reject, and reorder the queue your way' },
    ],
  },
  {
    id: 'create-event',
    icon: Calendar,
    iconColor: 'from-blue-500 to-cyan-500',
    title: 'Step 1: Create Your First Event',
    subtitle: 'Set up your dance in seconds',
    description: 'Click "Create Event" on your dashboard to get started. Give your event a name and location, then customize settings like content filtering, request limits, and voting rules.',
    highlights: [
      { icon: Calendar, text: 'Set event name, date, and location' },
      { icon: Shield, text: 'Enable explicit content blocking and profanity filters' },
      { icon: Settings, text: 'Configure request limits, voting, and queue visibility' },
      { icon: Check, text: 'Save settings as templates for future events' },
    ],
  },
  {
    id: 'share-event',
    icon: Share2,
    iconColor: 'from-green-500 to-emerald-500',
    title: 'Step 2: Share With Attendees',
    subtitle: 'Get your audience connected',
    description: 'Each event gets a unique link and QR code. Share it before or during your event so attendees can start requesting and voting on songs from their phones.',
    highlights: [
      { icon: QrCode, text: 'Display the QR code on a screen at your venue' },
      { icon: Share2, text: 'Share the event link via text, email, or social media' },
      { icon: Music, text: 'Attendees can request songs before the event even starts' },
      { icon: ThumbsUp, text: 'Voting helps you see which songs the crowd wants most' },
    ],
  },
  {
    id: 'manage-queue',
    icon: ListMusic,
    iconColor: 'from-purple-500 to-pink-500',
    title: 'Step 3: Manage Your Queue',
    subtitle: 'Full control during the event',
    description: 'The DJ management page is your command center. Approve or reject requests, drag to reorder, mark songs as Now Playing, and send messages to your audience.',
    highlights: [
      { icon: Check, text: 'Approve or reject incoming song requests' },
      { icon: ListMusic, text: 'Drag and drop to reorder the queue' },
      { icon: Music, text: 'Mark songs as "Now Playing" to update attendees in real-time' },
      { icon: ThumbsUp, text: 'See vote counts to gauge crowd favorites' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    iconColor: 'from-orange-500 to-amber-500',
    title: 'Step 4: Customize Your Settings',
    subtitle: 'Make VoteBeats work your way',
    description: 'Head to DJ Settings to configure your default preferences, connect Spotify for playlist export, set up two-factor authentication, and customize notification preferences.',
    highlights: [
      { icon: Shield, text: 'Set default content filtering for all new events' },
      { icon: Music, text: 'Connect Spotify to export playlists and track prep' },
      { icon: Settings, text: 'Configure notification preferences and sound alerts' },
      { icon: Check, text: 'Save time with reusable event templates' },
    ],
  },
];

export default function OnboardingWalkthrough({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const StepIcon = step.icon;

  const handleFinish = useCallback(() => {
    markOnboardingComplete();
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    markOnboardingComplete();
    if (onSkip) onSkip();
  }, [onSkip]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleFinish();
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 200);
  }, [isLastStep, handleFinish]);

  const handlePrev = useCallback(() => {
    if (isFirstStep) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 200);
  }, [isFirstStep]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleSkip]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-onboarding-overlay>
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
        {/* Header with icon */}
        <div className={`bg-gradient-to-r ${step.iconColor} p-6 pb-8 relative`}>
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Skip tutorial"
            data-skip-tutorial
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <StepIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{step.title}</h2>
              <p className="text-sm text-white/80 mt-0.5">{step.subtitle}</p>
            </div>
          </div>

          {/* Step indicator dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setIsAnimating(true); setTimeout(() => { setCurrentStep(idx); setIsAnimating(false); }, 200); }}
                className={`transition-all duration-300 rounded-full ${
                  idx === currentStep
                    ? 'w-8 h-2 bg-white'
                    : idx < currentStep
                    ? 'w-2 h-2 bg-white/70'
                    : 'w-2 h-2 bg-white/40'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
            {step.description}
          </p>

          {/* Highlights */}
          <div className="space-y-3 mb-6">
            {step.highlights.map((highlight, idx) => {
              const HIcon = highlight.icon;
              return (
                <div key={idx} className="flex items-start gap-3 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <HIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{highlight.text}</span>
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={handleSkip}
                className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors px-2 py-2.5"
                data-skip-tutorial-bottom
              >
                Skip Tutorial
              </button>
            </div>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium rounded-lg hover:from-primary-600 hover:to-accent-600 transition-all shadow-md shadow-primary-500/25 text-sm"
              data-next-step
            >
              {isLastStep ? "Let's Get Started!" : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
