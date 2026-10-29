"use client";
import { useState } from "react";
import Link from "next/link";
import {
  applyMove,
  explainMove,
  key,
  legalMoves,
  matchesTarget,
  same,
  type Cell,
} from "@/geometry/rules";
import { levels } from "@/levels/levels";

export default function Playground() {
  const [levelIndex, setLevelIndex] = useState(0);
  const level = levels[levelIndex];
  const [history, setHistory] = useState<Cell[][]>([levels[0].start]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [message, setMessage] = useState(
    "Select a blue square to discover its legal moves.",
  );
  const [showTarget, setShowTarget] = useState(true);
  const [hovered, setHovered] = useState<Cell | null>(null);
  const cells = history[step];
  const moves = selected ? legalMoves(cells, selected) : [];
  const won = matchesTarget(cells, level.target);
  const preview = moves.find((m) => hovered && same(m.to, hovered));
  const all = [...cells, ...level.target, ...moves.map((m) => m.to)];
  const minX = Math.min(-3, ...all.map((c) => c[0] - 2)),
    maxX = Math.max(5, ...all.map((c) => c[0] + 2));
  const minY = Math.min(-2, ...all.map((c) => c[1] - 2)),
    maxY = Math.max(4, ...all.map((c) => c[1] + 2));
  const size = 58;
  function load(index: number) {
    setLevelIndex(index);
    setHistory([levels[index].start]);
    setStep(0);
    setSelected(null);
    setHovered(null);
    setMessage("Select a blue square to discover its legal moves.");
  }
  function select(cell: Cell) {
    if (cells.some((c) => same(c, cell))) {
      setSelected(cell);
      const count = legalMoves(cells, cell).length;
      setMessage(
        count
          ? `${count} legal destinations. Choose a green marker.`
          : "This square cannot move. It may be a bridge, or lack supports and clearance.",
      );
      return;
    }
    if (!selected) {
      setMessage("Select a blue square first.");
      return;
    }
    const move = moves.find((m) => same(m.to, cell));
    setMessage(explainMove(cells, selected, cell));
    if (move) {
      setHistory([...history.slice(0, step + 1), applyMove(cells, move)]);
      setStep(step + 1);
      setSelected(cell);
      setHovered(null);
    }
  }
  function travel(next: number) {
    setStep(next);
    setSelected(null);
    setHovered(null);
    setMessage("History restored. Select a square to continue.");
  }
  const boardCells = [];
  for (let y = maxY; y >= minY; y--)
    for (let x = minX; x <= maxX; x++) {
      const cell: Cell = [x, y];
      const occupied = cells.some((c) => same(c, cell));
      const target = showTarget && level.target.some((c) => same(c, cell));
      const move = moves.find((m) => same(m.to, cell));
      const active = selected && same(selected, cell);
      const support = preview?.supports.some((c) => same(c, cell));
      const clearance = preview?.clearance.some((c) => same(c, cell));
      boardCells.push(
        <g
          key={key(cell)}
          transform={`translate(${(x - minX) * size},${(maxY - y) * size})`}
        >
          <rect width={size} height={size} className="grid-cell" />
          {target && (
            <rect
              x="6"
              y="6"
              width="46"
              height="46"
              rx="10"
              className="target-cell"
            />
          )}
          {clearance && (
            <rect
              x="4"
              y="4"
              width="50"
              height="50"
              rx="10"
              className="clearance-cell"
            />
          )}
          {occupied && (
            <rect
              x="7"
              y="7"
              width="44"
              height="44"
              rx="10"
              className={`module ${active ? "selected" : ""} ${support ? "support" : ""}`}
            />
          )}
          {occupied && (
            <path d="M17 20h17M17 25h10" className="module-detail" />
          )}
          {move && (
            <>
              <circle cx="29" cy="29" r="15" className="destination" />
              <text
                x="29"
                y="34"
                textAnchor="middle"
                className="destination-symbol"
              >
                {move.kind === "slide" ? "→" : "↻"}
              </text>
            </>
          )}
          <rect
            width={size}
            height={size}
            fill="transparent"
            role="button"
            tabIndex={occupied || !!move ? 0 : -1}
            aria-label={`${occupied ? "Square" : move ? move.kind + " destination" : "Empty cell"} at ${x}, ${y}`}
            onClick={() => select(cell)}
            onMouseEnter={() => setHovered(cell)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(cell)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select(cell);
              }
            }}
            className="cell-hit"
          />
        </g>,
      );
    }
  return (
    <main className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">▦</span> sliding<span>cubes</span>
        </Link>
        <span className="project-tag">A computational geometry playground</span>
        <span className="mode-badge">2D · Pushing squares</span>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">SMALL MOVES. CONNECTED SHAPES.</p>
          <h1>Find a way, together.</h1>
          <p>
            Slide and rotate squares. Keep every connection. Make the outline
            your own.
          </p>
        </div>
        <div className="intro-note">
          <span>01</span>
          <p>
            Explore the geometry
            <br />
            one move at a time.
          </p>
        </div>
      </section>
      <div className="workspace">
        <aside className="level-panel">
          <p className="eyebrow">THE FIRST STEPS</p>
          <h2>Choose a challenge</h2>
          <div className="level-list">
            {levels.map((l, i) => (
              <button
                key={l.name}
                className={`level-button ${i === levelIndex ? "current" : ""}`}
                onClick={() => load(i)}
                aria-pressed={i === levelIndex}
              >
                <span className="level-number">0{i + 1}</span>
                <span>
                  <strong>{l.name}</strong>
                  <small>{l.topic.split(" / ")[1]}</small>
                </span>
                <span className="level-arrow">↗</span>
              </button>
            ))}
          </div>
          <div className="rule-card">
            <span className="rule-icon">↔</span>
            <h3>Stay connected.</h3>
            <p>
              After lifting a square, all the others must still share a path
              through their sides. Corner contact doesn’t count.
            </p>
            <p>The plane expands as you move. There are no board walls.</p>
          </div>
        </aside>
        <section className="game-panel" aria-label="Interactive puzzle">
          <div className="game-heading">
            <div>
              <p className="eyebrow">{level.topic}</p>
              <h2>{level.name}</h2>
            </div>
            <div className="move-counter">
              <strong>{String(step).padStart(2, "0")}</strong>
              <span>MOVES</span>
            </div>
          </div>
          <p className="level-description">{level.description}</p>
          <div className="board-wrap">
            <svg
              className="board"
              viewBox={`0 0 ${(maxX - minX + 1) * size} ${(maxY - minY + 1) * size}`}
              aria-label="Square movement board"
            >
              {boardCells}
            </svg>
            <span className="board-caption">INTEGER GRID · SIDE ADJACENCY</span>
          </div>
          <div className="board-toolbar">
            <div>
              <button onClick={() => travel(step - 1)} disabled={step === 0}>
                ↶ <span>Undo</span>
              </button>
              <button
                onClick={() => travel(step + 1)}
                disabled={step === history.length - 1}
              >
                ↷ <span>Redo</span>
              </button>
              <button onClick={() => load(levelIndex)}>
                ↺ <span>Reset</span>
              </button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={showTarget}
                onChange={(e) => setShowTarget(e.target.checked)}
              />{" "}
              Target outline
            </label>
          </div>
          <div
            className={`status ${won ? "success" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span>{won ? "✓" : "i"}</span>
            <p>
              {won
                ? `Shape matched in ${step} ${step === 1 ? "move" : "moves"}. Nicely connected.`
                : message}
            </p>
            {won && levelIndex < levels.length - 1 && (
              <button onClick={() => load(levelIndex + 1)}>
                Next challenge →
              </button>
            )}
          </div>
        </section>
        <aside className="guide-panel">
          <p className="eyebrow">YOUR FIELD GUIDE</p>
          <h2>Two ways to move.</h2>
          <article>
            <div className="guide-diagram">
              ▪ ▪<br />
              <span>▪ → ◌</span>
            </div>
            <h3>01. Slide</h3>
            <p>
              Move one cell along an edge supported by two stationary
              neighbours.
            </p>
          </article>
          <article>
            <div className="guide-diagram rotation">
              ◌ ↶<br />
              <span>▪ ▪</span>
            </div>
            <h3>02. Rotate</h3>
            <p>
              Turn around a neighbour into a diagonal cell. The swept corner
              must be empty.
            </p>
          </article>
          <div className="legend">
            <span>
              <i className="blue" /> Your squares
            </span>
            <span>
              <i className="outline" /> Target shape
            </span>
            <span>
              <i className="green" /> Legal destination
            </span>
            <span>
              <i className="orange" /> Support on hover
            </span>
          </div>
          <p className="guide-footnote">
            Select a square, then a green destination. Hover or focus a
            destination to inspect its supports.
          </p>
        </aside>
      </div>
      <footer>
        <span>Geometry you can play with.</span>
        <span>
          2D foundation · 3D compaction and constructive solvers planned
        </span>
      </footer>
    </main>
  );
}
