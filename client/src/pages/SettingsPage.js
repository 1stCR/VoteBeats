import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Save, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../config/api';

export default function SettingsPage() {
  const { currentUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSaveProfile(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateProfile(displayName.trim());
      if (updateUser) {
        updateUser({ ...currentUser, displayName: updated.displayName });
      }
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {currentUser?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          DJ Settings
        </h1>

        {/* Profile Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            Profile
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your DJ name"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Email cannot be changed.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Account Info Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-500" />
            Account Information
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Account ID</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{currentUser?.id}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <span className="text-slate-700 dark:text-slate-300">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 dark:text-slate-400">Display Name</span>
              <span className="text-slate-700 dark:text-slate-300">{currentUser?.displayName}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
