import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Save, ArrowLeft, CheckCircle, Shield, ShieldCheck, ShieldOff, Lock, Eye, EyeOff, Bell, Volume2, Sliders, Music, Link2, Unlink2, ExternalLink, BookOpen, RotateCcw  } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../config/api';
import { resetOnboarding } from '../components/OnboardingWalkthrough';

export default function SettingsPage() {
  const { currentUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFASuccess, setTwoFASuccess] = useState('');
  const [disableMode, setDisableMode] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    newRequests: true,
    requestVotes: true,
    eventReminders: true,
    attendeeMessages: true,
    weeklyDigest: false,
    soundAlerts: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);

  // Default event settings state
  const [defaultEventSettings, setDefaultEventSettings] = useState({
    blockExplicit: false,
    votingEnabled: true,
    requestsOpen: true,
    maxRequestsPerUser: 0,
    autoApprove: false,
  });
  const [defEvtLoading, setDefEvtLoading] = useState(true);
  const [defEvtSaving, setDefEvtSaving] = useState(false);
  const [defEvtSuccess, setDefEvtSuccess] = useState('');
  const [defEvtError, setDefEvtError] = useState('');

  // Spotify connection state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyDisplayName, setSpotifyDisplayName] = useState('');
  const [spotifyEmail, setSpotifyEmail] = useState('');
  const [spotifyConnectedAt, setSpotifyConnectedAt] = useState('');
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [spotifyAction, setSpotifyAction] = useState(false);
  const [spotifyError, setSpotifyError] = useState('');
  const [spotifySuccess, setSpotifySuccess] = useState('');

  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState('');
  const [notifError, setNotifError] = useState('');

  // Tutorial replay state
  const [tutorialReset, setTutorialReset] = useState(false);


  // Load 2FA status on mount
  useEffect(() => {
    api.get2FAStatus()
      .then(data => {
        setTwoFAEnabled(data.enabled);
      })
      .catch(() => {
        // Ignore - might not be available
      })
      .finally(() => setTwoFALoading(false));
  }, []);


  // Load notification preferences on mount
  useEffect(() => {
    api.getNotificationPreferences()
      .then(data => {
        setNotifPrefs(data);
      })
      .catch(() => {
        // Ignore - use defaults
      })
      .finally(() => setNotifLoading(false));
  }, []);


  // Load default event settings on mount
  useEffect(() => {
    api.getDefaultEventSettings()
      .then(data => setDefaultEventSettings(data))
      .catch(() => {})
      .finally(() => setDefEvtLoading(false));
  }, []);

  // Load Spotify connection status on mount
  useEffect(() => {
    api.getSpotifyStatus()
      .then(data => {
        setSpotifyConnected(data.connected);
        setSpotifyDisplayName(data.displayName || '');
        setSpotifyEmail(data.email || '');
        setSpotifyConnectedAt(data.connectedAt || '');
      })
      .catch(() => {
        // Ignore - endpoint might not be available
      })
      .finally(() => setSpotifyLoading(false));
  }, []);

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

  async function handleSetup2FA() {
    setTwoFAError('');
    setTwoFASuccess('');
    setSetupMode(true);

    try {
      const data = await api.setup2FA();
      setQrCode(data.qrCode);
      setTotpSecret(data.secret);
    } catch (err) {
      setTwoFAError(err.message || 'Failed to start 2FA setup.');
      setSetupMode(false);
    }
  }

  async function handleVerify2FA(e) {
    e.preventDefault();
    setTwoFAError('');

    if (verifyCode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code.');
      return;
    }

    try {
      await api.verify2FA(verifyCode);
      setTwoFAEnabled(true);
      setSetupMode(false);
      setQrCode('');
      setTotpSecret('');
      setVerifyCode('');
      setTwoFASuccess('Two-factor authentication has been enabled!');
      setTimeout(() => setTwoFASuccess(''), 5000);
    } catch (err) {
      setTwoFAError(err.message || 'Invalid code. Please try again.');
    }
  }

  async function handleDisable2FA(e) {
    e.preventDefault();
    setTwoFAError('');

    if (!disablePassword) {
      setTwoFAError('Password is required to disable 2FA.');
      return;
    }

    try {
      await api.disable2FA(disablePassword);
      setTwoFAEnabled(false);
      setDisableMode(false);
      setDisablePassword('');
      setTwoFASuccess('Two-factor authentication has been disabled.');
      setTimeout(() => setTwoFASuccess(''), 5000);
    } catch (err) {
      setTwoFAError(err.message || 'Failed to disable 2FA.');
    }
  }

  function cancelSetup() {
    setSetupMode(false);
    setQrCode('');
    setTotpSecret('');
    setVerifyCode('');
    setTwoFAError('');
  }

  function cancelDisable() {
    setDisableMode(false);
    setDisablePassword('');
    setTwoFAError('');
  }



  async function handleSaveDefaultSettings() {
    setDefEvtError('');
    setDefEvtSuccess('');
    setDefEvtSaving(true);
    try {
      const updated = await api.updateDefaultEventSettings(defaultEventSettings);
      setDefaultEventSettings(updated);
      setDefEvtSuccess('Default event settings saved!');
      setTimeout(() => setDefEvtSuccess(''), 3000);
    } catch (err) {
      setDefEvtError(err.message || 'Failed to save default event settings.');
    } finally {
      setDefEvtSaving(false);
    }
  }

  function toggleDefaultSetting(key) {
    setDefaultEventSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSaveNotifications() {
    setNotifError('');
    setNotifSuccess('');
    setNotifSaving(true);
    try {
      const updated = await api.updateNotificationPreferences(notifPrefs);
      setNotifPrefs(updated);
      setNotifSuccess('Notification preferences saved!');
      setTimeout(() => setNotifSuccess(''), 3000);
    } catch (err) {
      setNotifError(err.message || 'Failed to save notification preferences.');
    } finally {
      setNotifSaving(false);
    }
  }

  function toggleNotifPref(key) {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleConnectSpotify() {
    setSpotifyError('');
    setSpotifySuccess('');
    setSpotifyAction(true);
    try {
      // Simulate Spotify OAuth - in production, would redirect to Spotify auth URL
      const djName = currentUser?.displayName || 'DJ';
      const data = await api.connectSpotify(djName + "'s Spotify", currentUser?.email);
      setSpotifyConnected(data.connected);
      setSpotifyDisplayName(data.displayName);
      setSpotifyEmail(data.email);
      setSpotifyConnectedAt(data.connectedAt);
      setSpotifySuccess('Spotify account connected successfully!');
      setTimeout(() => setSpotifySuccess(''), 5000);
    } catch (err) {
      setSpotifyError(err.message || 'Failed to connect Spotify account.');
    } finally {
      setSpotifyAction(false);
    }
  }

  async function handleDisconnectSpotify() {
    setSpotifyError('');
    setSpotifySuccess('');
    setSpotifyAction(true);
    try {
      await api.disconnectSpotify();
      setSpotifyConnected(false);
      setSpotifyDisplayName('');
      setSpotifyEmail('');
      setSpotifyConnectedAt('');
      setSpotifySuccess('Spotify account disconnected.');
      setTimeout(() => setSpotifySuccess(''), 5000);
    } catch (err) {
      setSpotifyError(err.message || 'Failed to disconnect Spotify account.');
    } finally {
      setSpotifyAction(false);
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
              className="flex items-center gap-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-primary-500 transition-colors"
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

        {/* Two-Factor Authentication Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            Two-Factor Authentication
          </h2>

          {twoFAError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {twoFAError}
            </div>
          )}

          {twoFASuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              {twoFASuccess}
            </div>
          )}

          {twoFALoading ? (
            <div className="text-slate-500 dark:text-slate-400 text-sm">Loading 2FA status...</div>
          ) : !setupMode && !disableMode ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                {twoFAEnabled ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-medium">2FA is enabled</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <ShieldOff className="w-5 h-5" />
                    <span className="font-medium">2FA is not enabled</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {twoFAEnabled
                  ? 'Your account is protected with two-factor authentication. You will need your authenticator app to log in.'
                  : 'Add an extra layer of security to your account by enabling two-factor authentication using an authenticator app like Google Authenticator or Authy.'}
              </p>
              {twoFAEnabled ? (
                <button
                  onClick={() => { setDisableMode(true); setTwoFAError(''); }}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <ShieldOff className="w-4 h-4" />
                  Disable 2FA
                </button>
              ) : (
                <button
                  onClick={handleSetup2FA}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-md text-sm font-medium flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Enable 2FA
                </button>
              )}
            </div>
          ) : setupMode ? (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              {qrCode && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>
              )}
              <div className="mb-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Can't scan? Enter this secret manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300 flex-1">
                    {showSecret ? totpSecret : '\u2022'.repeat(20)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Enter the 6-digit code from your app to verify:
                  </label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-center text-2xl tracking-widest font-mono"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={verifyCode.length !== 6}
                    className="px-6 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify & Enable
                  </button>
                  <button
                    type="button"
                    onClick={cancelSetup}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : disableMode ? (
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter your password to confirm disabling two-factor authentication:
              </p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!disablePassword}
                  className="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ShieldOff className="w-4 h-4" />
                  Disable 2FA
                </button>
                <button
                  type="button"
                  onClick={cancelDisable}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>



        {/* Default Event Settings Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary-500" />
            Default Event Settings
          </h2>

          {defEvtError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {defEvtError}
            </div>
          )}

          {defEvtSuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              {defEvtSuccess}
            </div>
          )}

          {defEvtLoading ? (
            <div className="text-slate-500 dark:text-slate-400 text-sm">Loading defaults...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                These settings will be pre-populated when you create a new event.
              </p>

              <div className="space-y-3">
                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Block Explicit Content</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Automatically reject songs flagged as explicit</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={defaultEventSettings.blockExplicit}
                    onClick={() => toggleDefaultSetting('blockExplicit')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${defaultEventSettings.blockExplicit ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${defaultEventSettings.blockExplicit ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Voting</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Allow attendees to vote on song requests</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={defaultEventSettings.votingEnabled}
                    onClick={() => toggleDefaultSetting('votingEnabled')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${defaultEventSettings.votingEnabled ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${defaultEventSettings.votingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Open for Requests</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Allow attendees to submit song requests immediately</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={defaultEventSettings.requestsOpen}
                    onClick={() => toggleDefaultSetting('requestsOpen')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${defaultEventSettings.requestsOpen ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${defaultEventSettings.requestsOpen ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto-Approve Requests</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Automatically approve all incoming song requests</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={defaultEventSettings.autoApprove}
                    onClick={() => toggleDefaultSetting('autoApprove')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${defaultEventSettings.autoApprove ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${defaultEventSettings.autoApprove ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <div className="py-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max Requests Per User</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">0 = unlimited requests per attendee</p>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={defaultEventSettings.maxRequestsPerUser}
                    onChange={(e) => setDefaultEventSettings(prev => ({ ...prev, maxRequestsPerUser: parseInt(e.target.value) || 0 }))}
                    className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleSaveDefaultSettings}
                  disabled={defEvtSaving}
                  className="px-6 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {defEvtSaving ? 'Saving...' : 'Save Default Settings'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notification Preferences Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-500" />
            Notification Preferences
          </h2>

          {notifError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {notifError}
            </div>
          )}

          {notifSuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              {notifSuccess}
            </div>
          )}

          {notifLoading ? (
            <div className="text-slate-500 dark:text-slate-400 text-sm">Loading preferences...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Choose which notifications you'd like to receive during events.
              </p>

              <div className="space-y-3">
                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">New Song Requests</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Get notified when attendees submit new song requests</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.newRequests}
                    onClick={() => toggleNotifPref('newRequests')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.newRequests ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.newRequests ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vote Updates</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Get notified when songs receive new votes</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.requestVotes}
                    onClick={() => toggleNotifPref('requestVotes')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.requestVotes ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.requestVotes ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Event Reminders</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive reminders before your scheduled events</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.eventReminders}
                    onClick={() => toggleNotifPref('eventReminders')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.eventReminders ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.eventReminders ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Attendee Messages</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Get notified when attendees send messages with requests</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.attendeeMessages}
                    onClick={() => toggleNotifPref('attendeeMessages')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.attendeeMessages ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.attendeeMessages ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Weekly Digest</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receive a weekly summary of your events and activity</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.weeklyDigest}
                    onClick={() => toggleNotifPref('weeklyDigest')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.weeklyDigest ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.weeklyDigest ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sound Alerts</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Play sound when new notifications arrive</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifPrefs.soundAlerts}
                    onClick={() => toggleNotifPref('soundAlerts')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifPrefs.soundAlerts ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifPrefs.soundAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={notifSaving}
                  className="px-6 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl hover:from-primary-600 hover:to-accent-600 transition-all shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {notifSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}
        </div>


        {/* Spotify Integration Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-green-500" />
            Spotify Integration
          </h2>

          {spotifyError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {spotifyError}
            </div>
          )}

          {spotifySuccess && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              {spotifySuccess}
            </div>
          )}

          {spotifyLoading ? (
            <div className="text-slate-500 dark:text-slate-400 text-sm">Loading Spotify status...</div>
          ) : spotifyConnected ? (
            <div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-300">Connected to Spotify</p>
                    <p className="text-sm text-green-600 dark:text-green-400">{spotifyDisplayName}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Account</span>
                    <span className="text-slate-700 dark:text-slate-300">{spotifyEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Connected</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {spotifyConnectedAt ? new Date(spotifyConnectedAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Your Spotify account is linked. You can export playlists and use Spotify features in your events.
              </p>

              <div className="flex gap-3">
                <a
                  href="https://open.spotify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Spotify
                </a>
                <button
                  onClick={handleDisconnectSpotify}
                  disabled={spotifyAction}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Unlink2 className="w-4 h-4" />
                  {spotifyAction ? 'Disconnecting...' : 'Disconnect Spotify'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Connect your Spotify account to enable playlist export, one-click song lookup, and seamless integration with your DJ workflow.
              </p>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">With Spotify connected, you can:</h4>
                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Export your event queue as a Spotify playlist
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    One-click search for songs in Spotify
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Track prep status for each song
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    Download playlists for offline playback
                  </li>
                </ul>
              </div>
              <button
                onClick={handleConnectSpotify}
                disabled={spotifyAction}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Link2 className="w-5 h-5" />
                {spotifyAction ? 'Connecting...' : 'Connect Spotify Account'}
              </button>
            </div>
          )}
        </div>

        {/* Onboarding Tutorial Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            Getting Started Tutorial
          </h2>

          {tutorialReset && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" />
              Tutorial has been reset! You'll see the walkthrough next time you visit the dashboard.
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            The onboarding walkthrough guides you through setting up VoteBeats, creating events, sharing with attendees, and managing your queue.
          </p>

          <button
            type="button"
            onClick={() => {
              resetOnboarding();
              setTutorialReset(true);
              setTimeout(() => setTutorialReset(false), 5000);
            }}
            className="px-4 py-2.5 border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-sm font-medium flex items-center gap-2"
            data-replay-tutorial
          >
            <RotateCcw className="w-4 h-4" />
            Replay Tutorial
          </button>
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
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Display Name</span>
              <span className="text-slate-700 dark:text-slate-300">{currentUser?.displayName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Two-Factor Auth</span>
              <span className={twoFAEnabled ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                {twoFAEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 dark:text-slate-400">Spotify</span>
              <span className={spotifyConnected ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                {spotifyConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
