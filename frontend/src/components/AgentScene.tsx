import { useState, useEffect, useMemo } from 'react';

/* ─── Constants ─── */

const WS_WIDTH = 44; // px per workstation slot
const PX = 3; // scale factor for pixel art
const SKIN = '#f0c890';
const DESK_COLOR = '#c8b897';
const MONITOR_FRAME = '#6b7280';
const MONITOR_SCREEN_OFF = '#1e1e2e';
const MONITOR_SCREEN_ON = '#34d399';

const AGENTS = [
  { name: 'Watcher', color: '#2b3a8f' },
  { name: 'Historian', color: '#8b5cf6' },
  { name: 'Scorer', color: '#d97706' },
  { name: 'Strategist', color: '#059669' },
  { name: 'CFO', color: '#64748b' },
];

/* ─── Types ─── */

type Status = 'sleeping' | 'working' | 'idle' | 'walking';

interface AgentAnimState {
  status: Status;
  walkTarget?: number;
}

export interface AgentSceneProps {
  scenario: 'discovery' | 'strategy' | 'precedents' | 'invoice';
  completedSteps: number;
  activeStep: number;
  isDone: boolean;
}

/* ─── State Logic ─── */

function computeStates(
  scenario: string,
  activeStep: number,
  isDone: boolean,
): AgentAnimState[] {
  const S: AgentAnimState = { status: 'sleeping' };
  const W: AgentAnimState = { status: 'working' };
  const I: AgentAnimState = { status: 'idle' };

  if (isDone) return [I, I, I, I, I];

  switch (scenario) {
    case 'discovery':
      // Agent 1 (Watcher, idx 0) does all the work
      return [W, S, S, S, S];

    case 'strategy':
      // Steps 0-1: Agent 3 (Scorer, idx 2) scoring risk
      if (activeStep <= 1) return [S, S, W, S, S];
      // Steps 2-3: Agent 2 (Historian, idx 1) researching, Scorer delivers to Strategist
      if (activeStep <= 3)
        return [S, W, { status: 'walking', walkTarget: 3 }, S, S];
      // Steps 4-5: Agent 4 (Strategist, idx 3) building strategy, Historian delivers
      return [S, { status: 'walking', walkTarget: 3 }, I, W, S];

    case 'precedents':
      // Agent 2 (Historian, idx 1) does all the work
      return [S, W, S, S, S];

    case 'invoice':
      // Each agent delivers results to CFO (idx 4) in sequence
      if (activeStep <= 0)
        return [{ status: 'walking', walkTarget: 4 }, S, S, S, W];
      if (activeStep <= 1)
        return [I, S, { status: 'walking', walkTarget: 4 }, S, W];
      if (activeStep <= 2)
        return [I, { status: 'walking', walkTarget: 4 }, I, S, W];
      if (activeStep <= 3)
        return [I, I, I, { status: 'walking', walkTarget: 4 }, W];
      return [I, I, I, I, W];

    default:
      return [S, S, S, S, S];
  }
}

/* ─── Pixel Sprite Renderer ─── */

type Px = string | null;

