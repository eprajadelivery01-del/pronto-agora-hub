import { cn } from "@/lib/utils";

// Original static BonaSoft vector atom
export function BonaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-12 -12 24 24"
      className={cn("text-primary shrink-0 select-none", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <circle r="2.1" fill="currentColor" stroke="none" />
      <ellipse rx="10" ry="4" />
      <ellipse rx="10" ry="4" transform="rotate(60)" />
      <ellipse rx="10" ry="4" transform="rotate(120)" />
    </svg>
  );
}

// Pre-calculated deterministic quantum particles for the BonaSoft particle atom
const ORBIT_PARTICLES = [
  {
    "angle": 0,
    "count": 42,
    "id": "orbit1",
    "pts": [
      {
        "x": 13.03,
        "y": -0.31,
        "r": 0.51,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "1.24",
        "dur": "2.95"
      },
      {
        "x": 12.65,
        "y": 1,
        "r": 0.27,
        "color": "#FFFFFF",
        "opacity": 0.83,
        "delay": "1.84",
        "dur": "1.60"
      },
      {
        "x": 12.34,
        "y": 1.31,
        "r": 0.27,
        "color": "#69F0AE",
        "opacity": 0.63,
        "delay": "2.51",
        "dur": "2.26"
      },
      {
        "x": 11.56,
        "y": 1.91,
        "r": 0.32,
        "color": "#E0FFF8",
        "opacity": 0.65,
        "delay": "2.02",
        "dur": "3.32"
      },
      {
        "x": 10.57,
        "y": 2.59,
        "r": 0.33,
        "color": "#00E676",
        "opacity": 0.53,
        "delay": "3.60",
        "dur": "2.43"
      },
      {
        "x": 9.93,
        "y": 3.4,
        "r": 0.4,
        "color": "#69F0AE",
        "opacity": 0.51,
        "delay": "1.83",
        "dur": "2.12"
      },
      {
        "x": 7.65,
        "y": 3.8,
        "r": 0.27,
        "color": "#00E676",
        "opacity": 0.58,
        "delay": "1.98",
        "dur": "3.14"
      },
      {
        "x": 6.24,
        "y": 4.35,
        "r": 0.65,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "3.62",
        "dur": "2.59"
      },
      {
        "x": 4.94,
        "y": 4.7,
        "r": 0.32,
        "color": "#00FF88",
        "opacity": 0.78,
        "delay": "3.90",
        "dur": "2.54"
      },
      {
        "x": 2.74,
        "y": 4.73,
        "r": 0.34,
        "color": "#00E676",
        "opacity": 0.7,
        "delay": "3.34",
        "dur": "2.16"
      },
      {
        "x": 1.48,
        "y": 5.04,
        "r": 0.32,
        "color": "#FFFFFF",
        "opacity": 0.71,
        "delay": "3.10",
        "dur": "2.09"
      },
      {
        "x": -1.63,
        "y": 4.67,
        "r": 0.43,
        "color": "#00FF88",
        "opacity": 0.84,
        "delay": "3.17",
        "dur": "2.70"
      },
      {
        "x": -2.42,
        "y": 4.89,
        "r": 0.41,
        "color": "#FFFFFF",
        "opacity": 0.65,
        "delay": "3.50",
        "dur": "2.10"
      },
      {
        "x": -4.05,
        "y": 4.94,
        "r": 0.34,
        "color": "#69F0AE",
        "opacity": 0.61,
        "delay": "1.28",
        "dur": "1.74"
      },
      {
        "x": -6.84,
        "y": 3.95,
        "r": 0.47,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "1.50",
        "dur": "2.69"
      },
      {
        "x": -7.34,
        "y": 4.04,
        "r": 0.34,
        "color": "#69F0AE",
        "opacity": 0.87,
        "delay": "0.77",
        "dur": "2.61"
      },
      {
        "x": -9.26,
        "y": 3.33,
        "r": 0.32,
        "color": "#00F5FF",
        "opacity": 0.91,
        "delay": "1.69",
        "dur": "3.05"
      },
      {
        "x": -10.64,
        "y": 2.74,
        "r": 0.34,
        "color": "#69F0AE",
        "opacity": 0.79,
        "delay": "0.50",
        "dur": "1.62"
      },
      {
        "x": -12.07,
        "y": 2.06,
        "r": 0.23,
        "color": "#E0FFF8",
        "opacity": 0.84,
        "delay": "3.43",
        "dur": "2.59"
      },
      {
        "x": -12.61,
        "y": 1.29,
        "r": 0.44,
        "color": "#E0FFF8",
        "opacity": 0.88,
        "delay": "1.56",
        "dur": "1.88"
      },
      {
        "x": -12.3,
        "y": 0.84,
        "r": 0.34,
        "color": "#E0FFF8",
        "opacity": 0.67,
        "delay": "2.27",
        "dur": "1.74"
      },
      {
        "x": -12.81,
        "y": -0.11,
        "r": 0.6,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "0.37",
        "dur": "1.86"
      },
      {
        "x": -13.01,
        "y": -0.74,
        "r": 0.33,
        "color": "#00E676",
        "opacity": 0.88,
        "delay": "1.33",
        "dur": "2.35"
      },
      {
        "x": -11.88,
        "y": -1.52,
        "r": 0.38,
        "color": "#69F0AE",
        "opacity": 0.95,
        "delay": "2.05",
        "dur": "2.94"
      },
      {
        "x": -11.25,
        "y": -2.42,
        "r": 0.27,
        "color": "#E0FFF8",
        "opacity": 0.86,
        "delay": "2.35",
        "dur": "2.32"
      },
      {
        "x": -10.74,
        "y": -2.52,
        "r": 0.41,
        "color": "#00E676",
        "opacity": 0.71,
        "delay": "1.35",
        "dur": "2.75"
      },
      {
        "x": -9.95,
        "y": -3.32,
        "r": 0.29,
        "color": "#B9F6CA",
        "opacity": 0.75,
        "delay": "2.59",
        "dur": "2.05"
      },
      {
        "x": -7.68,
        "y": -4.08,
        "r": 0.27,
        "color": "#69F0AE",
        "opacity": 0.94,
        "delay": "0.31",
        "dur": "2.43"
      },
      {
        "x": -5.96,
        "y": -4.14,
        "r": 0.59,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "3.91",
        "dur": "3.35"
      },
      {
        "x": -4.87,
        "y": -4.71,
        "r": 0.26,
        "color": "#B9F6CA",
        "opacity": 0.87,
        "delay": "0.21",
        "dur": "1.87"
      },
      {
        "x": -2.38,
        "y": -4.94,
        "r": 0.4,
        "color": "#69F0AE",
        "opacity": 0.75,
        "delay": "0.28",
        "dur": "3.34"
      },
      {
        "x": -1.23,
        "y": -5.1,
        "r": 0.27,
        "color": "#B9F6CA",
        "opacity": 0.75,
        "delay": "2.55",
        "dur": "2.81"
      },
      {
        "x": 1,
        "y": -5.07,
        "r": 0.42,
        "color": "#00F5FF",
        "opacity": 0.57,
        "delay": "3.38",
        "dur": "2.89"
      },
      {
        "x": 3.2,
        "y": -5.12,
        "r": 0.4,
        "color": "#00F5FF",
        "opacity": 0.81,
        "delay": "3.82",
        "dur": "2.07"
      },
      {
        "x": 4.02,
        "y": -4.48,
        "r": 0.39,
        "color": "#00FF88",
        "opacity": 0.65,
        "delay": "0.54",
        "dur": "1.78"
      },
      {
        "x": 6.64,
        "y": -4.56,
        "r": 0.47,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "0.87",
        "dur": "3.04"
      },
      {
        "x": 8.3,
        "y": -3.72,
        "r": 0.43,
        "color": "#00E676",
        "opacity": 0.86,
        "delay": "0.70",
        "dur": "3.35"
      },
      {
        "x": 9.45,
        "y": -3.54,
        "r": 0.33,
        "color": "#00F5FF",
        "opacity": 0.91,
        "delay": "1.74",
        "dur": "2.13"
      },
      {
        "x": 11.14,
        "y": -2.83,
        "r": 0.31,
        "color": "#00FF88",
        "opacity": 0.71,
        "delay": "2.95",
        "dur": "3.26"
      },
      {
        "x": 11.46,
        "y": -2.13,
        "r": 0.41,
        "color": "#00E676",
        "opacity": 0.89,
        "delay": "0.94",
        "dur": "3.29"
      },
      {
        "x": 12.37,
        "y": -1.57,
        "r": 0.37,
        "color": "#00E676",
        "opacity": 0.87,
        "delay": "0.97",
        "dur": "2.20"
      },
      {
        "x": 12.54,
        "y": -0.96,
        "r": 0.35,
        "color": "#69F0AE",
        "opacity": 0.94,
        "delay": "1.76",
        "dur": "2.17"
      }
    ]
  },
  {
    "angle": 60,
    "count": 42,
    "id": "orbit2",
    "pts": [
      {
        "x": 12.79,
        "y": 0.03,
        "r": 0.58,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "3.49",
        "dur": "3.10"
      },
      {
        "x": 12.97,
        "y": 0.67,
        "r": 0.3,
        "color": "#FFFFFF",
        "opacity": 0.75,
        "delay": "2.43",
        "dur": "3.18"
      },
      {
        "x": 11.91,
        "y": 1.5,
        "r": 0.42,
        "color": "#00F5FF",
        "opacity": 0.87,
        "delay": "2.04",
        "dur": "1.97"
      },
      {
        "x": 11.11,
        "y": 2.11,
        "r": 0.34,
        "color": "#69F0AE",
        "opacity": 0.76,
        "delay": "0.56",
        "dur": "2.98"
      },
      {
        "x": 10.08,
        "y": 2.91,
        "r": 0.26,
        "color": "#E0FFF8",
        "opacity": 0.55,
        "delay": "1.35",
        "dur": "2.48"
      },
      {
        "x": 9.85,
        "y": 3.19,
        "r": 0.43,
        "color": "#FFFFFF",
        "opacity": 0.71,
        "delay": "1.26",
        "dur": "2.82"
      },
      {
        "x": 8.32,
        "y": 3.51,
        "r": 0.44,
        "color": "#00F5FF",
        "opacity": 0.71,
        "delay": "1.09",
        "dur": "2.55"
      },
      {
        "x": 6.56,
        "y": 4.39,
        "r": 0.54,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "0.70",
        "dur": "1.83"
      },
      {
        "x": 5.1,
        "y": 4.35,
        "r": 0.37,
        "color": "#00E676",
        "opacity": 0.93,
        "delay": "3.99",
        "dur": "3.27"
      },
      {
        "x": 2.69,
        "y": 4.84,
        "r": 0.27,
        "color": "#00FF88",
        "opacity": 0.83,
        "delay": "3.82",
        "dur": "1.74"
      },
      {
        "x": 0.31,
        "y": 5.13,
        "r": 0.28,
        "color": "#E0FFF8",
        "opacity": 0.81,
        "delay": "3.96",
        "dur": "2.71"
      },
      {
        "x": -1.18,
        "y": 4.76,
        "r": 0.26,
        "color": "#00F5FF",
        "opacity": 0.5,
        "delay": "3.53",
        "dur": "2.31"
      },
      {
        "x": -3.43,
        "y": 4.71,
        "r": 0.32,
        "color": "#00F5FF",
        "opacity": 0.91,
        "delay": "0.77",
        "dur": "2.25"
      },
      {
        "x": -5.14,
        "y": 4.72,
        "r": 0.23,
        "color": "#FFFFFF",
        "opacity": 0.56,
        "delay": "2.83",
        "dur": "3.25"
      },
      {
        "x": -6.95,
        "y": 4.33,
        "r": 0.63,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "0.16",
        "dur": "2.88"
      },
      {
        "x": -8.32,
        "y": 3.67,
        "r": 0.33,
        "color": "#00F5FF",
        "opacity": 0.89,
        "delay": "0.82",
        "dur": "2.28"
      },
      {
        "x": -9.02,
        "y": 3.25,
        "r": 0.34,
        "color": "#B9F6CA",
        "opacity": 0.55,
        "delay": "0.62",
        "dur": "2.25"
      },
      {
        "x": -10.44,
        "y": 3.07,
        "r": 0.42,
        "color": "#00FF88",
        "opacity": 0.64,
        "delay": "2.78",
        "dur": "2.50"
      },
      {
        "x": -11.73,
        "y": 2.03,
        "r": 0.3,
        "color": "#00E676",
        "opacity": 0.91,
        "delay": "1.76",
        "dur": "2.12"
      },
      {
        "x": -12.05,
        "y": 1.3,
        "r": 0.36,
        "color": "#B9F6CA",
        "opacity": 0.6,
        "delay": "0.90",
        "dur": "3.32"
      },
      {
        "x": -12.61,
        "y": 0.45,
        "r": 0.36,
        "color": "#00E676",
        "opacity": 0.72,
        "delay": "2.87",
        "dur": "3.01"
      },
      {
        "x": -12.76,
        "y": -0.21,
        "r": 0.49,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "2.92",
        "dur": "2.05"
      },
      {
        "x": -12.7,
        "y": -0.93,
        "r": 0.3,
        "color": "#E0FFF8",
        "opacity": 0.62,
        "delay": "3.95",
        "dur": "2.65"
      },
      {
        "x": -12.01,
        "y": -1.61,
        "r": 0.38,
        "color": "#FFFFFF",
        "opacity": 0.54,
        "delay": "1.51",
        "dur": "2.27"
      },
      {
        "x": -11.76,
        "y": -2,
        "r": 0.27,
        "color": "#00F5FF",
        "opacity": 0.76,
        "delay": "1.21",
        "dur": "2.13"
      },
      {
        "x": -10.45,
        "y": -2.56,
        "r": 0.33,
        "color": "#00E676",
        "opacity": 0.93,
        "delay": "0.09",
        "dur": "1.83"
      },
      {
        "x": -9.57,
        "y": -3.52,
        "r": 0.41,
        "color": "#00FF88",
        "opacity": 0.94,
        "delay": "1.22",
        "dur": "1.83"
      },
      {
        "x": -8.17,
        "y": -3.74,
        "r": 0.32,
        "color": "#69F0AE",
        "opacity": 0.53,
        "delay": "3.16",
        "dur": "1.61"
      },
      {
        "x": -6.61,
        "y": -4.19,
        "r": 0.61,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "3.22",
        "dur": "2.93"
      },
      {
        "x": -4.24,
        "y": -4.69,
        "r": 0.41,
        "color": "#69F0AE",
        "opacity": 0.7,
        "delay": "3.00",
        "dur": "2.20"
      },
      {
        "x": -3.07,
        "y": -5.06,
        "r": 0.36,
        "color": "#00FF88",
        "opacity": 0.67,
        "delay": "0.80",
        "dur": "2.60"
      },
      {
        "x": -1.11,
        "y": -5.09,
        "r": 0.34,
        "color": "#00F5FF",
        "opacity": 0.53,
        "delay": "3.38",
        "dur": "3.16"
      },
      {
        "x": 1.12,
        "y": -5.12,
        "r": 0.24,
        "color": "#00E676",
        "opacity": 0.51,
        "delay": "1.40",
        "dur": "2.21"
      },
      {
        "x": 2.23,
        "y": -5.27,
        "r": 0.35,
        "color": "#00E676",
        "opacity": 0.92,
        "delay": "3.16",
        "dur": "2.43"
      },
      {
        "x": 4.06,
        "y": -4.46,
        "r": 0.3,
        "color": "#00E676",
        "opacity": 0.72,
        "delay": "1.48",
        "dur": "3.31"
      },
      {
        "x": 6.09,
        "y": -4.57,
        "r": 0.59,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "0.24",
        "dur": "2.34"
      },
      {
        "x": 7.53,
        "y": -4.3,
        "r": 0.23,
        "color": "#FFFFFF",
        "opacity": 0.82,
        "delay": "0.12",
        "dur": "1.91"
      },
      {
        "x": 9.36,
        "y": -3.2,
        "r": 0.39,
        "color": "#B9F6CA",
        "opacity": 0.73,
        "delay": "0.05",
        "dur": "1.87"
      },
      {
        "x": 10.92,
        "y": -2.82,
        "r": 0.34,
        "color": "#FFFFFF",
        "opacity": 0.58,
        "delay": "1.67",
        "dur": "2.84"
      },
      {
        "x": 11.14,
        "y": -2.32,
        "r": 0.31,
        "color": "#00E676",
        "opacity": 0.71,
        "delay": "0.34",
        "dur": "2.77"
      },
      {
        "x": 12.21,
        "y": -1.42,
        "r": 0.3,
        "color": "#69F0AE",
        "opacity": 0.63,
        "delay": "0.74",
        "dur": "1.98"
      },
      {
        "x": 12.97,
        "y": -0.67,
        "r": 0.3,
        "color": "#00F5FF",
        "opacity": 0.87,
        "delay": "1.22",
        "dur": "2.87"
      }
    ]
  },
  {
    "angle": 120,
    "count": 42,
    "id": "orbit3",
    "pts": [
      {
        "x": 12.72,
        "y": -0.09,
        "r": 0.68,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "3.21",
        "dur": "2.84"
      },
      {
        "x": 12.86,
        "y": 0.76,
        "r": 0.26,
        "color": "#00FF88",
        "opacity": 0.53,
        "delay": "3.45",
        "dur": "3.10"
      },
      {
        "x": 12.22,
        "y": 1.28,
        "r": 0.35,
        "color": "#00E676",
        "opacity": 0.69,
        "delay": "0.57",
        "dur": "2.52"
      },
      {
        "x": 11.66,
        "y": 2.02,
        "r": 0.31,
        "color": "#FFFFFF",
        "opacity": 0.78,
        "delay": "1.52",
        "dur": "3.37"
      },
      {
        "x": 10.54,
        "y": 2.86,
        "r": 0.29,
        "color": "#00FF88",
        "opacity": 0.87,
        "delay": "2.00",
        "dur": "3.37"
      },
      {
        "x": 9.42,
        "y": 3.41,
        "r": 0.29,
        "color": "#E0FFF8",
        "opacity": 0.67,
        "delay": "3.50",
        "dur": "2.07"
      },
      {
        "x": 7.19,
        "y": 3.84,
        "r": 0.38,
        "color": "#69F0AE",
        "opacity": 0.76,
        "delay": "1.29",
        "dur": "3.01"
      },
      {
        "x": 6.61,
        "y": 4.14,
        "r": 0.7,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "0.82",
        "dur": "2.76"
      },
      {
        "x": 4.93,
        "y": 4.5,
        "r": 0.38,
        "color": "#FFFFFF",
        "opacity": 0.52,
        "delay": "3.03",
        "dur": "1.89"
      },
      {
        "x": 2.31,
        "y": 5,
        "r": 0.31,
        "color": "#B9F6CA",
        "opacity": 0.52,
        "delay": "3.26",
        "dur": "3.35"
      },
      {
        "x": 0.85,
        "y": 4.78,
        "r": 0.23,
        "color": "#B9F6CA",
        "opacity": 0.89,
        "delay": "3.20",
        "dur": "1.82"
      },
      {
        "x": -1.43,
        "y": 5.26,
        "r": 0.31,
        "color": "#00E676",
        "opacity": 0.53,
        "delay": "2.40",
        "dur": "3.32"
      },
      {
        "x": -3.18,
        "y": 4.94,
        "r": 0.24,
        "color": "#B9F6CA",
        "opacity": 0.77,
        "delay": "3.37",
        "dur": "2.47"
      },
      {
        "x": -4.83,
        "y": 4.36,
        "r": 0.31,
        "color": "#FFFFFF",
        "opacity": 0.56,
        "delay": "2.14",
        "dur": "2.24"
      },
      {
        "x": -6.02,
        "y": 4.42,
        "r": 0.62,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "0.14",
        "dur": "2.06"
      },
      {
        "x": -7.58,
        "y": 3.95,
        "r": 0.35,
        "color": "#69F0AE",
        "opacity": 0.5,
        "delay": "2.03",
        "dur": "2.47"
      },
      {
        "x": -9.02,
        "y": 3.22,
        "r": 0.31,
        "color": "#B9F6CA",
        "opacity": 0.66,
        "delay": "0.89",
        "dur": "3.07"
      },
      {
        "x": -10.42,
        "y": 3.21,
        "r": 0.29,
        "color": "#00F5FF",
        "opacity": 0.94,
        "delay": "3.38",
        "dur": "2.08"
      },
      {
        "x": -11.67,
        "y": 2.1,
        "r": 0.24,
        "color": "#E0FFF8",
        "opacity": 0.59,
        "delay": "1.37",
        "dur": "1.66"
      },
      {
        "x": -12.1,
        "y": 1.67,
        "r": 0.4,
        "color": "#69F0AE",
        "opacity": 0.51,
        "delay": "4.00",
        "dur": "2.86"
      },
      {
        "x": -12.91,
        "y": 0.54,
        "r": 0.29,
        "color": "#00E676",
        "opacity": 0.86,
        "delay": "1.66",
        "dur": "1.70"
      },
      {
        "x": -12.59,
        "y": 0.04,
        "r": 0.47,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "0.88",
        "dur": "3.19"
      },
      {
        "x": -12.84,
        "y": -1.03,
        "r": 0.32,
        "color": "#E0FFF8",
        "opacity": 0.6,
        "delay": "3.51",
        "dur": "2.69"
      },
      {
        "x": -12.17,
        "y": -1.45,
        "r": 0.28,
        "color": "#00F5FF",
        "opacity": 0.83,
        "delay": "3.37",
        "dur": "3.09"
      },
      {
        "x": -11.2,
        "y": -2.33,
        "r": 0.25,
        "color": "#E0FFF8",
        "opacity": 0.57,
        "delay": "3.48",
        "dur": "1.79"
      },
      {
        "x": -10.24,
        "y": -2.75,
        "r": 0.24,
        "color": "#00F5FF",
        "opacity": 0.66,
        "delay": "0.59",
        "dur": "1.91"
      },
      {
        "x": -8.88,
        "y": -3.53,
        "r": 0.36,
        "color": "#69F0AE",
        "opacity": 0.87,
        "delay": "0.82",
        "dur": "2.66"
      },
      {
        "x": -8.45,
        "y": -3.67,
        "r": 0.33,
        "color": "#E0FFF8",
        "opacity": 0.81,
        "delay": "0.70",
        "dur": "3.29"
      },
      {
        "x": -6.19,
        "y": -4.19,
        "r": 0.54,
        "color": "#00F5FF",
        "opacity": 0.95,
        "delay": "3.31",
        "dur": "2.89"
      },
      {
        "x": -5.37,
        "y": -4.68,
        "r": 0.44,
        "color": "#FFFFFF",
        "opacity": 0.59,
        "delay": "0.67",
        "dur": "3.16"
      },
      {
        "x": -3.01,
        "y": -4.63,
        "r": 0.34,
        "color": "#B9F6CA",
        "opacity": 0.89,
        "delay": "2.05",
        "dur": "1.72"
      },
      {
        "x": -1.48,
        "y": -5.16,
        "r": 0.27,
        "color": "#69F0AE",
        "opacity": 0.89,
        "delay": "0.67",
        "dur": "2.25"
      },
      {
        "x": 1.62,
        "y": -5,
        "r": 0.3,
        "color": "#69F0AE",
        "opacity": 0.94,
        "delay": "3.88",
        "dur": "1.96"
      },
      {
        "x": 3.6,
        "y": -4.88,
        "r": 0.33,
        "color": "#FFFFFF",
        "opacity": 0.65,
        "delay": "2.02",
        "dur": "3.08"
      },
      {
        "x": 4.85,
        "y": -4.69,
        "r": 0.28,
        "color": "#FFFFFF",
        "opacity": 0.77,
        "delay": "0.08",
        "dur": "2.37"
      },
      {
        "x": 6.37,
        "y": -4.13,
        "r": 0.56,
        "color": "#FFFFFF",
        "opacity": 0.95,
        "delay": "1.69",
        "dur": "2.15"
      },
      {
        "x": 7.81,
        "y": -3.71,
        "r": 0.29,
        "color": "#00FF88",
        "opacity": 0.92,
        "delay": "0.26",
        "dur": "1.98"
      },
      {
        "x": 8.72,
        "y": -3.42,
        "r": 0.36,
        "color": "#00FF88",
        "opacity": 0.79,
        "delay": "1.75",
        "dur": "2.34"
      },
      {
        "x": 10.4,
        "y": -3.06,
        "r": 0.34,
        "color": "#69F0AE",
        "opacity": 0.84,
        "delay": "2.84",
        "dur": "2.67"
      },
      {
        "x": 11.53,
        "y": -2.08,
        "r": 0.27,
        "color": "#B9F6CA",
        "opacity": 0.84,
        "delay": "2.64",
        "dur": "2.97"
      },
      {
        "x": 12.43,
        "y": -1.24,
        "r": 0.39,
        "color": "#E0FFF8",
        "opacity": 0.68,
        "delay": "1.14",
        "dur": "2.80"
      },
      {
        "x": 12.83,
        "y": -0.49,
        "r": 0.23,
        "color": "#69F0AE",
        "opacity": 0.6,
        "delay": "1.05",
        "dur": "2.43"
      }
    ]
  }
] as const;

