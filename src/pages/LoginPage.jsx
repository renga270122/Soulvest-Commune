import React, { useState } from "react";

import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { useAuthContext } from "../components/auth-context";
import ChatbotWidget from "../components/ChatbotWidget";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { getDemoAccountList, loginDemoUser, quickDemoAccess, requestDemoPasswordReset } from "../services/demoAuth";

import phoneIcon from "../assets/phone.svg";
import lockIcon from "../assets/lock.svg";
import googleIcon from "../assets/google-icon.svg";

const roles = [
  { value: "resident", labelKey: "roles.resident", icon: "🏠" },
  { value: "guard", labelKey: "roles.guard", icon: "💂" },
  { value: "admin", labelKey: "roles.admin", icon: "⚙️" },
];

const getQuickAccessLabel = (selectedRole, loading, t) => {
  if (loading) return t("auth.connectingGoogle");
  if (selectedRole === 'resident') return 'Quick resident access + AI concierge';
  if (selectedRole === 'guard') return 'Quick guard access';
  if (selectedRole === 'admin') return 'Quick admin access';
  return 'Quick demo access';
};

function PalaceIllustration() {
  return (
    <svg viewBox="0 0 720 520" className={styles.palaceArt} role="img" aria-label="Modern apartment community illustration">
      <defs>
        <linearGradient id="apartmentSky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6dca6" />
          <stop offset="42%" stopColor="#f2a36f" />
          <stop offset="100%" stopColor="#7f2e40" />
        </linearGradient>
        <linearGradient id="towerCream" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff6df" />
          <stop offset="100%" stopColor="#d8b57a" />
        </linearGradient>
        <linearGradient id="glassBlue" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#d7ecff" />
          <stop offset="100%" stopColor="#7ca7cf" />
        </linearGradient>
        <linearGradient id="gardenGreen" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#91c483" />
          <stop offset="100%" stopColor="#356a49" />
        </linearGradient>
      </defs>
      <rect width="720" height="520" fill="url(#apartmentSky)" rx="28" />
      <circle cx="574" cy="102" r="40" fill="#ffe08a" opacity="0.88" />
      <path d="M0 282 L110 230 L205 266 L320 216 L424 262 L548 206 L720 278 L720 520 L0 520 Z" fill="#723347" opacity="0.26" />
      <path d="M0 318 L132 264 L230 304 L332 250 L452 306 L582 244 L720 320 L720 520 L0 520 Z" fill="#5d2638" opacity="0.38" />
      <rect x="0" y="380" width="720" height="140" fill="url(#gardenGreen)" />
      <rect x="0" y="356" width="720" height="34" fill="#c8a56f" opacity="0.92" />
      <path d="M0 373 C92 360 146 360 236 373 C318 385 394 384 485 370 C563 358 637 357 720 371" fill="none" stroke="#e8d0aa" strokeWidth="6" strokeLinecap="round" opacity="0.78" />

      <g stroke="#8a5b34" strokeWidth="3.5">
        <rect x="120" y="186" width="132" height="170" rx="10" fill="url(#towerCream)" />
        <rect x="264" y="126" width="184" height="230" rx="12" fill="url(#towerCream)" />
        <rect x="468" y="164" width="132" height="192" rx="10" fill="url(#towerCream)" />
      </g>

      <g fill="#c89557">
        <rect x="168" y="168" width="36" height="18" rx="4" />
        <rect x="338" y="102" width="36" height="24" rx="5" />
        <rect x="516" y="146" width="36" height="18" rx="4" />
      </g>

      <g fill="url(#glassBlue)">
        {Array.from({ length: 4 }).map((_, row) => (
          Array.from({ length: 3 }).map((__, col) => (
            <rect key={`left-window-${row}-${col}`} x={138 + col * 34} y={206 + row * 34} width="20" height="22" rx="4" />
          ))
        ))}
        {Array.from({ length: 5 }).map((_, row) => (
          Array.from({ length: 4 }).map((__, col) => (
            <rect key={`center-window-${row}-${col}`} x={286 + col * 38} y={144 + row * 34} width="22" height="22" rx="4" />
          ))
        ))}
        {Array.from({ length: 4 }).map((_, row) => (
          Array.from({ length: 3 }).map((__, col) => (
            <rect key={`right-window-${row}-${col}`} x={486 + col * 34} y={184 + row * 34} width="20" height="22" rx="4" />
          ))
        ))}
      </g>

      <g fill="#7a4a28">
        <rect x="177" y="306" width="20" height="50" rx="5" />
        <rect x="346" y="296" width="24" height="60" rx="6" />
        <rect x="525" y="314" width="20" height="42" rx="5" />
      </g>

      <g>
        <rect x="304" y="346" width="104" height="22" rx="11" fill="#7a8c54" opacity="0.95" />
        <circle cx="292" cy="352" r="20" fill="#4f7d51" />
        <circle cx="420" cy="352" r="20" fill="#4f7d51" />
        <circle cx="104" cy="370" r="22" fill="#4f7d51" />
        <circle cx="618" cy="370" r="22" fill="#4f7d51" />
        <rect x="100" y="370" width="8" height="20" rx="4" fill="#6b4228" />
        <rect x="614" y="370" width="8" height="20" rx="4" fill="#6b4228" />
        <rect x="288" y="352" width="8" height="18" rx="4" fill="#6b4228" />
        <rect x="416" y="352" width="8" height="18" rx="4" fill="#6b4228" />
      </g>

      <g fill="#f5ede1" opacity="0.84">
        <rect x="146" y="392" width="84" height="10" rx="5" />
        <rect x="318" y="392" width="84" height="10" rx="5" />
        <rect x="490" y="392" width="84" height="10" rx="5" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();
  const demoAccounts = getDemoAccountList();
  const [activeTab, setActiveTab] = useState("signin");
  const [selectedRole, setSelectedRole] = useState("resident");
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showMobileConcierge, setShowMobileConcierge] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthContext();

  const redirectForRole = (role) => {
    if (role === "admin") return "/admin";
    if (role === "guard") return "/guard";
    if (role === "resident") return "/resident";
    return "/dashboard";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const sessionUser = await loginDemoUser({
        identifier: emailOrMobile,
        password,
        role: selectedRole,
      });
      login(sessionUser);
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate(redirectForRole(sessionUser.role)), 600);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);

    try {
      const sessionUser = await quickDemoAccess(selectedRole);
      login(sessionUser);
      setSuccess("Demo quick access enabled. Redirecting...");
      setTimeout(() => navigate(redirectForRole(sessionUser.role)), 600);
    } catch (err) {
      setError(err.message || "Unable to complete demo quick access.");
    }

    setGoogleLoading(false);
  };

  // Forgot Password
  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
    setResetSent(false);
    if (!emailOrMobile) {
      setError("Please enter your email or mobile number above first.");
      return;
    }
    try {
      const message = await requestDemoPasswordReset(emailOrMobile);
      setSuccess(message);
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResendReset = async () => {
    setError("");
    setSuccess("");
    setResendDisabled(true);
    try {
      const message = await requestDemoPasswordReset(emailOrMobile);
      setSuccess(message);
    } catch (err) {
      setError(err.message);
    }
    setTimeout(() => setResendDisabled(false), 30000); // 30 seconds cooldown
  };

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === "register") {
      navigate("/signup");
    }
  };

  return (
    <div className={styles.landingBg}>
      <div className={styles.aurora} />
      <div className={styles.pageShell}>
        <section className={styles.heroColumn}>
          <p className={styles.greeting}>{`ನಮಸ್ಕಾರ · ${t("landing.greeting")}`}</p>
          <h1 className={styles.heroTitle}>{t("landing.heroTitle")}</h1>
          <p className={styles.heroCopy}>
            {t("landing.heroCopy")}
          </p>

          <PalaceIllustration />
        </section>

        <section className={styles.loginColumn}>
          <div className={styles.loginCard}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.value}
                  type="button"
                  className={styles.tabButton}
                  onClick={() => i18n.changeLanguage(language.value)}
                >
                  {language.label}
                </button>
              ))}
            </div>
            <div className={styles.tabRow}>
              <button
                type="button"
                className={activeTab === "signin" ? styles.activeTab : styles.tabButton}
                onClick={() => handleTabChange("signin")}
              >
                {t("auth.signIn")}
              </button>
              <button
                type="button"
                className={styles.tabButton}
                onClick={() => handleTabChange("register")}
              >
                {t("auth.registerSociety")}
              </button>
            </div>

            <div className={styles.cardIntro}>
              <span className={styles.kicker}>{t("auth.royalAccess")}</span>
              <h2>{t("auth.enterCommune")}</h2>
              <p>{t("auth.loginDescription")}</p>
            </div>

            <div className={styles.successBanner} style={{ marginBottom: 16 }}>
              Demo mode is active. Use any account below with password demo123.
            </div>

            <button
              type="button"
              className={styles.aiDemoCard}
              onClick={() => {
                setSelectedRole('resident');
                setEmailOrMobile('resident@soulvest.demo');
                setPassword('demo123');
                setError('');
                setSuccess('Resident demo with AI concierge loaded.');
                setShowMobileConcierge(true);
              }}
            >
              <span className={styles.aiDemoBadge}>Resident + AI</span>
              <strong>Open the resident demo with AI Concierge</strong>
              <span>The chatbot lives inside the resident dashboard on mobile, above the bottom navigation.</span>
            </button>

            <div className={styles.mobileConciergeBlock}>
              <div className={styles.mobileConciergeIntro}>
                <span className={styles.mobileConciergeEyebrow}>Mobile preview</span>
                <strong>Try the AI concierge before quick demo access</strong>
                <p>Built for mobile users. Ask about dues, complaints, bookings, or staff attendance right here.</p>
              </div>
              <div className={styles.mobileConciergeActions}>
                <button
                  type="button"
                  className={styles.mobileConciergeButton}
                  onClick={() => {
                    setSelectedRole('resident');
                    setShowMobileConcierge((current) => !current);
                    setError('');
                  }}
                >
                  {showMobileConcierge ? 'Hide AI preview' : 'Preview AI on mobile'}
                </button>
                <button
                  type="button"
                  className={styles.mobileResidentButton}
                  onClick={() => {
                    setSelectedRole('resident');
                    setEmailOrMobile('resident@soulvest.demo');
                    setPassword('demo123');
                    setError('');
                    setSuccess('Resident demo credentials loaded with AI concierge.');
                  }}
                >
                  Load resident demo
                </button>
              </div>

              {showMobileConcierge && (
                <div className={styles.mobileConciergePanel}>
                  <ChatbotWidget
                    variant="embedded"
                    title="AI Concierge Preview"
                    onClose={() => setShowMobileConcierge(false)}
                  />
                </div>
              )}
            </div>

            <div className={styles.featureGrid} style={{ marginBottom: 20 }}>
              {demoAccounts.map((account) => (
                <button
                  key={account.email || account.mobile}
                  type="button"
                  className={styles.featureCard}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedRole(account.role);
                    setEmailOrMobile(account.email || account.mobile);
                    setPassword(account.password);
                    setError("");
                    setSuccess(`${account.role} demo credentials loaded.`);
                  }}
                >
                  <span className={styles.featureBadge}>{account.role}</span>
                  <h3 style={{ marginBottom: 6 }}>{account.name}</h3>
                  {account.role === 'resident' && <p style={{ marginBottom: 4 }}>Includes AI concierge access</p>}
                  <p style={{ marginBottom: 4 }}>{account.email || account.mobile}</p>
                  <p>Password: {account.password}</p>
                </button>
              ))}
            </div>

            <div className={styles.roleSelector}>
              {roles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  className={selectedRole === role.value ? styles.roleOptionActive : styles.roleOption}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <span>{role.icon}</span>
                  <span>{t(role.labelKey)}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleLogin} className={styles.formStack}>
              {error && <div className={styles.errorBanner}>{error}</div>}
              {success && <div className={styles.successBanner}>{success}</div>}

              <div>
                <label className={styles.label}>{t("auth.mobileEmail")}</label>
                <div className={styles.inputGroup}>
                  <img src={phoneIcon} alt="Phone" className={styles.inputIcon} />
                  <input
                    type="text"
                    value={emailOrMobile}
                    onChange={(e) => setEmailOrMobile(e.target.value)}
                    placeholder={t("auth.mobileEmailPlaceholder")}
                    className={styles.inputField}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={styles.label}>{t("auth.password")}</label>
                <div className={styles.inputGroup}>
                  <img src={lockIcon} alt="Lock" className={styles.inputIcon} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    className={styles.inputField}
                    required
                  />
                </div>
              </div>

              <div className={styles.forgot}>
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={handleForgotPassword}
                  disabled={resendDisabled}
                >
                  {t("auth.forgotPassword")}
                </button>
                {resetSent && (
                  <button
                    type="button"
                    className={styles.forgotLink}
                    onClick={handleResendReset}
                    disabled={resendDisabled}
                  >
                    {t("auth.resendResetMail")}
                  </button>
                )}
              </div>

              <button type="submit" className={styles.loginBtn}>
                {t("auth.enterCommune")}
              </button>

              <div className={styles.divider}><span>{t("auth.orContinueWith")}</span></div>

              <button type="button" className={styles.googleBtn} onClick={handleGoogleSignIn} disabled={googleLoading}>
                <img src={googleIcon} alt="Google" height={20} />
                {getQuickAccessLabel(selectedRole, googleLoading, t)}
              </button>

              {selectedRole === 'resident' && (
                <div className={styles.quickAccessHint}>
                  AI Concierge is available in the resident mobile dashboard as a floating assistant bubble.
                </div>
              )}
            </form>
          </div>
        </section>
      </div>
      <footer className={styles.publicFooter}>
        {`© ${currentYear} Soulvest Commune. All rights reserved.`}
      </footer>
    </div>
  );
}
