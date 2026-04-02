

import React, { useState } from "react";

import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import styles from "./LoginPage.module.css";
import { useAuthContext } from "../components/AuthContext";

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
  const { login } = useAuthContext();

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
      await signInWithEmailAndPassword(auth, emailToUse, password);
      // Get user role for redirection
      const role = userDoc?.role || "user";
      login(emailOrMobile, role);
      setSuccess("Login successful! Redirecting...");
      // Redirect to role-based dashboard
      let redirectPath = "/dashboard";
      if (role === "admin") redirectPath = "/admin";
      else if (role === "guard") redirectPath = "/guard";
      else if (role === "resident") redirectPath = "/resident";
      setTimeout(() => navigate(redirectPath), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Forgot Password
  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
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
      setSuccess("Password reset email sent. Please check your inbox.");
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
          <button type="button" className={styles.forgotLink} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={handleForgotPassword}>
            Forgot Password?
          </button>
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
