"use client";

import type { SkinToneId } from "@/lib/skin";
import { skinToneById } from "@/lib/skin";

/** Front-facing male figure, about eight heads tall, arms a little away from the body. */
export function PersonDefs({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <defs>
      <linearGradient id={`${marker}-skin`} x1="25%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor={skin.base} />
        <stop offset="55%" stopColor={skin.shadow} />
        <stop offset="100%" stopColor={skin.deep} />
      </linearGradient>
      <linearGradient id={`${marker}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={skin.deep} />
        <stop offset="40%" stopColor={skin.base} />
        <stop offset="100%" stopColor={skin.shadow} />
      </linearGradient>
      <linearGradient id={`${marker}-hair`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4a342c" />
        <stop offset="100%" stopColor="#1c120e" />
      </linearGradient>
      <filter id={`${marker}-cloth`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.3" stdDeviation="1.05" floodColor="#000" floodOpacity="0.3" />
      </filter>
      <clipPath id={`${marker}-pants`}>
        <path d="M60 228 H140 L148 256 L138 310 L126 472 L106 476 L100 330 L94 476 L74 472 L62 310 L52 256 Z" />
      </clipPath>
      <clipPath id={`${marker}-shorts`}>
        <path d="M60 228 H140 L148 256 L140 330 L108 336 L100 286 L92 336 L60 330 L52 256 Z" />
      </clipPath>
      <clipPath id={`${marker}-torso`}>
        <path d="M62 108 C58 118 64 156 70 196 C76 224 80 244 86 258 H114 C120 244 124 224 130 196 C136 156 142 118 138 108 C126 116 112 120 100 120 C88 120 74 116 62 108Z" />
      </clipPath>
      <clipPath id={`${marker}-sleeve-l`}>
        <path d="M58 112 C46 118 36 140 34 166 C40 174 52 170 56 156 C58 140 60 124 64 116Z" />
      </clipPath>
      <clipPath id={`${marker}-sleeve-r`}>
        <path d="M142 112 C154 118 164 140 166 166 C160 174 148 170 144 156 C142 140 140 124 136 116Z" />
      </clipPath>
      <clipPath id={`${marker}-long-l`}>
        <path d="M58 112 C44 122 32 160 30 210 C32 248 40 262 48 254 C52 220 54 170 60 140 C62 124 64 116 58 112Z" />
      </clipPath>
      <clipPath id={`${marker}-long-r`}>
        <path d="M142 112 C156 122 168 160 170 210 C168 248 160 262 152 254 C148 220 146 170 140 140 C138 124 136 116 142 112Z" />
      </clipPath>
      <clipPath id={`${marker}-hat`}>
        <path d="M74 8 C78 0 122 0 126 8 C130 28 118 42 100 44 C82 42 70 28 74 8Z" />
      </clipPath>
    </defs>
  );
}

export function PersonBody({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g>
      <ellipse cx="100" cy="516" rx="32" ry="4" fill="#000" opacity="0.2" />
      <path d="M74 250 C66 290 64 326 70 354 C76 362 92 360 96 350 C100 322 102 290 100 260 C98 250 86 244 74 250Z" fill={`url(#${marker}-limb)`} />
      <path d="M126 250 C134 290 136 326 130 354 C124 362 108 360 104 350 C100 322 98 290 100 260 C102 250 114 244 126 250Z" fill={`url(#${marker}-limb)`} />
      <path d="M72 350 C66 386 64 428 72 466 C78 472 92 470 96 460 C100 424 100 386 94 354 C88 346 78 346 72 350Z" fill={`url(#${marker}-limb)`} />
      <path d="M128 350 C134 386 136 428 128 466 C122 472 108 470 104 460 C100 424 100 386 106 354 C112 346 122 346 128 350Z" fill={`url(#${marker}-limb)`} />
      <ellipse cx="83" cy="354" rx="7" ry="4" fill={skin.base} opacity="0.45" />
      <ellipse cx="117" cy="354" rx="7" ry="4" fill={skin.base} opacity="0.45" />
      <path d="M70 462 C58 468 48 480 56 490 C66 500 92 496 98 484 C100 476 88 462 78 460Z" fill={skin.shadow} />
      <path d="M130 462 C142 468 152 480 144 490 C134 500 108 496 102 484 C100 476 112 462 122 460Z" fill={skin.shadow} />
      <path d="M56 486 h7 M65 490 h6 M73 492 h5" stroke={skin.deep} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M144 486 h-7 M135 490 h-6 M127 492 h-5" stroke={skin.deep} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M52 114 C40 122 34 146 34 168 C34 184 38 196 46 198 C52 194 54 180 54 164 C54 146 56 128 64 118Z" fill={`url(#${marker}-limb)`} />
      <path d="M148 114 C160 122 166 146 166 168 C166 184 162 196 154 198 C148 194 146 180 146 164 C146 146 144 128 136 118Z" fill={`url(#${marker}-limb)`} />
      <path d="M40 192 C32 214 30 238 36 260 C40 266 48 264 50 256 C52 236 52 214 54 196 C50 190 44 188 40 192Z" fill={`url(#${marker}-limb)`} />
      <path d="M160 192 C168 214 170 238 164 260 C160 266 152 264 150 256 C148 236 148 214 146 196 C150 190 156 188 160 192Z" fill={`url(#${marker}-limb)`} />
      <path d="M58 112 C50 106 46 116 48 124 C54 156 60 186 68 206 C74 224 78 238 84 250 H116 C122 238 126 224 132 206 C140 186 146 156 152 124 C154 116 150 106 142 112 C128 120 114 124 100 124 C86 124 72 120 58 112Z" fill={`url(#${marker}-skin)`} />
      <path d="M72 122 C84 128 94 128 100 124" stroke={skin.deep} strokeWidth="0.8" fill="none" opacity="0.55" />
      <path d="M128 122 C116 128 106 128 100 124" stroke={skin.deep} strokeWidth="0.8" fill="none" opacity="0.55" />
      <path d="M76 146 C86 160 88 174 78 184 C92 190 108 190 122 184 C112 174 114 160 124 146 C112 154 88 154 76 146Z" fill={skin.base} opacity="0.35" />
    </g>
  );
}

export function PersonHands({ skinId }: { skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g fill={skin.base}>
      <path d="M28 258 C22 264 22 276 28 280 C30 274 34 270 36 274 C34 282 38 286 42 284 C44 276 42 268 44 264 C46 276 50 280 54 276 C56 268 52 258 48 254 C44 248 34 250 28 258Z" />
      <path d="M172 258 C178 264 178 276 172 280 C170 274 166 270 164 274 C166 282 162 286 158 284 C156 276 158 268 156 264 C154 276 150 280 146 276 C144 268 148 258 152 254 C156 248 166 250 172 258Z" />
      <path d="M30 262 v12 M38 258 v16 M46 260 v14" stroke={skin.deep} strokeWidth="0.7" fill="none" strokeLinecap="round" />
      <path d="M170 262 v12 M162 258 v16 M154 260 v14" stroke={skin.deep} strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function PersonHead({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g>
      <path d="M92 74 H108 L110 116 H90Z" fill={skin.shadow} />
      <ellipse cx="78" cy="50" rx="3.6" ry="6" fill={skin.shadow} />
      <ellipse cx="122" cy="50" rx="3.6" ry="6" fill={skin.shadow} />
      <path d="M82 52 C80 36 88 24 100 22 C112 24 120 36 118 52 C120 66 112 78 100 80 C88 78 80 66 82 52Z" fill={skin.base} />
      <path d="M86 64 C92 74 108 74 114 64 C106 70 94 70 86 64Z" fill={skin.shadow} opacity="0.55" />
      <path d="M84 46 C82 30 90 16 100 14 C110 16 118 30 116 46 C112 34 106 28 100 30 C92 32 86 38 84 46Z" fill={`url(#${marker}-hair)`} />
      <path d="M84 42 C80 50 80 60 86 64 L88 52Z" fill="#2a1c16" />
      <path d="M116 42 C120 50 120 60 114 64 L112 52Z" fill="#2a1c16" />
      <path d="M88 42 C92 39 97 39 100 42" stroke="#3a2a24" strokeWidth="1.05" fill="none" strokeLinecap="round" />
      <path d="M100 42 C104 39 110 39 114 42" stroke="#3a2a24" strokeWidth="1.05" fill="none" strokeLinecap="round" />
      <ellipse cx="93" cy="50" rx="2.6" ry="1.55" fill="#241c18" />
      <ellipse cx="107" cy="50" rx="2.6" ry="1.55" fill="#241c18" />
      <ellipse cx="93.7" cy="49.4" rx="0.65" ry="0.4" fill="#fff" opacity="0.85" />
      <ellipse cx="107.7" cy="49.4" rx="0.65" ry="0.4" fill="#fff" opacity="0.85" />
      <path d="M100 53 V60" stroke={skin.deep} strokeWidth="0.95" fill="none" strokeLinecap="round" />
      <path d="M97 61.4 Q100 63 103 61.4" stroke={skin.deep} strokeWidth="0.65" fill="none" />
      <path d="M93 68 Q100 72.2 107 68" stroke="#a86858" strokeWidth="1.05" fill="none" strokeLinecap="round" />
      <ellipse cx="86" cy="60" rx="3.2" ry="1.7" fill={skin.blush} opacity="0.4" />
      <ellipse cx="114" cy="60" rx="3.2" ry="1.7" fill={skin.blush} opacity="0.4" />
    </g>
  );
}
