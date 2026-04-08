import React, { useState } from "react";

import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import { useAuthContext } from "../components/AuthContext";
import ChatbotWidget from "../components/ChatbotWidget";
import { useTranslation } from "react-i18next";
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
    <svg viewBox="0 0 720 520" className={styles.palaceArt} role="img" aria-label="Royal palace illustration inspired by Vidhana Soudha">
      <defs>
        <linearGradient id="skyGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f5d98e" />
          <stop offset="45%" stopColor="#d97a52" />
          <stop offset="100%" stopColor="#5f1f2c" />
        </linearGradient>
        <linearGradient id="waterGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1a6874" />
          <stop offset="100%" stopColor="#0d3340" />
        </linearGradient>
        <linearGradient id="palaceGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff2cf" />
          <stop offset="100%" stopColor="#d4aa63" />
        </linearGradient>
      </defs>
      <rect width="720" height="520" fill="url(#skyGradient)" rx="28" />
      <circle cx="565" cy="112" r="44" fill="#ffd96b" opacity="0.85" />
      <path d="M0 250 L110 175 L205 246 L314 168 L430 244 L552 155 L720 250 L720 340 L0 340 Z" fill="#864150" opacity="0.35" />
      <path d="M0 290 L120 220 L225 280 L320 208 L420 283 L560 198 L720 292 L720 360 L0 360 Z" fill="#5e2c3b" opacity="0.5" />
      <rect x="0" y="360" width="720" height="160" fill="url(#waterGradient)" />
      <g opacity="0.16" transform="translate(0 362) scale(1 -1)">
        <rect x="136" y="140" width="448" height="128" fill="#fff3d9" rx="8" />
        <rect x="168" y="176" width="384" height="92" fill="#f4d8a8" />
        <rect x="198" y="216" width="324" height="52" fill="#e2c081" />
      </g>
      <g fill="url(#palaceGradient)" stroke="#8e5c24" strokeWidth="4">
        <rect x="136" y="206" width="448" height="126" rx="7" />
        <rect x="170" y="168" width="380" height="52" rx="5" />
        <rect x="207" y="132" width="306" height="50" rx="5" />
        <rect x="326" y="92" width="68" height="65" rx="8" />
        <path d="M360 56 C385 56 401 72 401 92 H319 C319 72 335 56 360 56 Z" />
        <path d="M344 56 L376 56 L371 34 L349 34 Z" fill="#d6a143" />
        <path d="M235 118 C255 118 269 131 269 149 H201 C201 131 215 118 235 118 Z" />
        <path d="M485 118 C505 118 519 131 519 149 H451 C451 131 465 118 485 118 Z" />
        <rect x="189" y="116" width="92" height="16" rx="4" fill="#e1b162" />
        <rect x="439" y="116" width="92" height="16" rx="4" fill="#e1b162" />
      </g>
      <g fill="#8d5b2a">
        {Array.from({ length: 14 }).map((_, index) => (
          <rect key={`col-${index}`} x={160 + index * 28} y={220} width="12" height="110" rx="4" />
        ))}
        <rect x="338" y="236" width="44" height="96" rx="14" fill="#71391f" />
      </g>
      <g fill="#fff0cb" opacity="0.8">
        {Array.from({ length: 10 }).map((_, index) => (
          <rect key={`window-${index}`} x={198 + index * 34} y={184} width="16" height="18" rx="4" />
        ))}
        {Array.from({ length: 8 }).map((_, index) => (
          <rect key={`window-lower-${index}`} x={214 + index * 36} y={248} width="18" height="26" rx="5" />
        ))}
      </g>
      <path d="M82 102 C96 93 105 95 118 106" stroke="#43232b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M108 96 C120 87 132 89 145 100" stroke="#43232b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M590 136 C604 128 613 129 624 140" stroke="#43232b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M616 130 C627 122 639 124 651 135" stroke="#43232b" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
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

  // Helper: check if input is mobile number (10+ digits)
  const isMobile = (input) => /^\d{10,}$/.test(input.trim());

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
              <button type="button" className={styles.tabButton} onClick={() => i18n.changeLanguage('en')}>EN</button>
              <button type="button" className={styles.tabButton} onClick={() => i18n.changeLanguage('kn')}>ಕನ್ನಡ</button>
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
    </div>
  );
}
