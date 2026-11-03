# react-bits-lab

Vite + React + TS workspace with [React Bits](https://github.com/DavidHDev/react-bits) (MIT + Commons Clause) components.

Installed (TS-CSS variants) into `src/components/react-bits/`: SplitText, GradientText, ShinyText, BlurText, CountUp, DecryptedText, SpotlightCard, StarBorder, ClickSpark, Magnet, RotatingText, FuzzyText, GlitchText.
They were written from the repo's `public/r/*.json` registry files because the shadcn CLI needs
`ui.shadcn.com`, which is blocked in the sandbox. On a normal machine use:

    npx shadcn@latest add @react-bits/<Name>-TS-CSS

`npm run dev` / `npm run build`.

Backgrounds (in `src/components/react-bits/backgrounds/`): Aurora, Particles, Iridescence, Waves, LiquidChrome, Orb, Silk, Beams, Balatro, Dither (WebGL, no extra deps). Gallery: `src/Backgrounds.tsx`.

Animations (in `src/components/react-bits/animations/`): FadeContent, AnimatedContent, ScrollFloat, ScrollReveal, TrueFocus, CircularText, ScrollVelocity, CurvedLoop, GlareHover, MagnetLines, Noise, Shuffle. Gallery: `src/Animations.tsx`.

UI (in `src/components/react-bits/ui/`): Dock, Folder, TiltedCard, BounceCards, ChromaGrid, GlassSurface, Counter, Stack, PillNav, GooeyNav, Stepper, Carousel (adds @hugeicons). Gallery: `src/Ui.tsx`.
