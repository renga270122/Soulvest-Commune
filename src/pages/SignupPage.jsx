import React, { useState } from "react";
import styles from "./LoginPage.module.css";
import topIllustration from "../assets/top-illustration.png";
import bottomIllustration from "../assets/bottom-illustration.png";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    flat: "",
    mobile: "",
    email: "",
    password: "",
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
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      // Update user profile with name
      await updateProfile(userCredential.user, {
        displayName: form.name,
      });
      // Store user info in Firestore for mobile lookup
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: form.name,
        flat: form.flat.trim().toUpperCase(),
        mobile: form.mobile,
        email: form.email,
        role: "resident",
        createdAt: new Date().toISOString(),
      });
      setSuccess("Signup successful! You can now log in.");
      setForm({ name: "", flat: "", mobile: "", email: "", password: "" });
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