function Sprite({ pixels, scale = PX }: { pixels: Px[][]; scale?: number }) {
  const rows = pixels.length;
  const cols = Math.max(...pixels.map((r) => r.length));
  return (
    <svg
      width={cols * scale}
      height={rows * scale}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
    >
      {pixels.flatMap((row, y) =>
        row.map((c, x) =>
          c ? (
            <rect
              key={`${x}-${y}`}
              x={x * scale}
              y={y * scale}
              width={scale}
              height={scale}
              fill={c}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

/* ─── Sprite Definitions ─── */

function sittingSprite(c: string): Px[][] {
  return [
    [null, SKIN, SKIN, null],
    [null, SKIN, SKIN, null],
    [c, c, c, c],
    [c, c, c, c],
    [SKIN, null, null, SKIN],
  ];
}

function walkingSprite(c: string): Px[][] {
  return [
    [null, SKIN, SKIN, null],
    [null, SKIN, SKIN, null],
    [null, c, c, null],
    [null, c, c, null],
    [c, null, null, c],
  ];
}

function monitorPixels(active: boolean): Px[][] {
  const f = MONITOR_FRAME;
  const s = active ? MONITOR_SCREEN_ON : MONITOR_SCREEN_OFF;
  return [
    [f, f, f, f],
    [f, s, s, f],
    [f, s, s, f],
    [f, f, f, f],
    [null, f, f, null],
  ];
}

/* ─── Agent Character ─── */

function AgentChar({
  agent,
  index,
  state,
  walkPhase,
}: {
  agent: (typeof AGENTS)[number];
  index: number;
  state: AgentAnimState;
  walkPhase: boolean;
}) {
  const isWalking = state.status === 'walking';
  const isWorking = state.status === 'working';
  const isSleeping = state.status === 'sleeping';

  const walkDist = isWalking ? (state.walkTarget! - index) * WS_WIDTH : 0;
  const atTarget = isWalking && walkPhase;

  const sprite = isWalking
    ? walkingSprite(agent.color)
    : sittingSprite(agent.color);

  return (
    <div
      className="flex flex-col items-center justify-center relative"
      style={{ width: WS_WIDTH, zIndex: isWalking ? 10 : 1 }}
    >
      {/* Horizontal position container */}
      <div
        style={{
          transition: isWalking
            ? 'transform 1.4s steps(10)'
            : 'transform 0.3s steps(3)',
          transform: atTarget
            ? `translateX(${walkDist}px)`
            : 'translateX(0)',
        }}
        className="relative flex flex-col items-center"
      >
        {/* ZZZ for sleeping */}
        {isSleeping && (
          <div className="absolute -top-3 right-0 flex gap-px pointer-events-none">
            <span
              className="text-[7px] font-mono text-silver/60 agent-scene-zzz"
              style={{ animationDelay: '0ms' }}
            >
              z
            </span>
            <span
              className="text-[7px] font-mono text-silver/40 agent-scene-zzz"
              style={{ animationDelay: '500ms' }}
            >
              z
            </span>
          </div>
        )}

        {/* Document carried while walking */}
        {isWalking && (
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: 5,
              height: 4,
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
            }}
          />
        )}

        {/* Sprite with bounce animation */}
        <div
          className={
            isWorking
              ? 'agent-scene-work-bob'
              : isWalking
                ? 'agent-scene-walk-bob'
                : ''
          }
          style={{
            opacity: isSleeping ? 0.45 : 1,
            transition: 'opacity 0.5s',
          }}
        >
          <Sprite pixels={sprite} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Scene ─── */

export default function AgentScene({
  scenario,
  completedSteps,
  activeStep,
  isDone,
}: AgentSceneProps) {
  const states = useMemo(
    () => computeStates(scenario, activeStep, isDone),
    [scenario, activeStep, isDone],
  );

  // Walk phase toggle — alternates walking agents between home and target
  const [walkPhase, setWalkPhase] = useState(false);

  const walkKey = states
    .map((s, i) =>
      s.status === 'walking' ? `${i}>${s.walkTarget}` : '',
    )
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!walkKey) {
      setWalkPhase(false);
      return;
    }
    setWalkPhase(false);
    const id = setInterval(() => setWalkPhase((p) => !p), 2400);
    return () => clearInterval(id);
  }, [walkKey]);

  // Don't render until at least one step is active
  const hasActivity = completedSteps > 0 || activeStep > 0 || isDone;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasActivity && !visible) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [hasActivity, visible]);

  return (
    <div
      className="rounded-xl border border-mist/60 bg-mist/20 overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        padding: '10px 6px 6px',
      }}
    >
      {/* Title */}
      <p className="text-[8px] font-mono text-silver tracking-[0.12em] uppercase text-center mb-2 select-none">
        Agent Office
      </p>

      {/* Monitors row */}
      <div className="flex">
        {AGENTS.map((_, i) => (
          <div
            key={i}
            className="flex justify-center"
            style={{ width: WS_WIDTH }}
          >
            <div
              className={
                states[i].status === 'working'
                  ? 'agent-scene-monitor-glow'
                  : ''
              }
            >
              <Sprite pixels={monitorPixels(states[i].status === 'working')} />
            </div>
          </div>
        ))}
      </div>

      {/* Desk surface */}
      <div
        className="mx-1"
        style={{
          height: 3,
          backgroundColor: DESK_COLOR,
          marginTop: 2,
          marginBottom: 2,
        }}
      />

      {/* Characters row */}
      <div className="flex relative">
        {AGENTS.map((agent, i) => (
          <AgentChar
            key={i}
            agent={agent}
            index={i}
            state={states[i]}
            walkPhase={walkPhase}
          />
        ))}
      </div>

      {/* Agent labels */}
      <div className="flex mt-1">
        {AGENTS.map((agent, i) => (
          <div
            key={i}
            className="flex justify-center"
            style={{ width: WS_WIDTH }}
          >
            <span
              className="text-[7px] font-mono tracking-tight select-none transition-colors duration-500"
              style={{
                color:
                  states[i].status !== 'sleeping'
                    ? agent.color
                    : '#b4b8c0',
              }}
            >
              {agent.name.length > 4
                ? agent.name.slice(0, 3)
                : agent.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
