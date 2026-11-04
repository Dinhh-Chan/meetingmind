import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Main } from "./Main";
import { FPS, H, W } from "./theme";
import { TOTAL } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition id="MeetingMindDemo" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
