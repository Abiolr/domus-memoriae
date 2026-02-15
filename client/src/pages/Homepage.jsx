import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Homepage.css";

export default function Homepage() {
  const nav = useNavigate();

  return (
    <>
      <div className="home">
        <div className="home-grain"></div>
        <div className="home-vignette"></div>

        <div className="home-wrapper">
          <header className="home-header">
            <div className="home-ornament"></div>
            <h1 className="home-title">Domus Memoriae</h1>
            <p className="home-subtitle">
              A Home for What Time Should Never Erase
            </p>
          </header>

          <main className="home-main">
            <div className="home-actions">
              <button className="home-button" onClick={() => nav("/register")}>
                <span className="home-button-text">Register</span>
                <span className="home-button-underline"></span>
              </button>

              <button className="home-button" onClick={() => nav("/login")}>
                <span className="home-button-text">Login</span>
                <span className="home-button-underline"></span>
              </button>
            </div>

            <div className="home-scroll-indicator">
              <div className="home-scroll-line"></div>
              <span className="home-scroll-text">Discover More</span>
            </div>
          </main>
        </div>
      </div>

      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-hero-ornament"></div>

          <h2 className="home-hero-title">
            Where Memories Outlive Generations
          </h2>

          <div className="home-hero-text">
            <p className="home-hero-paragraph">
              Family histories fade. Photos scatter. Digital files decay. As
              formats become obsolete and platforms disappear, your most
              precious memories risk being lost forever. Domus Memoriae stands
              against this erosion of heritage.
            </p>

            <p className="home-hero-paragraph">
              Unlike ordinary cloud storage, we're purpose-built for
              generational survival. Our platform monitors file health, prevents
              format obsolescence, and ensures seamless transfer across
              lifetimes—so your family's story endures, intact and accessible,
              for centuries to come.
            </p>
          </div>

          <div className="home-hero-features">
            <div className="home-hero-feature">
              <div className="home-hero-feature-icon">◆</div>
              <h3 className="home-hero-feature-title">Generational Design</h3>
              <p className="home-hero-feature-desc">
                Built for long-term survivability with seamless admin succession
                and role-based family access
              </p>
            </div>

            <div className="home-hero-feature">
              <div className="home-hero-feature-icon">◆</div>
              <h3 className="home-hero-feature-title">
                Memory Health Monitoring
              </h3>
              <p className="home-hero-feature-desc">
                Track file survivability scores and archive resiliency to
                prevent digital decay before it happens
              </p>
            </div>

            <div className="home-hero-feature">
              <div className="home-hero-feature-icon">◆</div>
              <h3 className="home-hero-feature-title">
                Format Future-Proofing
              </h3>
              <p className="home-hero-feature-desc">
                Detect outdated formats, missing metadata, and fragile files
                with proactive archival recommendations
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
