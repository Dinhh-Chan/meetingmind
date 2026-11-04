import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { AudioLayer } from "./AudioLayer";
import { cameraAt, Flash, flashAt, GlitchBlocks, GlitchDefs, glitchAt, Grain } from "./components/fx";
import { Capture } from "./scenes/Capture";
import { Hero } from "./scenes/Hero";
import { Hook } from "./scenes/Hook";
import { LogoScene } from "./scenes/LogoScene";
import { Minutes } from "./scenes/Minutes";
import { Numbers } from "./scenes/Numbers";
import { Outro } from "./scenes/Outro";
import { Problem } from "./scenes/Problem";
import { Stack } from "./scenes/Stack";
import { Transcript } from "./scenes/Transcript";
import { C } from "./theme";
import { SCENES } from "./timeline";

const S = (k: keyof typeof SCENES) => ({ from: SCENES[k][0], durationInFrames: SCENES[k][1] - SCENES[k][0] });

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const g = glitchAt(frame);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <GlitchDefs frame={frame} amount={g} />
      <AbsoluteFill
        style={{
          transform: `translate(${cam.x}px, ${cam.y}px) rotate(${cam.rot}deg) scale(${cam.scale})`,
          filter: g > 0.02 ? "url(#mmGlitch)" : undefined,
        }}
      >
        <Sequence {...S("hook")}>
          <Hook />
        </Sequence>
        <Sequence from={SCENES.problem[0]} durationInFrames={SCENES.build[1] - SCENES.problem[0]}>
          <Problem />
        </Sequence>
        <Sequence {...S("logo")}>
          <LogoScene />
        </Sequence>
        <Sequence {...S("capture")}>
          <Capture />
        </Sequence>
        <Sequence {...S("transcript")}>
          <Transcript />
        </Sequence>
        <Sequence {...S("minutes")}>
          <Minutes />
        </Sequence>
        <Sequence {...S("hero")}>
          <Hero />
        </Sequence>
        <Sequence {...S("numbers")}>
          <Numbers />
        </Sequence>
        <Sequence {...S("stack")}>
          <Stack />
        </Sequence>
        <Sequence {...S("outro")}>
          <Outro />
        </Sequence>
        <GlitchBlocks frame={frame} amount={g} />
      </AbsoluteFill>
      <Grain frame={frame} opacity={0.06} />
      <Flash amount={flashAt(frame)} />
      <AudioLayer />
    </AbsoluteFill>
  );
};
