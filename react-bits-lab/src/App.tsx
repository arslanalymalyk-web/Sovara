import SplitText from '@/components/react-bits/SplitText/SplitText';
import GradientText from '@/components/react-bits/GradientText/GradientText';
import ShinyText from '@/components/react-bits/ShinyText/ShinyText';

export default function App() {
  return (
    <main style={{ padding: 48, display: 'grid', gap: 24 }}>
      <SplitText text="React Bits in Sovara" />
      <GradientText>Animated gradient text</GradientText>
      <ShinyText text="Shiny text" />
    </main>
  );
}
