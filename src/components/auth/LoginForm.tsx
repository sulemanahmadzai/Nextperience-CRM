import { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';

type ViewMode = 'signin' | 'signup' | 'reset';

export function LoginForm() {
  const { signIn } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignIn = async () => {
    const { error: signInError, data } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, has_all_access, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!userData) {
        setError('User not found in system. Please contact your administrator.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (!userData.is_active) {
        setError('Your account is inactive. Please contact your administrator.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const { data: companyAccess } = await supabase
        .from('user_company_roles')
        .select('id')
        .eq('user_id', userData.id)
        .eq('is_active', true)
        .limit(1);

      if (!userData.has_all_access && (!companyAccess || companyAccess.length === 0)) {
        setError('No company access. Please contact your administrator.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess('Account created successfully! Please contact your administrator to get access to business units.');
    setLoading(false);
  };

  const handleResetPassword = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess('Password reset instructions have been sent to your email.');
    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (viewMode === 'signin') {
      await handleSignIn();
    } else if (viewMode === 'signup') {
      await handleSignUp();
    } else if (viewMode === 'reset') {
      await handleResetPassword();
    }
  };

  const getIcon = () => {
    if (viewMode === 'signup') return <UserPlus className="w-8 h-8 text-white" />;
    if (viewMode === 'reset') return <KeyRound className="w-8 h-8 text-white" />;
    return <LogIn className="w-8 h-8 text-white" />;
  };

  const getTitle = () => {
    if (viewMode === 'signup') return 'Create Account';
    if (viewMode === 'reset') return 'Reset Password';
    return 'Sign in to your CRM account';
  };

  const getButtonText = () => {
    if (loading) {
      if (viewMode === 'signup') return 'Creating Account...';
      if (viewMode === 'reset') return 'Sending Reset Link...';
      return 'Signing in...';
    }
    if (viewMode === 'signup') return 'Sign Up';
    if (viewMode === 'reset') return 'Send Reset Link';
    return 'Sign In';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-xl rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-xl mb-4">
              {getIcon()}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">The Nextperience Group</h1>
            <p className="text-slate-600 mt-2">{getTitle()}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {viewMode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name (Optional)
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="you@company.com"
                required
              />
            </div>

            {viewMode !== 'reset' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {viewMode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {getButtonText()}
            </button>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
              {viewMode === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('reset');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Forgot your password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('signup');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Don't have an account? Sign up
                  </button>
                </>
              )}

              {(viewMode === 'signup' || viewMode === 'reset') && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('signin');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
