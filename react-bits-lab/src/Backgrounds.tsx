import Aurora from '@/components/react-bits/backgrounds/Aurora/Aurora';
import Particles from '@/components/react-bits/backgrounds/Particles/Particles';
import Iridescence from '@/components/react-bits/backgrounds/Iridescence/Iridescence';
import Waves from '@/components/react-bits/backgrounds/Waves/Waves';
import LiquidChrome from '@/components/react-bits/backgrounds/LiquidChrome/LiquidChrome';
import Orb from '@/components/react-bits/backgrounds/Orb/Orb';
import Silk from '@/components/react-bits/backgrounds/Silk/Silk';
import Beams from '@/components/react-bits/backgrounds/Beams/Beams';
import Balatro from '@/components/react-bits/backgrounds/Balatro/Balatro';
import Dither from '@/components/react-bits/backgrounds/Dither/Dither';
import { type ComponentType } from 'react';

const items: [string, ComponentType][] = [
  ['Aurora', Aurora as ComponentType],
  ['Particles', Particles as ComponentType],
  ['Iridescence', Iridescence as ComponentType],
  ['Waves', Waves as ComponentType],
  ['LiquidChrome', LiquidChrome as ComponentType],
  ['Orb', Orb as ComponentType],
  ['Silk', Silk as ComponentType],
  ['Beams', Beams as ComponentType],
  ['Balatro', Balatro as ComponentType],
  ['Dither', Dither as ComponentType],
];

export default function Backgrounds() {
  return (
    <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', padding: 32 }}>
      {items.map(([name, C]) => (
        <figure key={name} style={{ margin: 0, position: 'relative', height: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid #333', background: '#000' }}>
          <C />
          <figcaption style={{ position: 'absolute', left: 12, bottom: 8, color: '#fff', fontSize: 13, textShadow: '0 1px 4px #000' }}>{name}</figcaption>
        </figure>
      ))}
    </section>
  );
}
