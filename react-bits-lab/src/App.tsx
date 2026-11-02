import SplitText from '@/components/react-bits/SplitText/SplitText';
import GradientText from '@/components/react-bits/GradientText/GradientText';
import ShinyText from '@/components/react-bits/ShinyText/ShinyText';
import BlurText from '@/components/react-bits/BlurText/BlurText';
import CountUp from '@/components/react-bits/CountUp/CountUp';
import DecryptedText from '@/components/react-bits/DecryptedText/DecryptedText';
import SpotlightCard from '@/components/react-bits/SpotlightCard/SpotlightCard';
import StarBorder from '@/components/react-bits/StarBorder/StarBorder';
import ClickSpark from '@/components/react-bits/ClickSpark/ClickSpark';
import Magnet from '@/components/react-bits/Magnet/Magnet';
import RotatingText from '@/components/react-bits/RotatingText/RotatingText';
import FuzzyText from '@/components/react-bits/FuzzyText/FuzzyText';
import GlitchText from '@/components/react-bits/GlitchText/GlitchText';

const box = { display: 'grid', gap: 12, padding: 24, border: '1px solid #333', borderRadius: 12 } as const;

export default function App() {
  return (
    <ClickSpark sparkColor="#fff">
      <main style={{ padding: 32, display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <section style={box}><SplitText text="React Bits in Sovara" /><small>SplitText</small></section>
        <section style={box}><GradientText>Animated gradient text</GradientText><small>GradientText</small></section>
        <section style={box}><ShinyText text="Shiny text" /><small>ShinyText</small></section>
        <section style={box}><BlurText text="Blur in, word by word" /><small>BlurText</small></section>
        <section style={box}><div style={{ fontSize: 40 }}><CountUp from={0} to={1280} separator="," /></div><small>CountUp</small></section>
        <section style={box}><DecryptedText text="Decrypt me" animateOn="view" /><small>DecryptedText</small></section>
        <section style={box}><SpotlightCard><p>Hover for a spotlight</p></SpotlightCard><small>SpotlightCard</small></section>
        <section style={box}><StarBorder as="button">Star border</StarBorder><small>StarBorder</small></section>
        <section style={box}><Magnet><button>Magnet button</button></Magnet><small>Magnet</small></section>
        <section style={box}><RotatingText texts={['Portal', 'Badge', 'Graph']} rotationInterval={2000} /><small>RotatingText</small></section>
        <section style={box}><FuzzyText fontSize="2rem">Fuzzy</FuzzyText><small>FuzzyText</small></section>
        <section style={box}><GlitchText>Glitch</GlitchText><small>GlitchText · click anywhere for ClickSpark</small></section>
      </main>
    </ClickSpark>
  );
}
