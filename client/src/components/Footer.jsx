import React from "react";
import "../styles/Footer.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-section footer-brand">
          <div className="footer-ornament"></div>
          <h3 className="footer-title">Domus Memoriae</h3>
          <p className="footer-description">
            A sanctuary for your family's stories, memories, and legacy. 
            Preserving the past for generations to come.
          </p>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">About</h4>
          <ul className="footer-links">
            <li><a href="#" className="footer-link">Our Mission</a></li>
            <li><a href="#" className="footer-link">How It Works</a></li>
            <li><a href="#" className="footer-link">Security & Privacy</a></li>
            <li><a href="#" className="footer-link">FAQ</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Resources</h4>
          <ul className="footer-links">
            <li><a href="#" className="footer-link">Documentation</a></li>
            <li><a href="#" className="footer-link">Support Center</a></li>
            <li><a href="#" className="footer-link">Community</a></li>
            <li><a href="#" className="footer-link">Blog</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Legal</h4>
          <ul className="footer-links">
            <li><a href="#" className="footer-link">Terms of Service</a></li>
            <li><a href="#" className="footer-link">Privacy Policy</a></li>
            <li><a href="#" className="footer-link">Cookie Policy</a></li>
            <li><a href="#" className="footer-link">Data Protection</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4 className="footer-heading">Connect</h4>
          <ul className="footer-links">
            <li><a href="#" className="footer-link">Contact Us</a></li>
            <li><a href="#" className="footer-link">Twitter</a></li>
            <li><a href="#" className="footer-link">LinkedIn</a></li>
            <li><a href="#" className="footer-link">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-divider"></div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © {currentYear} Domus Memoriae. All rights reserved.
        </p>
        <p className="footer-note">
          Preserving memories since 2026
        </p>
      </div>
    </footer>
  );
}
