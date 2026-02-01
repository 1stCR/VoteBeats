import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Music, LogOut, Plus, Calendar, Users, BarChart3, Settings, Sun, Moon, AlertTriangle, RefreshCw, WifiOff, MessageSquare, Star, Send, Bug, Lightbulb, Heart, X, Map } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../config/api';
import { useToast } from '../components/Toast';
import OnboardingWalkthrough, { hasCompletedOnboarding } from '../components/OnboardingWalkthrough';

export default function DashboardPage() {
  const { currentUser, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [showFeedbackPanel, setShowFeedbackPanel] = useState(false);
  const [showDJFeedbackForm, setShowDJFeedbackForm] = useState(false);
  const [djFeedbackType, setDjFeedbackType] = useState('suggestion');
  const [djFeedbackMessage, setDjFeedbackMessage] = useState('');
  const [djFeedbackEmail, setDjFeedbackEmail] = useState('');
  const [djFeedbackSubmitting, setDjFeedbackSubmitting] = useState(false);
  const [djFeedbackSuccess, setDjFeedbackSuccess] = useState('');

  useEffect(() => {
    loadEvents();
    loadFeedback();
  }, []);

  // Show onboarding for first-time DJs after events have loaded
  useEffect(() => {
    if (!loading && !loadError && events.length === 0 && !hasCompletedOnboarding()) {
      setShowOnboarding(true);
    }
  }, [loading, loadError, events]);

  async function loadEvents() {
    setLoadError('');
    setLoading(true);
    try {
      const data = await api.getEvents();
      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
      setLoadError(
        err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Network')
          ? 'Unable to connect to the server. Please check your internet connection.'
          : 'Failed to load your events. Please try again.'
      );
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFeedback() {
    try {
      const [stats, feedback] = await Promise.all([
        api.getFeedbackStats(),
        api.getAllFeedback()
      ]);
      setFeedbackStats(stats);
      setRecentFeedback(Array.isArray(feedback) ? feedback.slice(0, 10) : []);
    } catch (err) {
      // Silently fail - feedback is supplementary
      console.error('Failed to load feedback:', err);
    }
  }

  async function handleDJFeedbackSubmit(e) {
    e.preventDefault();
    if (!djFeedbackMessage.trim()) return;
    setDjFeedbackSubmitting(true);
    try {
      // Use first event as context, or a special 'platform' feedback
      const targetEventId = events.length > 0 ? events[0].id : 'platform';
      await api.submitFeedback(targetEventId, {
        feedbackType: djFeedbackType,
        message: djFeedbackMessage.trim(),
        email: djFeedbackEmail.trim() || undefined,
        userId: currentUser?.id,
        userType: 'dj'
      });
      setDjFeedbackSuccess('Thank you! Your feedback has been submitted.');
      setDjFeedbackMessage('');
      setDjFeedbackEmail('');
      setShowDJFeedbackForm(false);
      setTimeout(() => setDjFeedbackSuccess(''), 5000);
    } catch (err) {
      toast.showError(err.isNetworkError
        ? 'Unable to connect. Please check your internet connection and try again.'
        : (err.message || 'Failed to submit feedback. Please try again.'));
    } finally {
      setDjFeedbackSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function handleOnboardingComplete() {
    setShowOnboarding(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Onboarding walkthrough for first-time DJs */}
      {showOnboarding && (
        <OnboardingWalkthrough
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}

      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">VoteBeats</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">DJ Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300 hidden sm:inline">
              Welcome, <span className="font-semibold">{currentUser?.displayName || 'DJ'}</span>
            </span>
            <Link
              to="/roadmap"
              className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Feature Roadmap"
              data-roadmap-link
            >
              <Map className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Roadmap</span>
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              data-theme-toggle
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{events.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Events</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-100 dark:bg-accent-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">0</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Requests</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">0</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Songs Played</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Your Events</h2>
            <Link
              to="/events/create"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium rounded-lg hover:from-primary-600 hover:to-accent-600 transition-all shadow-md shadow-primary-500/25 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-loading-skeleton>
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="text-center py-12" data-load-error>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                {loadError.includes('connect') || loadError.includes('internet') ? (
                  <WifiOff className="w-8 h-8 text-red-400" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {loadError.includes('connect') || loadError.includes('internet') ? 'Connection Problem' : 'Something went wrong'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                {loadError}
              </p>
              <button
                onClick={loadEvents}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                data-retry-button
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                <Calendar className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No events yet</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                Create your first event and start collecting song requests from your audience!
              </p>
              <Link
                to="/events/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-primary-500/25"
              >
                <Plus className="w-5 h-5" />
                Create Your First Event
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map(event => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{event.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {event.date && <span>{event.date}</span>}
                      {event.location && <span>{event.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/events/${event.id}/manage`}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feedback Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mt-8" data-feedback-section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Feedback</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Attendee reviews &amp; your suggestions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDJFeedbackForm(!showDJFeedbackForm)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                data-send-feedback-btn
              >
                <Send className="w-4 h-4" />
                Send Feedback
              </button>
              {recentFeedback.length > 0 && (
                <button
                  onClick={() => setShowFeedbackPanel(!showFeedbackPanel)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {showFeedbackPanel ? 'Hide' : 'View All'}
                </button>
              )}
            </div>
          </div>

          {/* DJ Feedback Success */}
          {djFeedbackSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              {djFeedbackSuccess}
            </div>
          )}

          {/* DJ Send Feedback Form */}
          {showDJFeedbackForm && (
            <div className="mb-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600" data-dj-feedback-form>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Send Feedback to VoteBeats</h3>
                <button onClick={() => setShowDJFeedbackForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleDJFeedbackSubmit}>
                <div className="flex gap-2 mb-3">
                  {[
                    { value: 'suggestion', label: 'Suggestion', icon: Lightbulb },
                    { value: 'bug', label: 'Bug Report', icon: Bug },
                    { value: 'praise', label: 'Praise', icon: Heart }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDjFeedbackType(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        djFeedbackType === opt.value
                          ? 'bg-purple-500 text-white'
                          : 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500 border border-slate-200 dark:border-slate-500'
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={djFeedbackMessage}
                  onChange={e => setDjFeedbackMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  aria-label="Feedback message"
                  maxLength={1000}
                  required
                />
                <input
                  type="email"
                  value={djFeedbackEmail}
                  onChange={e => setDjFeedbackEmail(e.target.value)}
                  placeholder="Your email (optional, for follow-up)"
                  className="w-full mt-2 p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  aria-label="Email address for follow-up"
                />
                <button
                  type="submit"
                  disabled={djFeedbackSubmitting || !djFeedbackMessage.trim()}
                  className="mt-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {djFeedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </div>
          )}

          {/* Feedback Stats Summary */}
          {feedbackStats && feedbackStats.total > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{feedbackStats.total}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Feedback</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                  {feedbackStats.avgRating || '—'}
                  <Star className="w-4 h-4 fill-yellow-400" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg Rating</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-500">{feedbackStats.praise}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Praise</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-500">{feedbackStats.suggestions}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Suggestions</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">No feedback yet from attendees.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Feedback will appear here once attendees rate your completed events.</p>
            </div>
          )}

          {/* Recent Feedback List */}
          {showFeedbackPanel && recentFeedback.length > 0 && (
            <div className="space-y-3 mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Feedback</h3>
              {recentFeedback.map(fb => (
                <div key={fb.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        fb.feedbackType === 'praise' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                        fb.feedbackType === 'suggestion' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {fb.feedbackType === 'praise' ? <Heart className="w-3 h-3" /> :
                         fb.feedbackType === 'suggestion' ? <Lightbulb className="w-3 h-3" /> :
                         <Bug className="w-3 h-3" />}
                        {fb.feedbackType}
                      </span>
                      {fb.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                          {[...Array(fb.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400" />
                          ))}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{fb.eventName || ''}</span>
                  </div>
                  {fb.message && (
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{fb.message}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {fb.userType === 'dj' ? 'DJ' : 'Attendee'} &middot; {new Date(fb.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
