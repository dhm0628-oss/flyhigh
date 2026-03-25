"use client";

import type React from "react";
import Hls from "hls.js";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../../lib/http";
import { WEB_API_URL } from "../../../lib/runtime";

type SessionResponse = {
  authenticated: boolean;
  viewer: null | {
    id: string;
    email: string;
    displayName: string;
    subscriptionStatus: "active" | "inactive" | "trialing" | "past_due";
  };
};

type PlaybackResponse = {
  contentId: string;
  allowed: boolean;
  reason?: string;
  playbackUrl?: string;
  expiresAt?: string;
};

type ProgressResponse = {
  contentId: string;
  hasProgress: boolean;
  positionSeconds: number;
  progressPercent: number;
  completed: boolean;
  lastPlayedAt?: string;
};

export function PlaybackPanel({
  contentId,
  title,
  isPremium,
  playbackAvailable,
  durationSeconds,
  posterUrl,
  synopsis,
  type,
  releaseYear,
  videoStatus,
  tags
}: {
  contentId: string;
  title: string;
  isPremium: boolean;
  playbackAvailable: boolean;
  durationSeconds: number;
  posterUrl: string;
  synopsis: string;
  type: string;
  releaseYear?: number;
  videoStatus?: string;
  tags: string[];
}) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [playback, setPlayback] = useState<PlaybackResponse | null>(null);
  const [savedProgress, setSavedProgress] = useState<ProgressResponse | null>(null);
  const [resumeMode, setResumeMode] = useState<"resume" | "restart">("resume");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaIssue, setMediaIssue] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const lastProgressSentAtRef = useRef<number>(0);
  const lastProgressPositionRef = useRef<number>(0);
  const initialSeekAppliedRef = useRef<boolean>(false);
  const waitingTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoPlaybackRequestedRef = useRef<boolean>(false);

  async function loadSession() {
    try {
      const next = await apiFetch<SessionResponse>("/v1/auth/session", { method: "GET" });
      setSession(next);
      if (next.authenticated) {
        try {
          const progress = await apiFetch<ProgressResponse>(`/v1/viewer/progress/${contentId}`, { method: "GET" });
          setSavedProgress(progress);
          if (progress.hasProgress && !progress.completed && progress.positionSeconds > 0) {
            setResumeMode("resume");
          }
        } catch {
          setSavedProgress(null);
        }
      } else {
        setSavedProgress(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  }

  useEffect(() => {
    autoPlaybackRequestedRef.current = false;
    void loadSession();
  }, [contentId]);

  useEffect(() => {
    return () => {
      if (waitingTimeoutRef.current !== null) {
        window.clearTimeout(waitingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (autoPlaybackRequestedRef.current) return;
    if (!playbackAvailable) return;
    if (isPremium && !session.authenticated) return;

    autoPlaybackRequestedRef.current = true;
    void requestPlayback(true);
  }, [session, isPremium, contentId, playbackAvailable]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    setIsPlaying(false);

    if (!playback?.allowed || !playback.playbackUrl) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playback.playbackUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(playback.playbackUrl);
      hls.attachMedia(video);
    } else {
      video.src = playback.playbackUrl;
    }

    return () => {
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playback?.allowed, playback?.playbackUrl]);

  async function requestPlayback(background = false) {
    if (!playbackAvailable) {
      setPlayback({ contentId, allowed: false, reason: "unavailable" });
      if (!background) {
        setError("Playback is not ready for this title yet.");
      }
      return false;
    }

    setBusy(background ? "preflight" : "play");
    if (!background) {
      setError(null);
    }
    if (!background) setNotice(null);
    initialSeekAppliedRef.current = false;
    try {
      const res = await fetch(`${WEB_API_URL}/v1/content/${contentId}/playback`, {
        method: "POST",
        credentials: "include"
      });
      const text = await res.text();
      const payload = text ? (JSON.parse(text) as PlaybackResponse & { error?: string }) : null;
      if (!res.ok) {
        if (payload?.reason === "requires_subscription") {
          setPlayback({ contentId, allowed: false, reason: "requires_subscription" });
          if (!background) {
            setNotice("This title requires an active subscription.");
          }
          return false;
        }
        const message = payload?.error ?? `Playback request failed (${res.status})`;
        if (!background) {
          throw new Error(message);
        }
        return false;
      }
      setPlayback(payload as PlaybackResponse);
      if (!background) {
        setNotice("Playback ready.");
      }
      setMediaIssue(null);
      return true;
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : "Could not prepare playback. Please try again.");
      }
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("login");
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      autoPlaybackRequestedRef.current = false;
      await loadSession();
      setNotice("Signed in. Checking playback access...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendProgress(positionSeconds: number, completed = false) {
    if (!session?.authenticated) return;
    try {
      const result = await apiFetch<{
        ok: true;
        contentId: string;
        positionSeconds: number;
        progressPercent: number;
        completed: boolean;
      }>("/v1/viewer/progress", {
        method: "POST",
        body: JSON.stringify({
          contentId,
          positionSeconds,
          durationSeconds,
          completed
        })
      });
      setSavedProgress((current) => ({
        contentId,
        hasProgress: true,
        positionSeconds: result.positionSeconds ?? positionSeconds,
        progressPercent: result.progressPercent ?? current?.progressPercent ?? 0,
        completed: Boolean(result.completed),
        lastPlayedAt: new Date().toISOString()
      }));
    } catch {
      // Ignore progress errors; playback should continue.
    }
  }

  function handleTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    const now = Date.now();
    const position = Math.floor(video.currentTime || 0);
    if (position <= 0) return;
    if (Math.abs(position - lastProgressPositionRef.current) < 10 && now - lastProgressSentAtRef.current < 15000) {
      return;
    }
    lastProgressPositionRef.current = position;
    lastProgressSentAtRef.current = now;
    void sendProgress(position, false);
  }

  function handlePause(event: React.SyntheticEvent<HTMLVideoElement>) {
    setIsPlaying(false);
    void sendProgress(Math.floor(event.currentTarget.currentTime || 0), false);
  }

  function handleEnded(event: React.SyntheticEvent<HTMLVideoElement>) {
    setIsPlaying(false);
    const position = Math.floor(event.currentTarget.currentTime || durationSeconds || 0);
    void sendProgress(position, true);
  }

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (initialSeekAppliedRef.current) return;
    if (resumeMode !== "resume") {
      initialSeekAppliedRef.current = true;
      return;
    }
    const resumeAt = savedProgress?.positionSeconds ?? 0;
    if (!resumeAt || resumeAt <= 0) {
      initialSeekAppliedRef.current = true;
      return;
    }

    const safeSeek = Math.max(0, resumeAt - 2);
    try {
      event.currentTarget.currentTime = safeSeek;
    } catch {
      // Some browsers may block early seek timing; ignore.
    }
    initialSeekAppliedRef.current = true;
  }

  function clearWaitingTimeout() {
    if (waitingTimeoutRef.current !== null) {
      window.clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  }

  function handleVideoWaiting() {
    clearWaitingTimeout();
    waitingTimeoutRef.current = window.setTimeout(() => {
      setMediaIssue("Playback is taking longer than expected. Check your connection and try again.");
    }, 10000);
  }

  function handleVideoPlaying() {
    clearWaitingTimeout();
    setMediaIssue(null);
    setIsPlaying(true);
  }

  function handleVideoError() {
    clearWaitingTimeout();
    setMediaIssue("We couldn't play this video stream. Please try again.");
    setIsPlaying(false);
  }

  async function openFullscreen(video: HTMLVideoElement) {
    const webkitVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement !== video && video.requestFullscreen) {
      await video.requestFullscreen().catch(() => undefined);
    } else if (webkitVideo.webkitEnterFullscreen) {
      webkitVideo.webkitEnterFullscreen();
    }
  }

  async function handlePrimaryPlay() {
    setError(null);
    setNotice(null);
    setMediaIssue(null);

    if (!playback?.allowed || !playback.playbackUrl) {
      const prepared = await requestPlayback(false);
      if (!prepared) return;
    }

    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      await openFullscreen(video);
    } catch {
      setMediaIssue("We couldn't start playback. Please try again.");
    }
  }

  const canResume = Boolean(savedProgress?.hasProgress && !savedProgress?.completed && (savedProgress?.positionSeconds ?? 0) > 0);
  const requiresSubscription = playback?.reason === "requires_subscription" || (isPremium && !session?.authenticated);

  return (
    <div className="player-shell">
      <div className="player-panel player-panel--watch player-panel--watch-experience">
        <div className="player-panel__head">
          <div>
            <h2>{title}</h2>
            <p>
              {isPremium ? "Premium title" : "Free title"} | {busy === "preflight" ? "Checking access..." : session?.authenticated ? `Signed in as ${session.viewer?.displayName} (${session.viewer?.subscriptionStatus})` : "Not signed in"}
            </p>
          </div>
        </div>

        {canResume ? (
          <div className="resume-panel">
            <div className="card__meta">
              Resume from {Math.floor((savedProgress?.positionSeconds ?? 0) / 60)}:{String((savedProgress?.positionSeconds ?? 0) % 60).padStart(2, "0")} ({savedProgress?.progressPercent ?? 0}% watched)
            </div>
            <div className="row-actions">
              <button className={`btn-inline ${resumeMode === "resume" ? "is-selected" : ""}`} type="button" onClick={() => setResumeMode("resume")}>Resume</button>
              <button className={`btn-inline ${resumeMode === "restart" ? "is-selected" : ""}`} type="button" onClick={() => setResumeMode("restart")}>Restart</button>
            </div>
          </div>
        ) : null}

        {error ? <p className="web-status web-status--error" role="alert" aria-live="polite">{error}</p> : null}
        {notice ? <p className="web-status web-status--ok" role="status" aria-live="polite">{notice}</p> : null}
        {mediaIssue ? <p className="web-status web-status--error" role="alert" aria-live="polite">{mediaIssue}</p> : null}

        <div className="watch-stage">
          <div className="video-wrap video-wrap--featured">
            <video
              ref={videoRef}
              controls={isPlaying}
              playsInline
              poster={posterUrl || undefined}
              className="video video--featured"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
              onEnded={handleEnded}
              onWaiting={handleVideoWaiting}
              onPlaying={handleVideoPlaying}
              onError={handleVideoError}
            />
            {!isPlaying ? (
              <button className="video-overlay-play" type="button" onClick={() => void handlePrimaryPlay()}>
                {requiresSubscription
                  ? "Sign In To Watch"
                  : busy === "play" || busy === "preflight"
                    ? "Preparing..."
                    : canResume && resumeMode === "resume"
                      ? "Resume Fullscreen"
                      : "Play Fullscreen"}
              </button>
            ) : null}
          </div>
          <div className="watch-stage__meta">
            <h3>Now Playing</h3>
            <p className="watch-copy">{synopsis || "No synopsis yet."}</p>
            <div className="watch-facts">
              <span>{type}</span>
              <span>{releaseYear ?? "n/a"}</span>
              <span>{Math.round(durationSeconds / 60)} min</span>
              <span>{isPremium ? "Subscriber only" : "Free"}</span>
              <span>Video: {videoStatus ?? "none"}</span>
            </div>
            <div className="watch-tags">
              {tags.map((tag) => (
                <span key={tag} className="watch-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isPremium && !session?.authenticated ? (
        <div className="player-panel player-panel--auth">
          <h3>Sign In To Watch</h3>
          <p className="card__meta">
            This title requires an active subscription. Sign in below or use the account page to manage your subscription.
          </p>
          <form className="watch-login" onSubmit={handleLogin}>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Your password" />
            </label>
            <button className="btn btn--secondary" type="submit">
              {busy === "login" ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
