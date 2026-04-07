import React, { useState } from "react";

import { auth, db } from "../firebase";
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import styles from "./LoginPage.module.css";
import { useAuthContext } from "../components/AuthContext";
import { useTranslation } from "react-i18next";
import { DEFAULT_CITY_ID } from "../config/cities";
import { DEFAULT_SOCIETY_ID } from "../config/firestore";

import phoneIcon from "../assets/phone.svg";
import lockIcon from "../assets/lock.svg";
import googleIcon from "../assets/google-icon.svg";

const buildSessionUser = (firebaseUser, profile, emailOrMobile) => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  mobile: profile?.mobile || (emailOrMobile.includes('@') ? '' : emailOrMobile.trim()),
  role: profile?.role || "resident",
  name: profile?.name || firebaseUser.displayName || "Resident",
  flat: profile?.flat || "",
  cityId: profile?.cityId || DEFAULT_CITY_ID,
  societyId: profile?.societyId || DEFAULT_SOCIETY_ID,
  language: profile?.language || 'en',
});

const roles = [
  { value: "resident", labelKey: "roles.resident", icon: "🏠" },
  { value: "guard", labelKey: "roles.guard", icon: "💂" },
  { value: "admin", labelKey: "roles.admin", icon: "⚙️" },
];

const featureCards = [
  { title: "Visitor OTP Passes", tag: "Live", text: "Residents pre-approve guests with OTP and QR passes before they reach the gate." },
  { title: "Guard PWA Flow", tag: "Realtime", text: "Guards verify visitors in seconds and log every entry directly into Firestore." },
  { title: "Resident Alerts", tag: "AI Ready", text: "Residents see live entry notifications and approval history on one screen." },
  { title: "Announcements", tag: "Admin", text: "Society notices travel from admin to residents without WhatsApp chaos." },
  { title: "Maintenance Dues", tag: "Finance", text: "Residents view dues, payment history, and upcoming fee cycles clearly." },
  { title: "Complaint Desk", tag: "Next", text: "Track service requests with statuses the whole committee can actually follow." },
  { title: "AI Concierge", tag: "Gemini", text: "Ask about dues, visitors, and complaint status from a single assistant." },
  { title: "Demo Dashboard", tag: "Boardroom", text: "Show committees a full-day story with residents, guards, admins, and AI in one demo." },
];

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
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState("signin");
  const [selectedRole, setSelectedRole] = useState("resident");
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
    let emailToUse = emailOrMobile;
    try {
      // If input is mobile, look up email in Firestore
      let userDoc = null;
      if (isMobile(emailOrMobile)) {
        const q = query(collection(db, "users"), where("mobile", "==", emailOrMobile.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("No user found with this mobile number");
        userDoc = snap.docs[0].data();
        emailToUse = userDoc.email;
      } else {
        // If input is email, fetch user by email for role
        const q = query(collection(db, "users"), where("email", "==", emailOrMobile.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) userDoc = snap.docs[0].data();
      }
      const credentials = await signInWithEmailAndPassword(auth, emailToUse, password);
      const role = userDoc?.role || "resident";
      if (selectedRole && selectedRole !== role) {
        throw new Error(`This account is registered as ${role}, not ${selectedRole}.`);
      }
      login(buildSessionUser(credentials.user, userDoc, emailOrMobile));
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate(redirectForRole(role)), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSuccess("");
    setGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const userRef = doc(db, "users", firebaseUser.uid);
      const profileSnapshot = await getDoc(userRef);

      let profile = profileSnapshot.exists() ? profileSnapshot.data() : null;

      if (!profile && selectedRole !== "resident") {
        throw new Error("Google sign-in is currently enabled for resident onboarding only. Use a registered account for guard or admin access.");
      }

      if (!profile) {
        profile = {
          name: firebaseUser.displayName || "Resident",
          email: firebaseUser.email || "",
          mobile: firebaseUser.phoneNumber || "",
          flat: "",
          role: "resident",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userRef, profile, { merge: true });
      } else {
        profile = {
          ...profile,
          email: profile.email || firebaseUser.email || "",
          name: profile.name || firebaseUser.displayName || "Resident",
          mobile: profile.mobile || firebaseUser.phoneNumber || "",
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userRef, profile, { merge: true });
      }

      const role = profile.role || "resident";
      if (selectedRole && selectedRole !== role) {
        throw new Error(`This Google account is registered as ${role}, not ${selectedRole}.`);
      }

      login(buildSessionUser(firebaseUser, profile, profile.email || firebaseUser.email || "google"));
      setSuccess("Google sign-in successful! Redirecting...");
      setTimeout(() => navigate(redirectForRole(role)), 1000);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Google sign-in was closed before completion.");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("This email already exists with a different sign-in method.");
      } else {
        setError(err.message || "Unable to complete Google sign-in.");
      }
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
    let emailToUse = emailOrMobile;
    try {
      if (isMobile(emailOrMobile)) {
        const q = query(collection(db, "users"), where("mobile", "==", emailOrMobile.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("No user found with this mobile number");
        emailToUse = snap.docs[0].data().email;
      }
      await sendPasswordResetEmail(auth, emailToUse);
      setSuccess("Password reset email sent. Please check your inbox (and spam folder). If you didn't receive it, you can resend below.");
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResendReset = async () => {
    setError("");
    setSuccess("");
    setResendDisabled(true);
    let emailToUse = emailOrMobile;
    try {
      if (isMobile(emailOrMobile)) {
        const q = query(collection(db, "users"), where("mobile", "==", emailOrMobile.trim()));
        const snap = await getDocs(q);
        if (snap.empty) throw new Error("No user found with this mobile number");
        emailToUse = snap.docs[0].data().email;
      }
      await sendPasswordResetEmail(auth, emailToUse);
      setSuccess("Password reset email resent. Please check your inbox (and spam folder).");
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

          <div className={styles.statsBar}>
            <div>
              <strong>50%</strong>
              <span>{t("landing.stats.cheaperOps")}</span>
            </div>
            <div>
              <strong>AI</strong>
              <span>{t("landing.stats.assistantLayer")}</span>
            </div>
            <div>
              <strong>5G</strong>
              <span>{t("landing.stats.realtimeUpdates")}</span>
            </div>
            <div>
              <strong>IoT</strong>
              <span>{t("landing.stats.readyForGates")}</span>
            </div>
          </div>

          <div className={styles.bannerCard}>
            <span className={styles.bannerEyebrow}>{t("landing.bannerEyebrow")}</span>
            <h2>{t("landing.bannerTitle")}</h2>
            <p>{t("landing.bannerCopy")}</p>
          </div>

          <PalaceIllustration />

          <section className={styles.featuresSection}>
            <div className={styles.sectionHeader}>
              <span>{t("landing.featureEstate")}</span>
              <h2>{t("landing.featureTitle")}</h2>
            </div>
            <div className={styles.featureGrid}>
              {featureCards.map((feature) => (
                <article key={feature.title} className={styles.featureCard}>
                  <span className={styles.featureBadge}>{feature.tag}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className={styles.footerLine}>
            {t("landing.footer", { year: currentYear })}
          </footer>
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
                {googleLoading ? t("auth.connectingGoogle") : t("auth.googleSignIn")}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
