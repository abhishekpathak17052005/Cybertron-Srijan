import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

type AuthProps = {
  mode: AuthMode;
  onNavigate?: (path: string) => void;
  onLogin?: (user: { name: string; email: string }) => void;
};

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Auth({ mode, onNavigate, onLogin }: AuthProps) {
  const isLogin = mode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
      return;
    }
    goTo(path);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    const displayName = "User";
    const email = "user@example.com";
    const userProfile = { name: displayName, email };
    if (onLogin) {
      onLogin(userProfile);
      return;
    }
    handleNavigate("/workspace");
  };

  return (
    <main className="auth-shell">
      <div className="auth-atmosphere auth-atmosphere-one" />
      <div className="auth-atmosphere auth-atmosphere-two" />
      <nav className="auth-nav">
        <button className="public-brand" onClick={() => handleNavigate("/")}>
          <span className="public-brand-mark"><ShieldCheck size={17} /></span>
          <span><strong>LegalLens</strong><small>Contract intelligence</small></span>
        </button>
        <button className="auth-back" onClick={() => handleNavigate("/")}><ArrowLeft size={14} /> Back to home</button>
      </nav>

      <section className="auth-layout">
        <div className="auth-message">
          <div className="public-eyebrow"><span /> PRIVATE BY DESIGN</div>
          <h1>{isLogin ? "Welcome back to clearer decisions." : "Build your private contract desk."}</h1>
          <p>{isLogin ? "Pick up where you left off. Your workspace is waiting with the clauses that need your attention." : "Start with one agreement. Leave with a map of what matters, what it costs, and what happens next."}</p>
          <div className="auth-quote"><span>“</span><p>The fastest way to feel in control of a contract is to see the chain reaction before it starts.</p></div>
        </div>

        <Card className="auth-card">
          <CardHeader className="auth-card-header">
            <div className="auth-project-name">LEGAL<span>LENS</span></div>
            <span className="auth-card-kicker">{isLogin ? "RETURNING WORKSPACE" : "NEW WORKSPACE"}</span>
            <CardTitle>{isLogin ? "Sign in to LegalLens" : "Create your LegalLens account"}</CardTitle>
            <CardDescription>{isLogin ? "Your contract intelligence, in one focused place." : "No credit card. No permanent document trail."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="auth-form" onSubmit={handleSubmit}>
              {!isLogin && <label>Email address<span><Input type="email" placeholder="you@company.com" required /></span></label>}
              {isLogin && <label>Email address<span><Input type="email" placeholder="you@company.com" required /></span></label>}
              <label>Password<span className="password-field"><Input type={showPassword ? "text" : "password"} placeholder={isLogin ? "Enter your password" : "Create a password"} minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
              {isLogin && <div className="auth-options"><label className="check-label"><input type="checkbox" /> <span>Keep me signed in</span></label><button type="button" className="auth-link">Forgot password?</button></div>}
              <Button type="submit" className="auth-submit">{isLogin ? "Enter workspace" : "Create private workspace"} <ArrowRight size={16} /></Button>
              {submitted && <p className="auth-status" role="status">Demo access enabled. Opening your workspace is ready for the connected auth service.</p>}
            </form>
            <div className="auth-divider"><span>or continue with</span></div>
            <Button variant="outline" className="auth-provider" onClick={() => setSubmitted(true)}><span className="provider-mark">G</span> Continue with Google</Button>
            <p className="auth-switch">{isLogin ? "New to LegalLens?" : "Already have an account?"} <button onClick={() => handleNavigate(isLogin ? "/register" : "/login")}>{isLogin ? "Create an account" : "Sign in"}</button></p>
            <p className="auth-legal">By continuing, you agree to the LegalLens terms and privacy promise.</p>
          </CardContent>
        </Card>
      </section>
      <footer className="public-footer auth-footer"><span><LockKeyhole size={13} /> Your documents are session-scoped</span><span>LegalLens / Private intelligence layer</span></footer>
    </main>
  );
}
