import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ArrowLeft, Plus, ChevronUp, Lightbulb, Rocket, CheckCircle, Clock, X, Sun, Moon, Filter, Sparkles, ArrowUpDown, Loader2 } from 'lucide-react';
import api from '../config/api';

const STATUS_CONFIG = {
  under_consideration: { label: 'Under Consideration', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  planned: { label: 'Planned', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Lightbulb },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: Rocket },
  shipped: { label: 'Shipped', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle },
};

export default function RoadmapPage() {
  const { currentUser } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('votes');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (sortBy === 'newest') params.sort = 'newest';
      const data = await api.getRoadmap(params);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load roadmap:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, sortBy]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const newRequest = await api.createFeatureRequest({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setRequests(prev => [newRequest, ...prev]);
      setTitle('');
      setDescription('');
      setShowForm(false);
      setSuccessMessage('Feature request submitted successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to submit feature request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(requestId) {
    if (!currentUser) return;
    try {
      const result = await api.voteFeatureRequest(requestId);
      setRequests(prev => prev.map(r => {
        if (r.id === requestId) {
          return { ...r, voteCount: result.voteCount, hasVoted: result.voted };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  }

  async function handleStatusChange(requestId, newStatus) {
    try {
      await api.updateFeatureRequestStatus(requestId, newStatus);
      setRequests(prev => prev.map(r => {
        if (r.id === requestId) {
          return { ...r, status: newStatus };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleDelete(requestId) {
    if (!window.confirm('Are you sure you want to delete this feature request?')) return;
    try {
      await api.deleteFeatureRequest(requestId);
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const shippedRequests = requests.filter(r => r.status === 'shipped');
  const activeRequests = requests.filter(r => r.status !== 'shipped');
  const displayRequests = filterStatus === 'shipped' ? shippedRequests : (filterStatus ? requests : activeRequests);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Feature Roadmap
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Vote on features you want in VoteBeats</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {currentUser ? (
              <Link to="/dashboard" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">Dashboard</Link>
            ) : (
              <Link to="/login" className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">DJ Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8" id="main-content">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        {/* Submit Feature Request */}
        {currentUser ? (
          <div className="mb-8">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full p-4 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 transition-colors flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                data-new-request-btn
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Submit a Feature Request</span>
              </button>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6" data-feature-request-form>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Feature Request</h2>
                  <button onClick={() => { setShowForm(false); setError(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="feature-title">Title *</label>
                    <input
                      id="feature-title"
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g., Add Spotify playlist import"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      maxLength={200}
                      required
                      aria-label="Feature request title"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="feature-desc">Description (optional)</label>
                    <textarea
                      id="feature-desc"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe your idea in more detail..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={3}
                      maxLength={2000}
                      aria-label="Feature request description"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                    <button
                      type="submit"
                      disabled={submitting || !title.trim()}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Submitting...</> : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 text-center">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              <Link to="/login" className="font-medium underline">Sign in as a DJ</Link> to submit feature requests and vote on ideas.
            </p>
          </div>
        )}

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500"
              aria-label="Filter by status"
            >
              <option value="">All Active</option>
              <option value="under_consideration">Under Consideration</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="shipped">Shipped</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500"
              aria-label="Sort by"
            >
              <option value="votes">Most Voted</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
            {displayRequests.length} request{displayRequests.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Feature Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading feature requests...</p>
          </div>
        ) : displayRequests.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No feature requests yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Be the first to suggest a feature!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayRequests.map(request => {
              const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.under_consideration;
              const StatusIcon = statusConfig.icon;
              const isAuthor = currentUser && currentUser.id === request.authorId;

              return (
                <div
                  key={request.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
                  data-feature-request
                >
                  <div className="flex gap-4">
                    {/* Vote Button */}
                    <div className="flex flex-col items-center min-w-[48px]">
                      <button
                        onClick={() => handleVote(request.id)}
                        disabled={!currentUser}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                          request.hasVoted
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-2 ring-purple-300 dark:ring-purple-700'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-500'
                        } ${!currentUser ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        aria-label={request.hasVoted ? 'Remove vote' : 'Upvote'}
                        title={!currentUser ? 'Sign in to vote' : (request.hasVoted ? 'Remove vote' : 'Upvote')}
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <span className={`text-sm font-bold mt-1 ${request.hasVoted ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {request.voteCount}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">{request.title}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      {request.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">{request.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <span>by {request.authorName}</span>
                        <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                        {isAuthor && (
                          <div className="flex items-center gap-2 ml-auto">
                            <select
                              value={request.status}
                              onChange={e => handleStatusChange(request.id, e.target.value)}
                              className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-0.5 text-xs"
                              aria-label="Update status"
                            >
                              <option value="under_consideration">Under Consideration</option>
                              <option value="planned">Planned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="shipped">Shipped</option>
                            </select>
                            <button
                              onClick={() => handleDelete(request.id)}
                              className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                              aria-label="Delete feature request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recently Shipped Section */}
        {!filterStatus && shippedRequests.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Recently Shipped
            </h2>
            <div className="space-y-2">
              {shippedRequests.slice(0, 5).map(request => (
                <div
                  key={request.id}
                  className="bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800/40 p-3 flex items-center gap-3"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{request.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{request.voteCount} votes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
        <p>&copy; 2025 VoteBeats. <Link to="/" className="hover:text-purple-500 transition-colors">Home</Link> &middot; <Link to="/roadmap" className="hover:text-purple-500 transition-colors">Roadmap</Link></p>
      </footer>
    </div>
  );
}
