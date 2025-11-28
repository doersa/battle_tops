import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, AiComment, SpinnerLevel, Vector2, FloatingText, SpinnerEntity, RandomEventType, Explosion, SparkParticle } from './types';
import { 
  GAME_DURATION_SEC, MOCK_LEADERBOARD, RPM_DECAY_RATE, MOVEMENT_FRICTION, WALL_BOUNCE, 
  RPM_PER_CLICK, MAX_RPM_CAP, PUSH_FORCE, SPINNER_RADIUS, SPINNER_MASS, COLLISION_ELASTICITY,
  DAMAGE_FACTOR, ENEMY_AI_SPEED, LEVEL_THRESHOLDS, LEVEL_HP_SCALING, BOSS_HP_MULTIPLIER, BOSS_SIZE_MULTIPLIER, BOSS_MASS_MULTIPLIER,
  PERFECT_WINDOW_THRESHOLD, GOOD_WINDOW_THRESHOLD, PERFECT_BONUS_MULTIPLIER, GOOD_BONUS_MULTIPLIER, BASE_PULSE_SPEED,
  EVENT_CHANCE_PER_FRAME, EVENT_DURATION_MS, EVENT_CONFIG, TAP_NOISE_ANGLE, PLAYER_BASE_HP, MAX_SPEED
} from './constants';
import { generateViralComment } from './services/geminiService';
import { Button } from './components/Button';
import { Leaderboard } from './components/Leaderboard';
import { Spinner3D } from './components/Spinner3D';
import { Trophy, Zap, Share2, RefreshCw, MessageCircle, Swords, Skull, ArrowRight, Flame, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.HOME);
  const [currentLevel, setCurrentLevel] = useState(1);
  
  // These states are only for initialization/infrequent updates, not the game loop
  const [playerInitLevel, setPlayerInitLevel] = useState(SpinnerLevel.IDLE);
  const [enemyInitLevel, setEnemyInitLevel] = useState(SpinnerLevel.NORMAL);
  const [enemyInitScale, setEnemyInitScale] = useState(1);
  const [playerInitScale, setPlayerInitScale] = useState(1);
  
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
  const [score, setScore] = useState(0);
  const [battleOutcome, setBattleOutcome] = useState<'WIN' | 'LOSS' | 'DRAW'>('DRAW');
  
  const [activeEvent, setActiveEvent] = useState<RandomEventType>('NONE');
  const [eventTimeLeft, setEventTimeLeft] = useState(0);

  const [aiResult, setAiResult] = useState<AiComment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [explosions, setExplosionState] = useState<Explosion[]>([]);
  
  // --- DIRECT DOM REFS FOR 60FPS PERFORMANCE ---
  // We bypass React State for movement to ensure zero lag on mobile
  const playerDomRef = useRef<HTMLDivElement>(null);
  const enemyDomRef = useRef<HTMLDivElement>(null);
  const playerHpBarRef = useRef<HTMLDivElement>(null);
  const enemyHpBarRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLDivElement>(null);
  const enemyHpTextRef = useRef<HTMLSpanElement>(null);
  const playerHpTextRef = useRef<HTMLSpanElement>(null);

  // Physics Refs
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const floatingTextIdRef = useRef<number>(0);
  const eventTimerRef = useRef<number>(0); 
  const pulseRef = useRef<number>(0);
  const explosionIdRef = useRef<number>(0);

  // Entity Data Refs (Single Source of Truth)
  const playerRef = useRef<SpinnerEntity>({
    id: 'player', pos: { x: 0, y: 100 }, vel: { x: 0, y: 0 }, rpm: 0, 
    hp: PLAYER_BASE_HP, maxHp: PLAYER_BASE_HP, radius: SPINNER_RADIUS, mass: SPINNER_MASS, level: SpinnerLevel.IDLE, wobble: 0, rotationZ: 0, scale: 1 
  });
  
  const enemyRef = useRef<SpinnerEntity>({
    id: 'enemy', pos: { x: 0, y: -100 }, vel: { x: 0, y: 0 }, rpm: 800, 
    hp: 100, maxHp: 100, radius: SPINNER_RADIUS, mass: SPINNER_MASS, level: SpinnerLevel.HEATED, wobble: 0, rotationZ: 0, scale: 1 
  });

  // --- Helpers ---
  const getSpinnerLevel = (rpm: number): SpinnerLevel => {
    if (rpm >= LEVEL_THRESHOLDS[SpinnerLevel.SINGULARITY]) return SpinnerLevel.SINGULARITY;
    if (rpm >= LEVEL_THRESHOLDS[SpinnerLevel.PLASMA]) return SpinnerLevel.PLASMA;
    if (rpm >= LEVEL_THRESHOLDS[SpinnerLevel.SUPERSONIC]) return SpinnerLevel.SUPERSONIC;
    if (rpm >= LEVEL_THRESHOLDS[SpinnerLevel.HEATED]) return SpinnerLevel.HEATED;
    if (rpm >= LEVEL_THRESHOLDS[SpinnerLevel.NORMAL]) return SpinnerLevel.NORMAL;
    return SpinnerLevel.IDLE;
  };

  const triggerRandomEvent = () => {
    const events: RandomEventType[] = ['GRAVITY_SURGE', 'BERSERK', 'SUDDEN_DEATH', 'SLIPPERY', 'HYPER_CHARGE'];
    const randomEvent = events[Math.floor(Math.random() * events.length)];
    
    // Apply Instant Effects
    if (randomEvent === 'HYPER_CHARGE') {
      playerRef.current.rpm = MAX_RPM_CAP;
      enemyRef.current.rpm = MAX_RPM_CAP;
    }
    if (randomEvent === 'BERSERK') {
      playerRef.current.scale = 1.5;
      playerRef.current.mass = SPINNER_MASS * 2;
      playerRef.current.radius = SPINNER_RADIUS * 1.5;
      // Trigger react update for scale visualization
      setPlayerInitScale(1.5);
    }

    setActiveEvent(randomEvent);
    eventTimerRef.current = EVENT_DURATION_MS;
    spawnFloatingText(0, -50, EVENT_CONFIG[randomEvent].name, 'event');
  };

  const clearActiveEvent = () => {
    if (activeEvent === 'BERSERK') {
      playerRef.current.scale = 1;
      playerRef.current.mass = SPINNER_MASS;
      playerRef.current.radius = SPINNER_RADIUS;
      setPlayerInitScale(1);
    }
    setActiveEvent('NONE');
    setEventTimeLeft(0);
  };

  const spawnExplosion = (x: number, y: number, intensity: number) => {
    const screenX = (window.innerWidth / 2) + x;
    const screenY = (window.innerHeight / 2) + y;
    
    // Generate Spark Particles
    const numSparks = 8 + Math.floor(Math.random() * 8); // 8-16 sparks
    const sparks: SparkParticle[] = [];
    
    for (let i = 0; i < numSparks; i++) {
      sparks.push({
        angle: Math.random() * 360,
        distance: 40 + Math.random() * 80 * (intensity > 500 ? 1.5 : 1), // Higher RPM = further sparks
        color: Math.random() > 0.5 ? '#fbbf24' : '#ef4444', // Yellow or Red
        size: 2 + Math.random() * 3,
        speed: 0.3 + Math.random() * 0.3
      });
    }

    const newExplosion: Explosion = {
      id: explosionIdRef.current++,
      x: screenX,
      y: screenY,
      sparks
    };

    setExplosionState(prev => [...prev, newExplosion]);
    
    setTimeout(() => {
      setExplosionState(prev => prev.filter(e => e.id !== newExplosion.id));
    }, 500);
  };

  // --- Main Physics Loop ---
  const animate = (time: number) => {
    if (gameState !== GameState.PLAYING) return;

    if (lastTimeRef.current !== undefined) {
      // Clamp deltaTime to prevent physics explosions on lag
      const deltaMs = Math.min(time - lastTimeRef.current, 60); 
      const deltaTime = deltaMs / 16.6; 
      
      const entities = [playerRef.current, enemyRef.current];

      // Event Timer
      if (activeEvent === 'NONE') {
         if (Math.random() < EVENT_CHANCE_PER_FRAME) triggerRandomEvent();
      } else {
         eventTimerRef.current -= deltaMs;
         if (eventTimerRef.current <= 0) clearActiveEvent();
         if (Math.floor(eventTimerRef.current/1000) !== eventTimeLeft) {
            setEventTimeLeft(Math.ceil(eventTimerRef.current / 1000));
         }
      }

      // --- 1. Physics Update ---
      entities.forEach(ent => {
        let friction = MOVEMENT_FRICTION;
        if (activeEvent === 'SLIPPERY') friction = 0.995; 
        
        if (ent.rpm > 0) {
          ent.rpm *= RPM_DECAY_RATE;
          if (ent.rpm < 10) ent.rpm = 0;
        }
        
        // Stun Recovery
        if (ent.stunTime && ent.stunTime > 0) {
          ent.stunTime -= deltaMs;
          if (ent.stunTime <= 0) {
             ent.stunTime = 0;
          }
        }

        // Update Level locally for colors
        const newLevel = getSpinnerLevel(ent.rpm);
        if (newLevel !== ent.level) {
          ent.level = newLevel;
          if (ent.id === 'player') setPlayerInitLevel(newLevel);
          if (ent.id === 'enemy') setEnemyInitLevel(newLevel);
        }
        
        // Rotation Calculation
        const rotationSpeed = (ent.rpm / 60) * 360 * (1/60); 
        ent.rotationZ = (ent.rotationZ + rotationSpeed) % 360;
        
        // --- Wobble / Precession Logic ---
        const stabilityThreshold = 1500;
        const stability = Math.max(0, Math.min(ent.rpm / stabilityThreshold, 1));
        const precessionSpeed = 0.2 - (0.15 * stability);
        ent.wobble = (ent.wobble + precessionSpeed * deltaTime) % (Math.PI * 2);

        // Position Integration
        ent.pos.x += ent.vel.x * deltaTime;
        ent.pos.y += ent.vel.y * deltaTime;
        ent.vel.x *= friction;
        ent.vel.y *= friction;

        // VELOCITY CLAMPING (Speed Limit)
        const currentSpeed = Math.sqrt(ent.vel.x * ent.vel.x + ent.vel.y * ent.vel.y);
        if (currentSpeed > MAX_SPEED) {
           const scale = MAX_SPEED / currentSpeed;
           ent.vel.x *= scale;
           ent.vel.y *= scale;
        }

        if (activeEvent === 'GRAVITY_SURGE') {
           ent.vel.x -= (ent.pos.x * 0.005) * deltaTime;
           ent.vel.y -= (ent.pos.y * 0.005) * deltaTime;
        }

        if (activeEvent === 'SUDDEN_DEATH' && Math.random() < 0.1) {
           ent.hp = Math.max(0, ent.hp - 0.05 * deltaTime);
           updateHpBar(ent.id, ent.hp, ent.maxHp);
        }

        // Bounds
        const boundsX = (window.innerWidth / 2) - ent.radius; 
        const boundsY = (window.innerHeight / 2) - 100; 

        if (ent.pos.x > boundsX) { ent.pos.x = boundsX; ent.vel.x *= -WALL_BOUNCE; }
        if (ent.pos.x < -boundsX) { ent.pos.x = -boundsX; ent.vel.x *= -WALL_BOUNCE; }
        if (ent.pos.y > boundsY) { ent.pos.y = boundsY; ent.vel.y *= -WALL_BOUNCE; }
        if (ent.pos.y < -boundsY) { ent.pos.y = -boundsY; ent.vel.y *= -WALL_BOUNCE; }
      });

      // --- 2. AI (With Stun Check) ---
      const enemy = enemyRef.current;
      const player = playerRef.current;
      
      const isStunned = enemy.stunTime && enemy.stunTime > 0;

      if (!isStunned) {
        if (enemy.rpm < 2000) enemy.rpm += 20 * deltaTime; 
        
        const dx = player.pos.x - enemy.pos.x;
        const dy = player.pos.y - enemy.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Mercy Logic: Slow down if player is weak
        const isPlayerWeak = player.hp < player.maxHp * 0.3;
        const mercyFactor = isPlayerWeak ? 0.5 : 1.0;
        
        // Level Scaling
        const levelFactor = Math.min(1.0, 0.4 + (currentLevel * 0.1)); // Caps at 1.0 around lvl 6

        const aiSpeed = (activeEvent === 'SLIPPERY' ? ENEMY_AI_SPEED * 0.2 : ENEMY_AI_SPEED) * mercyFactor * levelFactor;
        
        if (dist > 0) {
          enemy.vel.x += (dx / dist) * aiSpeed * deltaTime;
          enemy.vel.y += (dy / dist) * aiSpeed * deltaTime;
        }
      }

      // --- 3. Collision ---
      const dx = player.pos.x - enemy.pos.x;
      const dy = player.pos.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < (player.radius + enemy.radius)) {
         const overlap = (player.radius + enemy.radius) - dist;
         const nx = dx / dist;
         const ny = dy / dist;
         
         player.pos.x += nx * overlap * 0.5;
         player.pos.y += ny * overlap * 0.5;
         enemy.pos.x -= nx * overlap * 0.5;
         enemy.pos.y -= ny * overlap * 0.5;

         const pVel = player.vel;
         const eVel = enemy.vel;
         
         const vRelX = pVel.x - eVel.x;
         const vRelY = pVel.y - eVel.y;
         const vRelDotN = vRelX * nx + vRelY * ny;

         if (vRelDotN < 0) { 
           const impulse = (-(1 + COLLISION_ELASTICITY) * vRelDotN) / (1/player.mass + 1/enemy.mass);
           
           player.vel.x += (impulse / player.mass) * nx;
           player.vel.y += (impulse / player.mass) * ny;
           enemy.vel.x -= (impulse / enemy.mass) * nx;
           enemy.vel.y -= (impulse / enemy.mass) * ny;

           const impactForce = Math.abs(impulse) * 2;
           const rpmDiffRatio = (player.rpm + 500) / (enemy.rpm + 500); 
           
           let playerDamage = impactForce * DAMAGE_FACTOR * (1/rpmDiffRatio);
           let enemyDamage = impactForce * DAMAGE_FACTOR * rpmDiffRatio;

           if (activeEvent === 'SUDDEN_DEATH') {
             playerDamage *= 2;
             enemyDamage *= 2;
           }

           player.hp = Math.max(0, player.hp - playerDamage);
           enemy.hp = Math.max(0, enemy.hp - enemyDamage);
           
           updateHpBar('player', player.hp, player.maxHp);
           updateHpBar('enemy', enemy.hp, enemy.maxHp);

           const scoreGain = Math.floor(enemyDamage * 10 * currentLevel);
           setScore(prev => prev + scoreGain);
           
           player.rpm *= 0.9;
           enemy.rpm *= 0.9;

           // Calculate mid-point for effects
           const contactX = (player.pos.x + enemy.pos.x) / 2;
           const contactY = (player.pos.y + enemy.pos.y) / 2;
           
           // Trigger Explosion & Sparks
           spawnExplosion(contactX, contactY, impactForce);

           spawnFloatingText(enemy.pos.x, enemy.pos.y, `-${Math.floor(enemyDamage)}`, 'damage');
           if (enemyDamage > 10) {
             spawnFloatingText(enemy.pos.x, enemy.pos.y - 20, "CRITICAL!", 'critical');
             enemy.stunTime = 1000; // 1s Stun
           }
         }
      }

      // --- 4. Render Updates (DOM Manipulation) ---
      const applySpinnerTransform = (dom: HTMLDivElement | null, ent: SpinnerEntity) => {
        if (!dom) return;
        
        const stabilityThreshold = 1500;
        const stability = Math.max(0, Math.min(ent.rpm / stabilityThreshold, 1));
        
        const baseTilt = 45; 
        const maxWobbleDeg = 15; 
        const wobbleAmount = (1 - Math.sqrt(stability)) * maxWobbleDeg; 

        const tiltX = Math.sin(ent.wobble) * wobbleAmount;
        const tiltY = Math.cos(ent.wobble) * wobbleAmount;

        // Apply Stun visual (grey scale + shake)
        const isStunned = ent.stunTime && ent.stunTime > 0;
        const stunShake = isStunned ? `translate(${Math.random()*4-2}px, ${Math.random()*4-2}px)` : '';
        const grayscale = isStunned ? 'grayscale(100%) brightness(0.7)' : 'none';
        
        dom.style.filter = grayscale;
        dom.style.transform = `translate(-50%, -50%) translate(${ent.pos.x}px, ${ent.pos.y}px) ${stunShake} rotateX(${baseTilt + tiltX}deg) rotateY(${tiltY}deg) rotateZ(${ent.rotationZ}deg)`;
        
        dom.style.setProperty('--rpm-glow', String(Math.min(ent.rpm / 2500, 1.0)));
      };

      applySpinnerTransform(playerDomRef.current, playerRef.current);
      applySpinnerTransform(enemyDomRef.current, enemyRef.current);

      // --- 5. Pulse Visuals ---
      const pulseSpeed = (BASE_PULSE_SPEED + (player.rpm / 15000)) * deltaTime;
      pulseRef.current = (pulseRef.current + pulseSpeed) % (Math.PI * 2);
      
      if (pulseRingRef.current) {
         const pulseVal = Math.sin(pulseRef.current); 
         const scale = 1.05 + (0.25 * (pulseVal + 1) / 2);
         pulseRingRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
         
         if (pulseVal > PERFECT_WINDOW_THRESHOLD) {
            pulseRingRef.current.style.borderColor = '#fbbf24'; 
            pulseRingRef.current.style.borderWidth = '4px';
            pulseRingRef.current.style.boxShadow = '0 0 30px rgba(251, 191, 36, 0.6)';
         } else {
            pulseRingRef.current.style.borderColor = 'rgba(6,182,212, 0.4)';
            pulseRingRef.current.style.borderWidth = '2px';
            pulseRingRef.current.style.boxShadow = '0 0 10px rgba(6,182,212, 0.2)';
         }
      }

      // Game End Checks
      if (playerRef.current.hp <= 0) {
        setBattleOutcome('LOSS');
        endGame();
      } else if (enemyRef.current.hp <= 0) {
        setBattleOutcome('WIN');
        endLevel();
      }
    }

    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  // Optimized HP Update (Throttled via Refs)
  const updateHpBar = (id: string, current: number, max: number) => {
    const pct = Math.max(0, (current / max) * 100);
    if (id === 'player') {
      if (playerHpBarRef.current) playerHpBarRef.current.style.width = `${pct}%`;
      if (playerHpTextRef.current) playerHpTextRef.current.innerText = `${Math.floor(pct)}%`;
    } else {
      if (enemyHpBarRef.current) enemyHpBarRef.current.style.width = `${pct}%`;
      if (enemyHpTextRef.current) enemyHpTextRef.current.innerText = `${Math.floor(current)}/${Math.floor(max)}`;
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, type: FloatingText['type']) => {
      const screenX = (window.innerWidth / 2) + x;
      const screenY = (window.innerHeight / 2) + y;

      const newText: FloatingText = {
        id: floatingTextIdRef.current++,
        x: screenX,
        y: screenY,
        text,
        type
      };
      setFloatingTexts(prev => [...prev, newText]);
      setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== newText.id));
      }, type === 'event' ? 2000 : 800);
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
      // Force initial render updates
      updateHpBar('player', playerRef.current.hp, playerRef.current.maxHp);
      updateHpBar('enemy', enemyRef.current.hp, enemyRef.current.maxHp);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  useEffect(() => {
    let timer: number;
    if (gameState === GameState.PLAYING && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (playerRef.current.hp > enemyRef.current.hp) {
               setBattleOutcome('WIN');
               endLevel();
            } else if (playerRef.current.hp < enemyRef.current.hp) {
               setBattleOutcome('LOSS');
               endGame();
            } else {
               setBattleOutcome('DRAW');
               endGame();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  // --- Game Control ---
  const startGame = (level: number) => {
    setCurrentLevel(level);
    
    const hpMultiplier = Math.pow(LEVEL_HP_SCALING, level - 1);
    const isBoss = level % 5 === 0;
    
    const enemyBaseHp = 100 * hpMultiplier * (isBoss ? BOSS_HP_MULTIPLIER : 1);
    const enemyMass = SPINNER_MASS * (isBoss ? BOSS_MASS_MULTIPLIER : 1);
    const enemyRadius = SPINNER_RADIUS * (isBoss ? BOSS_SIZE_MULTIPLIER : 1);
    const enemyScale = isBoss ? BOSS_SIZE_MULTIPLIER : 1;

    // Reset Player
    playerRef.current = {
      id: 'player', pos: { x: 0, y: 150 }, vel: { x: 0, y: 0 }, rpm: 0, 
      hp: PLAYER_BASE_HP, maxHp: PLAYER_BASE_HP, radius: SPINNER_RADIUS, mass: SPINNER_MASS, level: SpinnerLevel.IDLE, wobble: 0, rotationZ: 0, scale: 1 
    };
    
    // Init Enemy
    enemyRef.current = {
      id: 'enemy', pos: { x: 0, y: -150 }, vel: { x: 0, y: 0 }, rpm: 500 + (level * 100), 
      hp: enemyBaseHp, maxHp: enemyBaseHp, 
      radius: enemyRadius, mass: enemyMass, scale: enemyScale,
      level: isBoss ? SpinnerLevel.SINGULARITY : SpinnerLevel.NORMAL, 
      wobble: 0, rotationZ: 0 
    };

    setEnemyInitScale(enemyScale);
    setPlayerInitScale(1);
    setPlayerInitLevel(SpinnerLevel.IDLE);
    setEnemyInitLevel(isBoss ? SpinnerLevel.SINGULARITY : SpinnerLevel.NORMAL);
    
    pulseRef.current = 0;
    if (level === 1) setScore(0);
    
    setTimeLeft(GAME_DURATION_SEC);
    setFloatingTexts([]);
    setExplosionState([]); // Reset explosions
    setAiResult(null);
    clearActiveEvent();
    setGameState(GameState.PLAYING);
  };

  const endLevel = () => setGameState(GameState.LEVEL_COMPLETE);
  const endGame = useCallback(() => setGameState(GameState.RESULT), []);
  const nextLevel = () => startGame(currentLevel + 1);

  useEffect(() => {
    if (gameState === GameState.RESULT) {
      const fetchAi = async () => {
        setIsGenerating(true);
        const result = await generateViralComment(score, battleOutcome);
        setAiResult(result);
        setIsGenerating(false);
      };
      fetchAi();
    }
  }, [gameState, battleOutcome, score]);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== GameState.PLAYING) return;
    
    // Check if event is valid touch to prevent ghost clicks
    if (e.type === 'touchstart') {
       // e.preventDefault(); // Optional: might block scrolling if needed
    }

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const gameX = clientX - (window.innerWidth / 2);
    const gameY = clientY - (window.innerHeight / 2);

    const player = playerRef.current;
    const enemy = enemyRef.current;
    
    const dx = enemy.pos.x - player.pos.x;
    const dy = enemy.pos.y - player.pos.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    let nx = dist > 0 ? dx / dist : 0;
    let ny = dist > 0 ? dy / dist : 1;

    // Control Noise
    const noiseAngle = (Math.random() - 0.5) * TAP_NOISE_ANGLE; 
    const cosA = Math.cos(noiseAngle);
    const sinA = Math.sin(noiseAngle);
    
    const noisyNx = nx * cosA - ny * sinA;
    const noisyNy = nx * sinA + ny * cosA;

    player.vel.x += noisyNx * PUSH_FORCE;
    player.vel.y += noisyNy * PUSH_FORCE;

    // RPM Bonus & Visual Feedback
    const pulsePhase = Math.sin(pulseRef.current);
    let rpmGain = RPM_PER_CLICK;

    if (pulsePhase > PERFECT_WINDOW_THRESHOLD) {
      rpmGain *= PERFECT_BONUS_MULTIPLIER;
      spawnFloatingText(gameX, gameY, "PERFECT! ⚡", 'perfect');
    } else if (pulsePhase > GOOD_WINDOW_THRESHOLD) {
      rpmGain *= GOOD_BONUS_MULTIPLIER;
      spawnFloatingText(gameX, gameY, "GOOD!", 'good');
    }

    player.rpm = Math.min(player.rpm + rpmGain, MAX_RPM_CAP);
    
    // Add Impulse Visual (Reuse floating text for simplicity or add dedicated particle system)
    // For now, simpler is better for perf.
  };

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-gray-900">
      <div className="z-10 text-center space-y-8 max-w-md w-full animate-in fade-in zoom-in duration-500">
        <div className="space-y-4">
          <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
             <Swords className="w-24 h-24 text-cyan-400 animate-pulse" />
          </div>
          <h1 className="text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-red-600 leading-tight drop-shadow-2xl">
            BATTLE<br/>TOPS
          </h1>
          <p className="text-gray-400 text-lg">Stage {currentLevel}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-700/50 shadow-2xl">
          <Leaderboard data={MOCK_LEADERBOARD} />
        </div>
        <Button onClick={() => startGame(1)} fullWidth className="text-xl h-16 shadow-cyan-500/20 bg-gradient-to-r from-red-600 to-cyan-600 hover:from-red-500 hover:to-cyan-500 text-white border-2 border-white/10">
          <Swords className="w-6 h-6 mr-2" />
          START GAME
        </Button>
      </div>
    </div>
  );

  const renderGame = () => {
    const isBoss = currentLevel % 5 === 0;

    return (
      <div 
        className="flex flex-col h-screen bg-gray-900 relative touch-none select-none overflow-hidden perspective-1000"
        onMouseDown={handleTap}
        onTouchStart={handleTap}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-0 bottom-0 left-0 right-0 bg-[size:50px_50px] transition-colors duration-1000 ${isBoss ? 'bg-[linear-gradient(rgba(220,38,38,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(220,38,38,0.1)_1px,transparent_1px)]' : 'bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]'}`}></div>
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[70%] border-4 rounded-[50px] opacity-50 ${isBoss ? 'border-red-900' : 'border-gray-800'}`}></div>
        </div>

        {isBoss && <div className="absolute top-20 left-1/2 -translate-x-1/2 text-red-500/20 font-black text-9xl tracking-widest pointer-events-none z-0">BOSS</div>}

        {activeEvent !== 'NONE' && (
           <div className="absolute top-32 left-0 right-0 z-30 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-5">
              <div 
                className="px-6 py-2 rounded-lg font-black text-xl text-white shadow-xl flex items-center gap-2 border-2"
                style={{ backgroundColor: EVENT_CONFIG[activeEvent].color, borderColor: 'rgba(255,255,255,0.3)' }}
              >
                <AlertTriangle size={24} className="animate-bounce" />
                {EVENT_CONFIG[activeEvent].name}
              </div>
           </div>
        )}

        {/* Explosions & Sparks Layer */}
        {explosions.map(ex => (
          <div key={ex.id} style={{ left: ex.x, top: ex.y }} className="absolute z-40 pointer-events-none">
             {/* Main Flash */}
             <div className="absolute -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-yellow-200/50 rounded-full blur-xl explode-anim"></div>
             {/* Sparks */}
             {ex.sparks.map((spark, i) => (
                <div 
                  key={i} 
                  className="spark-anim"
                  style={{
                    width: spark.size,
                    height: spark.size * 3,
                    background: spark.color,
                    '--rot': `${spark.angle}deg`,
                    '--dist': `${spark.distance}px`,
                    '--dur': `${spark.speed}s`
                  } as React.CSSProperties}
                ></div>
             ))}
          </div>
        ))}

        {floatingTexts.map(ft => (
          <div 
            key={ft.id}
            className="absolute pointer-events-none z-50 font-black italic tracking-tighter"
            style={{ 
              left: ft.x, 
              top: ft.y,
              color: ft.type === 'damage' ? '#ef4444' : ft.type === 'perfect' ? '#fbbf24' : ft.type === 'event' ? '#c084fc' : (ft.type === 'good' ? '#34d399' : 'white'),
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              fontSize: ft.type === 'critical' || ft.type === 'event' ? '32px' : '20px',
              animation: 'float 0.8s ease-out forwards',
              transform: 'translate(-50%, -50%)'
            }}
          >
            {ft.text}
          </div>
        ))}

        {/* HUD - Uses Refs for HP Bars to avoid Re-renders */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-start z-20 pointer-events-none">
          <div className="flex flex-col w-32">
             <div className="flex justify-between text-xs text-cyan-400 font-bold mb-1">
               <span>YOU</span>
               <span ref={playerHpTextRef}>100%</span>
             </div>
             <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
               <div ref={playerHpBarRef} className="h-full bg-cyan-500 transition-none" style={{ width: '100%' }}></div>
             </div>
          </div>

          <div className="flex flex-col items-center">
            <span className={`text-4xl font-black font-mono ${timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {timeLeft}
            </span>
            <span className="text-yellow-500 font-bold text-sm tracking-wider">LVL {currentLevel}</span>
          </div>
          
          <div className="flex flex-col w-32 items-end">
             <div className="flex justify-between w-full text-xs text-red-400 font-bold mb-1">
               <span ref={enemyHpTextRef}>100%</span>
               <span>{isBoss ? 'BOSS' : 'ENEMY'}</span>
             </div>
             <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700 w-full">
               <div ref={enemyHpBarRef} className="h-full bg-red-500 transition-none" style={{ width: '100%' }}></div>
             </div>
          </div>
        </div>

        {/* 3D Game Area */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '800px' }}>
          
          <div 
             ref={pulseRingRef}
             className="absolute top-1/2 left-1/2 w-80 h-80 rounded-full border-2 border-cyan-500/40 transition-colors duration-100 will-change-transform opacity-30"
          ></div>

          <Spinner3D 
            ref={playerDomRef}
            level={playerInitLevel}
            scale={playerInitScale}
            type="player"
          />

          <Spinner3D 
            ref={enemyDomRef}
            level={enemyInitLevel}
            scale={enemyInitScale}
            type="enemy"
          />

          {score === 0 && timeLeft > 40 && (
            <div className="absolute top-3/4 text-center animate-bounce opacity-70">
               <p className="text-white font-bold text-sm bg-black/50 px-3 py-1 rounded-full">TAP TO ATTACK</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLevelComplete = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900/90 backdrop-blur text-center p-8 animate-in zoom-in duration-300">
       <Trophy className="w-24 h-24 text-yellow-400 mb-4 animate-bounce" />
       <h2 className="text-4xl font-black text-white italic mb-2">STAGE CLEARED!</h2>
       <p className="text-gray-300 mb-8">Ready for the next challenger?</p>
       <Button onClick={nextLevel} className="text-xl px-12 py-4 bg-gradient-to-r from-green-500 to-emerald-600">
         NEXT LEVEL <ArrowRight className="ml-2" />
       </Button>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col items-center min-h-screen p-6 bg-gray-900 overflow-y-auto">
      <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom duration-500">
        <div className="text-center pt-8">
           <div className={`inline-block p-4 rounded-full mb-4 border shadow-xl ${battleOutcome === 'WIN' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-500' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
             {battleOutcome === 'WIN' ? <Trophy className="w-12 h-12" /> : <Skull className="w-12 h-12" />}
           </div>
           <h2 className={`text-3xl font-black uppercase tracking-widest ${battleOutcome === 'WIN' ? 'text-yellow-400' : 'text-gray-400'}`}>
             {battleOutcome === 'WIN' ? 'VICTORY' : 'DEFEATED'}
           </h2>
           <p className="text-gray-500 font-bold mt-2">Reached Level {currentLevel}</p>
        </div>

        <div className="bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center relative overflow-hidden group">
           <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${battleOutcome === 'WIN' ? 'from-yellow-400 to-orange-500' : 'from-gray-600 to-gray-800'}`}></div>
           <div className="text-6xl font-black text-white font-mono mb-2 tracking-tighter drop-shadow-lg">
             {score}
           </div>
           <p className="text-gray-500 text-sm font-bold uppercase mb-6">Total Score</p>
           
           <div className="bg-black/40 rounded-xl p-5 min-h-[140px] flex flex-col justify-center items-center relative overflow-hidden border border-white/5">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
                  <span className="text-xs animate-pulse font-mono">ANALYZING BATTLE DATA...</span>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 leading-tight">
                    {aiResult?.title || "Spinner"}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed italic">
                    "{aiResult?.comment}"
                  </p>
                  <div className="absolute bottom-2 right-3 flex items-center gap-1 opacity-40">
                     <Zap size={10} className="text-yellow-400" />
                     <span className="text-[10px] uppercase text-yellow-400 font-bold">AI Generated</span>
                  </div>
                </>
              )}
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="primary" onClick={() => alert('Shared!')} className="bg-gradient-to-r from-green-600 to-emerald-600">
            <Share2 className="w-4 h-4" /> Share
          </Button>
          <Button variant="secondary" onClick={() => startGame(1)} className="bg-gray-700 border-gray-600">
            <RefreshCw className="w-4 h-4" /> Restart
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {gameState === GameState.HOME && renderHome()}
      {gameState === GameState.PLAYING && renderGame()}
      {gameState === GameState.LEVEL_COMPLETE && renderLevelComplete()}
      {gameState === GameState.RESULT && renderResult()}
    </>
  );
};

export default App;