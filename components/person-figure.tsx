"use client";

import type { SkinToneId } from "@/lib/skin";
import { skinToneById } from "@/lib/skin";

/** Athletic fashion figure. Head is one of 7.5, and the neck is about a third of that. */
export function PersonDefs({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <defs>
      <linearGradient id={`${marker}-skin`} x1="32%" y1="0%" x2="68%" y2="100%">
        <stop offset="0%" stopColor={skin.base} />
        <stop offset="55%" stopColor={skin.shadow} />
        <stop offset="100%" stopColor={skin.deep} />
      </linearGradient>
      <linearGradient id={`${marker}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={skin.deep} />
        <stop offset="38%" stopColor={skin.base} />
        <stop offset="100%" stopColor={skin.shadow} />
      </linearGradient>
      <radialGradient id={`${marker}-face`} cx="40%" cy="36%" r="68%">
        <stop offset="0%" stopColor={skin.base} />
        <stop offset="62%" stopColor={skin.shadow} />
        <stop offset="100%" stopColor={skin.deep} />
      </radialGradient>
      <linearGradient id={`${marker}-hair`} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#5c463c" />
        <stop offset="55%" stopColor="#2a1c16" />
        <stop offset="100%" stopColor="#140e0c" />
      </linearGradient>
    </defs>
  );
}

export function PersonBody({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g>
      <ellipse cx="160" cy="692" rx="62" ry="8" fill="#000" opacity="0.16" />
      <path
        d="M130 372 C122 450 120 530 128 600 C138 612 150 610 152 596 C156 520 154 440 148 376 C142 364 134 362 130 372Z"
        fill={`url(#${marker}-limb)`}
      />
      <path
        d="M190 372 C198 450 200 530 192 600 C182 612 170 610 168 596 C164 520 166 440 172 376 C178 364 186 362 190 372Z"
        fill={`url(#${marker}-limb)`}
      />
      <path d="M132 596 C120 608 112 632 122 654 C140 666 156 658 156 640 C154 618 146 600 136 596Z" fill={skin.shadow} />
      <path d="M188 596 C200 608 208 632 198 654 C180 666 164 658 164 640 C166 618 174 600 184 596Z" fill={skin.shadow} />
      <path d="M110 148 C98 158 90 186 86 228 C84 242 94 248 102 240 C108 206 110 176 116 158Z" fill={`url(#${marker}-limb)`} />
      <path d="M210 148 C222 158 230 186 234 228 C236 242 226 248 218 240 C212 206 210 176 204 158Z" fill={`url(#${marker}-limb)`} />
      <path
        d="M90 228 C80 280 78 332 86 388 C100 400 114 392 116 378 C118 322 112 270 108 236 C100 224 92 224 90 228Z"
        fill={`url(#${marker}-limb)`}
      />
      <path
        d="M230 228 C240 280 242 332 234 388 C220 400 206 392 204 378 C202 322 208 270 212 236 C220 224 228 224 230 228Z"
        fill={`url(#${marker}-limb)`}
      />
      <path
        d="M118 142 C106 136 102 150 108 162 C116 206 124 258 132 300 C140 328 146 348 154 364 H166 C174 348 180 328 188 300 C196 258 204 206 212 162 C218 150 214 136 202 142 C188 154 172 160 160 160 C148 160 132 154 118 142Z"
        fill={`url(#${marker}-skin)`}
      />
      <path d="M118 176 C132 184 148 186 160 184 C172 186 188 184 202 176" stroke="#000" strokeWidth="1.1" fill="none" opacity="0.12" />
      <path d="M124 206 C140 220 146 236 136 250 C152 258 168 258 184 250 C174 236 180 220 196 206 C176 216 144 216 124 206Z" fill="#fff" opacity="0.14" />
    </g>
  );
}

export function PersonHands({ skinId }: { skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g>
      <path
        d="M76 392 C68 402 70 422 80 430 C86 422 92 420 94 428 C94 438 102 440 108 432 C110 418 106 406 112 398 C108 388 92 384 84 388 C80 386 78 388 76 392Z"
        fill={skin.base}
        stroke={skin.deep}
        strokeWidth="0.8"
      />
      <path d="M86 404 V424 M96 402 V426" stroke={skin.deep} strokeWidth="0.7" fill="none" opacity="0.55" />
      <path
        d="M244 392 C252 402 250 422 240 430 C234 422 228 420 226 428 C226 438 218 440 212 432 C210 418 214 406 208 398 C212 388 228 384 236 388 C240 386 242 388 244 392Z"
        fill={skin.base}
        stroke={skin.deep}
        strokeWidth="0.8"
      />
      <path d="M234 404 V424 M224 402 V426" stroke={skin.deep} strokeWidth="0.7" fill="none" opacity="0.55" />
    </g>
  );
}

export function PersonHead({ marker, skinId }: { marker: string; skinId: SkinToneId | string }) {
  const skin = skinToneById(skinId);
  return (
    <g>
      <path d="M138 106 C134 120 130 132 128 144 H192 C190 132 186 120 182 106 C168 114 152 114 138 106Z" fill={skin.shadow} />
      <path d="M150 124 C156 130 166 130 172 124" stroke={skin.deep} strokeWidth="1.1" fill="none" opacity="0.4" />
      <ellipse cx="118" cy="84" rx="6" ry="10" fill={skin.shadow} />
      <ellipse cx="202" cy="84" rx="6" ry="10" fill={skin.shadow} />
      <path
        d="M160 36 C186 38 200 58 198 80 C196 102 182 116 160 116 C138 116 124 102 122 80 C120 58 134 38 160 36Z"
        fill={`url(#${marker}-face)`}
      />
      <path d="M132 96 C146 112 174 112 188 96 C174 104 146 104 132 96Z" fill={skin.shadow} opacity="0.45" />
      <path
        d="M128 72 C122 46 136 22 160 18 C184 22 198 46 192 72 C182 50 172 40 160 42 C148 44 136 54 128 72Z"
        fill={`url(#${marker}-hair)`}
      />
      <path d="M124 66 C118 80 120 96 132 102 L136 78Z" fill="#1c1410" />
      <path d="M196 66 C202 80 200 96 188 102 L184 78Z" fill="#1c1410" />
      <path d="M136 64 C146 58 154 58 162 64" stroke="#2c211c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M158 64 C166 58 174 58 184 64" stroke="#2c211c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="146" cy="80" rx="7" ry="4.2" fill="#f7f1ec" />
      <ellipse cx="174" cy="80" rx="7" ry="4.2" fill="#f7f1ec" />
      <ellipse cx="147.2" cy="80.6" rx="2.8" ry="2.8" fill="#241c18" />
      <ellipse cx="175.2" cy="80.6" rx="2.8" ry="2.8" fill="#241c18" />
      <ellipse cx="148" cy="79.4" rx="0.9" ry="0.7" fill="#fff" />
      <ellipse cx="176" cy="79.4" rx="0.9" ry="0.7" fill="#fff" />
      <path d="M160 84 V94" stroke={skin.deep} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M154 96 Q160 99 166 96" stroke={skin.deep} strokeWidth="1" fill="none" />
      <path d="M146 104 Q160 112 174 104 Q160 108 146 104Z" fill="#c47064" />
      <ellipse cx="134" cy="92" rx="6" ry="3" fill={skin.blush} opacity="0.55" />
      <ellipse cx="186" cy="92" rx="6" ry="3" fill={skin.blush} opacity="0.55" />
    </g>
  );
}
