import { FriendRank, AiComment, SpinnerLevel, RandomEventType } from './types';

export const GAME_DURATION_SEC = 45; 

// Physics Constants
export const RPM_DECAY_RATE = 0.985; 
export const MOVEMENT_FRICTION = 0.975; // Increased drag (was 0.985) for "heavy" feel
export const WALL_BOUNCE = 0.6; // Less bouncy walls (was 0.7)
export const RPM_PER_CLICK = 180;    
export const MAX_RPM_CAP = 3500;    
export const PUSH_FORCE = 20; // Drastically reduced from 60 to prevent teleporting
export const MAX_SPEED = 25; // New: Speed limit to prevent chaos

// Battle Constants
export const PLAYER_BASE_HP = 200; 
export const SPINNER_RADIUS = 50; 
export const SPINNER_MASS = 1.0;
export const COLLISION_ELASTICITY = 0.85; 
export const DAMAGE_FACTOR = 0.06; 
export const ENEMY_AI_SPEED = 0.35; 

// Leveling & Boss Constants
export const LEVEL_HP_SCALING = 1.2; 
export const BOSS_HP_MULTIPLIER = 2.5; 
export const BOSS_SIZE_MULTIPLIER = 1.5; 
export const BOSS_MASS_MULTIPLIER = 2.0; 

// Event Constants
export const EVENT_CHANCE_PER_FRAME = 0.002; 
export const EVENT_DURATION_MS = 5000;

export const EVENT_CONFIG: Record<RandomEventType, { name: string, color: string, desc: string }> = {
  GRAVITY_SURGE: { name: "GRAVITY SURGE", color: "#8b5cf6", desc: "Pulling to Center!" },
  BERSERK: { name: "GIANT MODE", color: "#fbbf24", desc: "You are HUGE!" },
  SUDDEN_DEATH: { name: "SUDDEN DEATH", color: "#ef4444", desc: "HP Draining!" },
  SLIPPERY: { name: "ZERO FRICTION", color: "#3b82f6", desc: "Icy Floor!" },
  HYPER_CHARGE: { name: "HYPER CHARGE", color: "#ec4899", desc: "MAX RPM!" },
  NONE: { name: "", color: "", desc: "" }
};

// Bonus / Perfect Click Constants
export const PERFECT_WINDOW_THRESHOLD = 0.90; 
export const GOOD_WINDOW_THRESHOLD = 0.60;
export const PERFECT_BONUS_MULTIPLIER = 2.0;
export const GOOD_BONUS_MULTIPLIER = 1.3;
export const BASE_PULSE_SPEED = 0.08;

// Control Noise (Radials)
export const TAP_NOISE_ANGLE = 0.2; 

export const LEVEL_THRESHOLDS = {
  [SpinnerLevel.NORMAL]: 1,
  [SpinnerLevel.HEATED]: 500,
  [SpinnerLevel.SUPERSONIC]: 1000,
  [SpinnerLevel.PLASMA]: 1800,
  [SpinnerLevel.SINGULARITY]: 2500,
};

// Simulated WeChat Friends
export const MOCK_LEADERBOARD: FriendRank[] = [
  { id: 1, name: "Battle King", avatar: "https://picsum.photos/50/50?random=1", score: 55000 },
  { id: 2, name: "Crusher", avatar: "https://picsum.photos/50/50?random=2", score: 28400 },
  { id: 3, name: "Iron Top", avatar: "https://picsum.photos/50/50?random=3", score: 15200 },
  { id: 4, name: "Rookie", avatar: "https://picsum.photos/50/50?random=4", score: 5200 },
];

export const FALLBACK_AI_COMMENTS: AiComment[] = [
  { title: "Scrap Metal", comment: "You got dismantled into spare parts." },
  { title: "Arena Champion", comment: "Total dominance! The arena is yours." },
  { title: "Lucky Survivor", comment: "You survived, but just barely." },
];