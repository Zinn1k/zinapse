import React from "react";

interface ZinapseLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  showBadge?: boolean;
}

export function ZinapseLogo({
  size = 40,
  showBadge = true,
  className = "",
  ...props
}: ZinapseLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      aria-label="Zinapse Logo"
      {...props}
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id="zinapse-comp-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="40%" stopColor="#312e81" />
          <stop offset="75%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>

        {/* Border highlight */}
        <linearGradient id="zinapse-comp-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#a5b4fc" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>

        {/* Card Faint Gradient */}
        <linearGradient id="zinapse-comp-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>

        {/* Upper Axon Gradient */}
        <linearGradient id="zinapse-comp-upper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        {/* Lower Axon Gradient */}
        <linearGradient id="zinapse-comp-lower" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>

        {/* Synaptic Cleft Radial Glow */}
        <radialGradient id="zinapse-comp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.65" />
          <stop offset="50%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
        </radialGradient>
      </defs>

      {showBadge && (
        <>
          <rect
            width="512"
            height="512"
            rx="128"
            fill="url(#zinapse-comp-bg)"
            className="drop-shadow-lg"
          />
          <rect
            x="6"
            y="6"
            width="500"
            height="500"
            rx="122"
            fill="none"
            stroke="url(#zinapse-comp-border)"
            strokeWidth="3.5"
          />

          {/* Flashcard silhouettes in background */}
          <rect
            x="136"
            y="126"
            width="240"
            height="260"
            rx="32"
            fill="url(#zinapse-comp-card-bg)"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.15"
            transform="rotate(-6 256 256)"
          />
          <rect
            x="136"
            y="126"
            width="240"
            height="260"
            rx="32"
            fill="url(#zinapse-comp-card-bg)"
            stroke="#ffffff"
            strokeWidth="3"
            strokeOpacity="0.22"
            transform="rotate(4 256 256)"
          />
        </>
      )}

      {/* Synaptic Cleft Glow */}
      <circle cx="256" cy="256" r="90" fill="url(#zinapse-comp-glow)" />

      {/* The Z-Synapse Upper Arm */}
      <path
        d="M 140 150 L 372 150 C 388 150 395 162 386 172 L 274 239"
        fill="none"
        stroke="url(#zinapse-comp-upper)"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The Z-Synapse Lower Arm */}
      <path
        d="M 238 273 L 126 340 C 117 350 124 362 140 362 L 372 362"
        fill="none"
        stroke="url(#zinapse-comp-lower)"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Synaptic Boutons */}
      <circle cx="274" cy="239" r="17" fill="#ffffff" />
      <circle cx="274" cy="239" r="9" fill="#0284c7" />

      <circle cx="238" cy="273" r="17" fill="#ffffff" />
      <circle cx="238" cy="273" r="9" fill="#0284c7" />

      {/* Outer Neuron Soma Nodes */}
      <circle cx="140" cy="150" r="26" fill="#818cf8" opacity="0.35" />
      <circle cx="140" cy="150" r="15" fill="#ffffff" />
      <circle cx="140" cy="150" r="8" fill="#4f46e5" />

      <circle cx="372" cy="362" r="26" fill="#a78bfa" opacity="0.35" />
      <circle cx="372" cy="362" r="15" fill="#ffffff" />
      <circle cx="372" cy="362" r="8" fill="#7c3aed" />

      {/* Synaptic Transmission Spark */}
      <g id="synaptic-spark-comp">
        <path
          d="M 256 226 Q 256 256 226 256 Q 256 256 256 286 Q 256 256 286 256 Q 256 256 256 226 Z"
          fill="#ffffff"
        />
        <circle cx="246" cy="246" r="5" fill="#38bdf8" />
        <circle cx="266" cy="266" r="5" fill="#38bdf8" />
        <circle cx="264" cy="244" r="3.5" fill="#ffffff" />
        <circle cx="248" cy="268" r="3.5" fill="#ffffff" />
      </g>
    </svg>
  );
}
