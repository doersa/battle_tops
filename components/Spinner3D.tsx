import React, { forwardRef } from 'react';
import { SpinnerLevel } from '../types';
import { SPINNER_RADIUS } from '../constants';

interface Spinner3DProps {
  level: SpinnerLevel;
  type: 'player' | 'enemy';
  scale?: number;
  isGhost?: boolean;
}

// Using forwardRef to allow parent (App.tsx) to manipulate DOM directly for 60fps performance
export const Spinner3D = forwardRef<HTMLDivElement, Spinner3DProps>(({ 
  level,
  type,
  scale = 1,
  isGhost = false
}, ref) => {
  const getLevelColor = (lvl: SpinnerLevel, isEnemy: boolean) => {
    if (isEnemy) {
      // Enemy Colors (Red/Orange theme)
      switch (lvl) {
        case SpinnerLevel.SINGULARITY: return 'from-white via-orange-400 to-red-600';
        case SpinnerLevel.PLASMA: return 'from-red-500 to-rose-600';
        case SpinnerLevel.SUPERSONIC: return 'from-orange-500 to-red-500';
        default: return 'from-red-700 to-orange-800';
      }
    } else {
      // Player Colors (Cyan/Blue theme)
      switch (lvl) {
        case SpinnerLevel.SINGULARITY: return 'from-white via-cyan-400 to-purple-600';
        case SpinnerLevel.PLASMA: return 'from-purple-500 to-fuchsia-500';
        case SpinnerLevel.SUPERSONIC: return 'from-blue-400 to-indigo-600';
        default: return 'from-cyan-600 to-blue-800';
      }
    }
  };

  const colorGradient = getLevelColor(level, type === 'enemy');
  
  // Size definition with Scale
  const baseSize = SPINNER_RADIUS * 2; 
  const size = baseSize * scale;

  return (
    <div 
      ref={ref}
      className="absolute will-change-transform"
      style={{ 
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        transformStyle: 'preserve-3d',
        opacity: isGhost ? 0.5 : 1,
        // Initial transform to center it, dynamic updates happen in App.tsx
        transform: 'translate(-50%, -50%)', 
      }}
    >
       {/* Dynamic Glow Shadow - Controlled via CSS Var from Parent */}
       <div 
         className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-300 bg-gradient-to-r ${colorGradient}`}
         style={{ 
           opacity: 'var(--rpm-glow, 0)', 
           transform: 'translateZ(-40px)' 
         }}
       ></div>

       {/* Main Disc Body */}
       <div className={`absolute inset-0 rounded-full border-[4px] ${type === 'enemy' ? 'border-red-900' : 'border-gray-800'} shadow-2xl bg-gray-900 overflow-hidden backface-hidden`}>
          {/* Metallic Gradient Mesh */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-40`}></div>
          
          {/* Conic Shine */}
          <div className="absolute inset-0 opacity-50" 
               style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.4) 30deg, transparent 60deg, rgba(255,255,255,0.4) 210deg, transparent 240deg)' }}>
          </div>

          {/* Markings */}
          <div className="absolute inset-2 border-2 border-dashed border-white/20 rounded-full"></div>
          {type === 'enemy' && (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[80%] h-2 bg-black/50 rotate-45"></div>
                <div className="w-[80%] h-2 bg-black/50 -rotate-45"></div>
            </div>
          )}
       </div>

       {/* Center Cap */}
       <div 
         className={`absolute top-1/2 left-1/2 w-[15%] h-[15%] rounded-full ${type === 'enemy' ? 'bg-red-900' : 'bg-gray-800'} border-2 border-white/20 flex items-center justify-center shadow-lg`}
         style={{ transform: 'translate(-50%, -50%) translateZ(15px)' }}
       >
          <div className={`w-[50%] h-[50%] rounded-full bg-gradient-to-br ${colorGradient} animate-pulse`}></div>
       </div>

       {/* Thickness Layers (Scaled) */}
       <div className={`absolute inset-0 rounded-full border-[4px] ${type === 'enemy' ? 'border-red-800' : 'border-gray-700'}`} style={{ transform: 'translateZ(-2px)' }}></div>
       <div className={`absolute inset-0 rounded-full border-[4px] ${type === 'enemy' ? 'border-red-900' : 'border-gray-600'}`} style={{ transform: 'translateZ(-4px)' }}></div>
    </div>
  );
});

Spinner3D.displayName = 'Spinner3D';