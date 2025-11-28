export enum GameState {
  HOME = 'HOME',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE', // New state for between levels
  RESULT = 'RESULT',
}

export enum SpinnerLevel {
  IDLE = 'IDLE',          // 0 RPM
  NORMAL = 'NORMAL',      // 1-300 RPM
  HEATED = 'HEATED',      // 300-600 RPM
  SUPERSONIC = 'SUPERSONIC', // 600-900 RPM
  PLASMA = 'PLASMA',      // 900-1200 RPM
  SINGULARITY = 'SINGULARITY' // > 1200 RPM
}

export type RandomEventType = 'GRAVITY_SURGE' | 'BERSERK' | 'SUDDEN_DEATH' | 'SLIPPERY' | 'HYPER_CHARGE' | 'NONE';

export interface SpinnerEntity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  rpm: number;
  maxHp: number;
  hp: number;
  radius: number;
  mass: number;
  level: SpinnerLevel;
  wobble: number; // visual state
  rotationZ: number; // visual state
  scale: number; // For Bosses or Events
  stunTime?: number; // Time remaining for stun
}

export interface FriendRank {
  id: number;
  name: string;
  avatar: string; // URL
  score: number; // Represents Battle Score
  isUser?: boolean;
}

export interface AiComment {
  title: string;
  comment: string;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  type: 'perfect' | 'good' | 'normal' | 'damage' | 'critical' | 'event';
}

export interface SparkParticle {
  angle: number;
  distance: number;
  color: string;
  size: number;
  speed: number;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  sparks: SparkParticle[];
}