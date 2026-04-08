import React from "react";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";

const FILL = "#282828";

export default function TorontoSkyline() {
  return (
    <Svg
      width="100%"
      height={220}
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMax slice"
    >
      {/* ── Left-side buildings (fewer, taller, wider) ── */}
      <Rect x={0} y={95} width={42} height={125} fill={FILL} />
      <Rect x={28} y={75} width={36} height={145} fill={FILL} />
      <Rect x={68} y={90} width={32} height={130} fill={FILL} />
      <Rect x={100} y={105} width={36} height={115} fill={FILL} />

      {/* ── Rogers Centre (shallow wide dome with stepped base) ── */}
      {/* Dome — wide and shallow arc */}
      <Ellipse cx={187} cy={190} rx={45} ry={24} fill={FILL} />
      {/* Stepped base */}
      <Rect x={148} y={190} width={79} height={13} fill={FILL} />
      <Rect x={140} y={190} width={95} height={22} fill={FILL} />

      {/* ── CN Tower (dominant, right of center) ── */}
      {/* Base legs — wide triangular supports */}
      <Path d="M235,220 L246,160 L254,160 L265,220 Z" fill={FILL} />
      <Path d="M239,220 L246,172 L254,172 L261,220 Z" fill={FILL} />
      {/* Main shaft */}
      <Rect x={247} y={40} width={6} height={130} fill={FILL} />
      {/* SkyPod observation deck */}
      <Ellipse cx={250} cy={58} rx={16} ry={7} fill={FILL} />
      <Ellipse cx={250} cy={52} rx={11} ry={4} fill={FILL} />
      {/* Upper pod */}
      <Ellipse cx={250} cy={43} rx={7} ry={3.5} fill={FILL} />
      {/* Antenna */}
      <Rect x={248.5} y={5} width={3} height={40} fill={FILL} />

      {/* ── Right-side buildings (fewer, taller, wider) ── */}
      <Rect x={272} y={90} width={32} height={130} fill={FILL} />
      <Rect x={308} y={70} width={36} height={150} fill={FILL} />
      <Rect x={336} y={85} width={30} height={135} fill={FILL} />
      <Rect x={372} y={80} width={36} height={140} fill={FILL} />

      {/* ── Ground fill ── */}
      <Rect x={0} y={210} width={400} height={10} fill={FILL} />
    </Svg>
  );
}