const CORE_SPARKS = [
  {
    "x": 1.5,
    "y": 1.02,
    "r": 0.26,
    "color": "#B9F6CA",
    "opacity": 0.9,
    "delay": "2.24"
  },
  {
    "x": -1.81,
    "y": 2.35,
    "r": 0.24,
    "color": "#00F5FF",
    "opacity": 0.76,
    "delay": "2.05"
  },
  {
    "x": -0.59,
    "y": -0.7,
    "r": 0.43,
    "color": "#69F0AE",
    "opacity": 0.66,
    "delay": "1.13"
  },
  {
    "x": 0.9,
    "y": 3.09,
    "r": 0.22,
    "color": "#B9F6CA",
    "opacity": 0.73,
    "delay": "1.39"
  },
  {
    "x": -2.63,
    "y": 0.25,
    "r": 0.43,
    "color": "#69F0AE",
    "opacity": 0.94,
    "delay": "1.39"
  },
  {
    "x": -1.53,
    "y": 0.84,
    "r": 0.27,
    "color": "#69F0AE",
    "opacity": 0.81,
    "delay": "0.62"
  },
  {
    "x": 0.25,
    "y": -3.31,
    "r": 0.3,
    "color": "#B9F6CA",
    "opacity": 0.91,
    "delay": "1.76"
  },
  {
    "x": -0.62,
    "y": 2.69,
    "r": 0.42,
    "color": "#00FF88",
    "opacity": 0.79,
    "delay": "0.45"
  },
  {
    "x": -1.09,
    "y": -2.1,
    "r": 0.36,
    "color": "#00FF88",
    "opacity": 0.63,
    "delay": "1.76"
  },
  {
    "x": -0.76,
    "y": 1.92,
    "r": 0.23,
    "color": "#69F0AE",
    "opacity": 0.92,
    "delay": "1.21"
  },
  {
    "x": -1.63,
    "y": -0.88,
    "r": 0.32,
    "color": "#B9F6CA",
    "opacity": 0.98,
    "delay": "2.79"
  },
  {
    "x": -1.99,
    "y": -1.53,
    "r": 0.2,
    "color": "#00F5FF",
    "opacity": 0.93,
    "delay": "0.13"
  },
  {
    "x": -0.28,
    "y": -1.24,
    "r": 0.47,
    "color": "#B9F6CA",
    "opacity": 0.87,
    "delay": "2.96"
  },
  {
    "x": -0.05,
    "y": -3.28,
    "r": 0.34,
    "color": "#B9F6CA",
    "opacity": 0.7,
    "delay": "0.04"
  },
  {
    "x": 0.78,
    "y": -0.53,
    "r": 0.32,
    "color": "#00E676",
    "opacity": 0.76,
    "delay": "2.20"
  },
  {
    "x": -2.03,
    "y": -0.47,
    "r": 0.43,
    "color": "#B9F6CA",
    "opacity": 0.8,
    "delay": "1.19"
  },
  {
    "x": 1.29,
    "y": 2.64,
    "r": 0.36,
    "color": "#00FF88",
    "opacity": 0.67,
    "delay": "1.62"
  },
  {
    "x": 1.54,
    "y": -0.22,
    "r": 0.2,
    "color": "#00FF88",
    "opacity": 0.94,
    "delay": "1.04"
  }
] as const;

