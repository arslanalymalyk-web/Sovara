import Dock from '@/components/react-bits/ui/Dock/Dock';
import Folder from '@/components/react-bits/ui/Folder/Folder';
import TiltedCard from '@/components/react-bits/ui/TiltedCard/TiltedCard';
import BounceCards from '@/components/react-bits/ui/BounceCards/BounceCards';
import ChromaGrid from '@/components/react-bits/ui/ChromaGrid/ChromaGrid';
import GlassSurface from '@/components/react-bits/ui/GlassSurface/GlassSurface';
import Counter from '@/components/react-bits/ui/Counter/Counter';
import Stack from '@/components/react-bits/ui/Stack/Stack';
import PillNav from '@/components/react-bits/ui/PillNav/PillNav';
import GooeyNav from '@/components/react-bits/ui/GooeyNav/GooeyNav';
import Stepper, { Step } from '@/components/react-bits/ui/Stepper/Stepper';
import Carousel from '@/components/react-bits/ui/Carousel/Carousel';

const box = { display: 'grid', gap: 12, padding: 24, border: '1px solid #333', borderRadius: 12, overflow: 'hidden', alignContent: 'start' } as const;
const nav = [{ label: 'Home', href: '#' }, { label: 'Docs', href: '#' }, { label: 'Portal', href: '#' }];
const card = (t: string) => <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: '#1b1b2b', color: '#fff' }}>{t}</div>;

export default function Ui() {
  return (
    <section style={{ display: 'grid', gap: 20, padding: 32, gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
      <div style={box}><Dock items={[{ label: 'Home', icon: '⌂' }, { label: 'Search', icon: '⌕' }, { label: 'Mail', icon: '✉' }]} /></div>
      <div style={box}><Folder items={['A', 'B', 'C']} label="Folder" /></div>
      <div style={box}><TiltedCard captionText="TiltedCard" containerHeight="200px" containerWidth="100%" imageHeight="200px" imageWidth="260px" /></div>
      <div style={box}><BounceCards images={[]} /></div>
      <div style={box}><ChromaGrid items={[{ image: '', title: 'Chroma', subtitle: 'Grid' }]} /></div>
      <div style={{ ...box, background: 'linear-gradient(135deg,#6a5cff,#ff5c8a)' }}><GlassSurface width="100%" height={120}>GlassSurface</GlassSurface></div>
      <div style={box}><Counter value={1280} /></div>
      <div style={{ ...box, height: 260 }}><Stack cards={[card('One'), card('Two'), card('Three')]} /></div>
      <div style={box}><PillNav items={nav} /></div>
      <div style={box}><GooeyNav items={nav} /></div>
      <div style={box}><Stepper><Step title="One">First</Step><Step title="Two">Second</Step></Stepper></div>
      <div style={box}><Carousel items={['One', 'Two', 'Three']} /></div>
    </section>
  );
}
