

import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";

import topIllustration from "../assets/top-illustration.png";
import bottomIllustration from "../assets/bottom-illustration.png";
import logo from "../assets/logo.png";
import phoneIcon from "../assets/phone.svg";
import lockIcon from "../assets/lock.svg";
import googleIcon from "../assets/google-icon.svg";
import facebookIcon from "../assets/facebook-icon.svg";

export default function LoginPage() {
  const [emailOrMobile, setEmailOrMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      // Only email login is supported (mobile/email field)
      await signInWithEmailAndPassword(auth, emailOrMobile, password);
      setSuccess("Login successful! Redirecting...");
      setTimeout(() => navigate("/home"), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.landingBg}>
      {/* Top Illustration */}
      <img src={topIllustration} alt="Top" className={styles.illustration} />

      {/* Header with logo and title */}
      <div className={styles.header}>
        <div className={styles.title}>Welcome Back!</div>
        <div style={{ color: '#5a3a0a', fontSize: '1.1rem', marginTop: '0.3rem' }}>to Soulvest Commune</div>
      </div>

      {/* Login Card */}
      <form onSubmit={handleLogin} className={styles.loginCard}>
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
        <div className={styles.label}>Mobile Number / Email</div>
        <div className={styles.inputGroup}>
          <img src={phoneIcon} alt="Phone" className={styles.inputIcon} />
          <input
            type="text"
            value={emailOrMobile}
            onChange={(e) => setEmailOrMobile(e.target.value)}
            placeholder="Enter your mobile number or email"
            className={styles.inputField}
            required
          />
        </div>

        <div className={styles.label} style={{ marginTop: "0.5rem" }}>Password</div>
        <div className={styles.inputGroup}>
          <img src={lockIcon} alt="Lock" className={styles.inputIcon} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={styles.inputField}
            required
          />
        </div>

        <div className={styles.forgot}>
          <a href="#" className={styles.forgotLink}>
            Forgot Password?
          </a>
        </div>

        <button type="submit" className={styles.loginBtn}>
          Login
        </button>

        <div className={styles.or}>or</div>

        {/* Social Login Buttons */}
        <button type="button" className={`${styles.socialBtn} ${styles.googleBtn}`}> 
          <img src={googleIcon} alt="Google" height={20} />
          Continue with Google
        </button>
        <button type="button" className={`${styles.socialBtn} ${styles.facebookBtn}`}> 
          <img src={facebookIcon} alt="Facebook" height={20} />
          Continue with Facebook
        </button>

        <div className={styles.signup}>
          New to Soulvest Commune?
          <a href="/signup" className={styles.signupLink}>
            Sign Up
          </a>
        </div>
      </form>

      {/* Bottom Illustration */}
      <img src={bottomIllustration} alt="Bottom" className={styles.footerIllus} />
    </div>
  );
}