export function BonaParticleAtom({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-18 -18 36 36"
      className={cn("shrink-0 select-none overflow-visible", className)}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <style>{`
          @keyframes bonaCorePulse {
            0%, 100% {
              transform: scale(0.95);
              opacity: 0.85;
              filter: drop-shadow(0 0 4px rgba(0, 230, 118, 0.6));
            }
            50% {
              transform: scale(1.15);
              opacity: 1;
              filter: drop-shadow(0 0 8px rgba(0, 245, 255, 0.9)) drop-shadow(0 0 14px rgba(0, 230, 118, 0.7));
            }
          }
          @keyframes bonaOrbitSpinA {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes bonaOrbitSpinB {
            from { transform: rotate(60deg); }
            to { transform: rotate(420deg); }
          }
          @keyframes bonaOrbitSpinC {
            from { transform: rotate(120deg); }
            to { transform: rotate(480deg); }
          }
          @keyframes bonaTwinkle {
            0%, 100% { opacity: 0.35; transform: scale(0.85); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          .bona-orbit-a {
            animation: bonaOrbitSpinA 24s linear infinite;
            transform-origin: 0px 0px;
          }
          .bona-orbit-b {
            animation: bonaOrbitSpinB 28s linear infinite reverse;
            transform-origin: 0px 0px;
          }
          .bona-orbit-c {
            animation: bonaOrbitSpinC 32s linear infinite;
            transform-origin: 0px 0px;
          }
          .bona-core {
            animation: bonaCorePulse 3.5s ease-in-out infinite;
            transform-origin: 0px 0px;
          }
          .bona-particle {
            animation: bonaTwinkle var(--spark-dur, 2.2s) ease-in-out infinite var(--spark-delay, 0s);
            transform-box: fill-box;
            transform-origin: center;
          }
        `}</style>
        <filter id="bonaAtomGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bonaQuantumHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="35%" stopColor="#A7FFD7" stopOpacity={0.95} />
          <stop offset="70%" stopColor="#00E676" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="bonaAmbientGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Ambient quantum energy field */}
      <circle r={14} fill="url(#bonaAmbientGlow)" />

      {/* Orbit 1 (0 deg) */}
      <g className="bona-orbit-a">
        <ellipse
          rx={12.5}
          ry={4.8}
          fill="none"
          stroke="#00E676"
          strokeWidth={0.35}
          strokeDasharray="1 2.8"
          opacity={0.25}
        />
        {ORBIT_PARTICLES[0].pts.map((p, idx) => (
          <circle
            key={"o0-" + idx}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.color}
            opacity={p.opacity}
            filter="url(#bonaAtomGlow)"
            className="bona-particle"
            style={{ "--spark-delay": `${p.delay}s`, "--spark-dur": `${p.dur}s` } as React.CSSProperties}
          />
        ))}
      </g>

      {/* Orbit 2 (60 deg) */}
      <g className="bona-orbit-b">
        <ellipse
          rx={12.5}
          ry={4.8}
          fill="none"
          stroke="#00E676"
          strokeWidth={0.35}
          strokeDasharray="1 2.8"
          opacity={0.25}
        />
        {ORBIT_PARTICLES[1].pts.map((p, idx) => (
          <circle
            key={"o1-" + idx}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.color}
            opacity={p.opacity}
            filter="url(#bonaAtomGlow)"
            className="bona-particle"
            style={{ "--spark-delay": `${p.delay}s`, "--spark-dur": `${p.dur}s` } as React.CSSProperties}
          />
        ))}
      </g>

      {/* Orbit 3 (120 deg) */}
      <g className="bona-orbit-c">
        <ellipse
          rx={12.5}
          ry={4.8}
          fill="none"
          stroke="#00E676"
          strokeWidth={0.35}
          strokeDasharray="1 2.8"
          opacity={0.25}
        />
        {ORBIT_PARTICLES[2].pts.map((p, idx) => (
          <circle
            key={"o2-" + idx}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.color}
            opacity={p.opacity}
            filter="url(#bonaAtomGlow)"
            className="bona-particle"
            style={{ "--spark-delay": `${p.delay}s`, "--spark-dur": `${p.dur}s` } as React.CSSProperties}
          />
        ))}
      </g>

      {/* Quantum micro-particles orbiting the nucleus */}
      <g>
        {CORE_SPARKS.map((p, idx) => (
          <circle
            key={"core-sp-" + idx}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.color}
            opacity={p.opacity}
            filter="url(#bonaAtomGlow)"
            className="bona-particle"
            style={{ "--spark-delay": `${p.delay}s`, "--spark-dur": "1.8s" } as React.CSSProperties}
          />
        ))}
      </g>

      {/* Glowing Quantum Nucleus */}
      <g className="bona-core">
        <circle r={3.2} fill="url(#bonaQuantumHalo)" />
        <circle r={1.6} fill="#00F5FF" opacity={0.9} filter="url(#bonaAtomGlow)" />
        <circle r={0.9} fill="#ffffff" />
      </g>
    </svg>
  );
}

// Official WhatsApp vector icon (phone handset inside speech bubble)
export function WhatsAppIcon({ className = "h-7 w-7", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export const WHATSAPP_URL = "https://wa.me/556692734632?text=" + encodeURIComponent("Olá, BonaSoft! Quero falar sobre um projeto.");
export const WHATSAPP_LABEL = "+55 66 9273-4632";
