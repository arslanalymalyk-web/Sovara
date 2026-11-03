import FadeContent from '@/components/react-bits/animations/FadeContent/FadeContent';
import AnimatedContent from '@/components/react-bits/animations/AnimatedContent/AnimatedContent';
import ScrollFloat from '@/components/react-bits/animations/ScrollFloat/ScrollFloat';
import ScrollReveal from '@/components/react-bits/animations/ScrollReveal/ScrollReveal';
import TrueFocus from '@/components/react-bits/animations/TrueFocus/TrueFocus';
import CircularText from '@/components/react-bits/animations/CircularText/CircularText';
import ScrollVelocity from '@/components/react-bits/animations/ScrollVelocity/ScrollVelocity';
import CurvedLoop from '@/components/react-bits/animations/CurvedLoop/CurvedLoop';
import GlareHover from '@/components/react-bits/animations/GlareHover/GlareHover';
import MagnetLines from '@/components/react-bits/animations/MagnetLines/MagnetLines';
import Noise from '@/components/react-bits/animations/Noise/Noise';
import Shuffle from '@/components/react-bits/animations/Shuffle/Shuffle';

const box = { display: 'grid', gap: 12, padding: 24, border: '1px solid #333', borderRadius: 12, position: 'relative', overflow: 'hidden' } as const;

export default function Animations() {
  return (
    <section style={{ display: 'grid', gap: 20, padding: 32, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
      <div style={box}><FadeContent><p>FadeContent</p></FadeContent></div>
      <div style={box}><AnimatedContent><p>AnimatedContent</p></AnimatedContent></div>
      <div style={box}><ScrollFloat>ScrollFloat</ScrollFloat></div>
      <div style={box}><ScrollReveal>ScrollReveal reveals text as you scroll</ScrollReveal></div>
      <div style={box}><TrueFocus sentence="True Focus Words" /></div>
      <div style={box}><CircularText text="REACT*BITS*SOVARA*" /></div>
      <div style={box}><ScrollVelocity texts={['Scroll Velocity', 'Sovara']} /></div>
      <div style={box}><CurvedLoop marqueeText="Curved Loop ✦ Sovara ✦" /></div>
      <div style={box}><GlareHover><p style={{ padding: 24 }}>GlareHover</p></GlareHover></div>
      <div style={box}><MagnetLines /></div>
      <div style={{ ...box, minHeight: 120 }}><Noise /><p>Noise overlay</p></div>
      <div style={box}><Shuffle text="Shuffle" /></div>
    </section>
  );
}
