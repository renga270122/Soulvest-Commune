import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./LoginPage.module.css";
import topIllustration from "../assets/top-illustration.png";
import bottomIllustration from "../assets/bottom-illustration.png";
import { SUPPORTED_LANGUAGES } from "../i18n";
import { useAuthContext } from "../components/auth-context";
import { registerDemoResident } from "../services/demoAuth";

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuthContext();
  const [form, setForm] = useState({
    name: "",
    flat: "",
    mobile: "",
    email: "",
    password: "",
    language: "en",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const sessionUser = await registerDemoResident(form);
      login(sessionUser);
      setSuccess("Demo signup successful! Redirecting to your resident dashboard.");
      setForm({ name: "", flat: "", mobile: "", email: "", password: "", language: "en" });
      setTimeout(() => navigate("/resident"), 600);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.landingBg}>
      <img src={topIllustration} alt="Top" className={styles.illustration} />
      <div className={styles.header}>
        <div className={styles.title}>Create Your Account</div>
        <div style={{ color: '#5a3a0a', fontSize: '1.1rem', marginTop: '0.3rem' }}>
          Join our resident-owned community platform
        </div>
      </div>
      <form onSubmit={handleSubmit} className={styles.loginCard}>
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
        <div style={{ color: '#5a3a0a', background: 'rgba(255, 248, 236, 0.88)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          Demo mode stores this account only in your browser for local walkthroughs.
        </div>
        <div className={styles.label}>Full Name</div>
        <div className={styles.inputGroup}>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your name"
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.label}>Mobile Number</div>
        <div className={styles.inputGroup}>
          <input
            type="text"
            name="mobile"
            value={form.mobile}
            onChange={handleChange}
            placeholder="Enter your mobile number"
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.label}>Flat Number</div>
        <div className={styles.inputGroup}>
          <input
            type="text"
            name="flat"
            value={form.flat}
            onChange={handleChange}
            placeholder="Enter your flat number"
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.label}>Email Address</div>
        <div className={styles.inputGroup}>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            className={styles.inputField}
            required
          />
        </div>
        <div className={styles.label}>Preferred Language</div>
        <div className={styles.inputGroup}>
          <select
            name="language"
            value={form.language}
            onChange={handleChange}
            className={styles.inputField}
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>{language.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.label}>Password</div>
        <div className={styles.inputGroup}>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            className={styles.inputField}
            required
          />
        </div>
        <button type="submit" className={styles.loginBtn}>
          Sign Up
        </button>
        <div className={styles.signup}>
          Already have an account?
          <a href="/login" className={styles.signupLink}>Login</a>
        </div>
      </form>
      <img src={bottomIllustration} alt="Bottom" className={styles.footerIllus} />
    </div>
  );
}
