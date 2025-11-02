import { useState, FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { LogIn, UserPlus, KeyRound } from "lucide-react";

type ViewMode = "signin" | "signup" | "reset";

export function LoginForm() {
  const { signIn } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignIn = async () => {
    console.log("[LoginForm] ===== SIGN IN STARTED =====");
    console.log("[LoginForm] Email:", email);
    setLoading(true);
    setError("");

    const { error: signInError, data } = await signIn(email, password);

    console.log("[LoginForm] Sign in response:", {
      hasError: !!signInError,
      errorMessage: signInError?.message,
      hasUser: !!data?.user,
      userId: data?.user?.id,
      userEmail: data?.user?.email,
    });

    if (signInError) {
      console.error("[LoginForm] Sign in error:", signInError);
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      console.log("[LoginForm] User authenticated, checking user table...");
      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("id, email, has_all_access, is_active, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      console.log("[LoginForm] User table query result:", {
        userData,
        userDataError,
        hasError: !!userDataError,
        errorDetails: userDataError,
      });

      if (!userData) {
        console.error("[LoginForm] User not found in users table");
        setError(
          "User not found in system. Please contact your administrator."
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      console.log("[LoginForm] User data retrieved:", {
        id: userData.id,
        email: userData.email,
        hasAllAccess: userData.has_all_access,
        isActive: userData.is_active,
        fullName: userData.full_name,
      });

      if (!userData.is_active) {
        console.error("[LoginForm] User account is inactive");
        setError(
          "Your account is inactive. Please contact your administrator."
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      console.log(
        "[LoginForm] User is active, company access will be checked by CompanyContext"
      );
      console.log("[LoginForm] ===== SIGN IN COMPLETE =====");
      // Company access will be checked by CompanyContext and App.tsx
      // This prevents race conditions and flashing error messages
    }

    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!acceptedTerms) {
      setError(
        "You must accept the Terms of Service and Privacy Policy to create an account"
      );
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(
      "Account created successfully! Please contact your administrator to get access to business units."
    );
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (oauthError) {
      // Provide helpful error message for common OAuth setup issues
      let errorMessage = oauthError.message;

      if (
        oauthError.message.includes("provider is not enabled") ||
        oauthError.message.includes("Unsupported provider")
      ) {
        errorMessage =
          "Google Sign-In is not enabled. Please enable the Google provider in your Supabase Dashboard: Authentication → Providers → Google. See QUICK_FIX_GOOGLE_OAUTH.md for setup instructions.";
      }

      setError(errorMessage);
      setLoading(false);
    }
    // Note: On success, user will be redirected by Supabase
  };

  const handleResetPassword = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess("Password reset instructions have been sent to your email.");
    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (viewMode === "signin") {
      await handleSignIn();
    } else if (viewMode === "signup") {
      await handleSignUp();
    } else if (viewMode === "reset") {
      await handleResetPassword();
    }
  };

  const getIcon = () => {
    if (viewMode === "signup")
      return <UserPlus className="w-8 h-8 text-white" />;
    if (viewMode === "reset")
      return <KeyRound className="w-8 h-8 text-white" />;
    return <LogIn className="w-8 h-8 text-white" />;
  };

  const getTitle = () => {
    if (viewMode === "signup") return "Create Account";
    if (viewMode === "reset") return "Reset Password";
    return "Sign in to your CRM account";
  };

  const getButtonText = () => {
    if (loading) {
      if (viewMode === "signup") return "Creating Account...";
      if (viewMode === "reset") return "Sending Reset Link...";
      return "Signing in...";
    }
    if (viewMode === "signup") return "Sign Up";
    if (viewMode === "reset") return "Send Reset Link";
    return "Sign In";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-xl rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-xl mb-4">
              {getIcon()}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              The Nextperience Group
            </h1>
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

            {viewMode === "signup" && (
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
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
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
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

            {viewMode !== "reset" && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
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

            {viewMode === "signup" && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
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

            {viewMode === "signup" && (
              <div className="flex items-start">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 focus:ring-2"
                  required
                />
                <label htmlFor="terms" className="ml-2 text-sm text-slate-700">
                  I agree to the{" "}
                  <a
                    href="/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 underline hover:text-slate-700"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 underline hover:text-slate-700"
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {getButtonText()}
            </button>

            {(viewMode === "signin" || viewMode === "signup") && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">
                    Or continue with
                  </span>
                </div>
              </div>
            )}

            {(viewMode === "signin" || viewMode === "signup") && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-300 text-slate-900 py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {viewMode === "signin"
                  ? "Sign in with Google"
                  : "Sign up with Google"}
              </button>
            )}

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-200">
              {viewMode === "signin" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("reset");
                      setError("");
                      setSuccess("");
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Forgot your password?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("signup");
                      setError("");
                      setSuccess("");
                      setAcceptedTerms(false);
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Don't have an account? Sign up
                  </button>
                </>
              )}

              {(viewMode === "signup" || viewMode === "reset") && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("signin");
                    setError("");
                    setSuccess("");
                    setAcceptedTerms(false);
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
