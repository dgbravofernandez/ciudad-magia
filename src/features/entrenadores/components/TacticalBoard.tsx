'use client'

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Stage, Layer, Rect, Circle, Line, Arc, Text, Arrow, RegularPolygon, Ellipse } from 'react-konva'

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const FULL_W = 800
const FULL_H = 520
const HALF_W = 800
const HALF_H = 520

const PITCH_GREEN = '#2d7a3e'
const LINE_COLOR = 'white'
const LINE_W = 2

const BIB_COLORS: Record<string, string> = {
  naranja: '#f97316',
  rosa: '#ec4899',
  blanco: '#f1f5f9',
}

const ARROW_COLORS = ['#ffffff', '#facc15', '#ef4444', '#3b82f6', '#22c55e']

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type PlayerBib = 'naranja' | 'rosa' | 'blanco'
type ElementTool =
  | 'player_naranja'
  | 'player_rosa'
  | 'player_blanco'
  | 'cone'
  | 'ball'
  | 'goal_large'
  | 'goal_small'
type DrawTool = 'arrow_solid' | 'arrow_dashed' | 'line_solid' | 'line_dashed' | 'rect'
type ActionTool = 'eraser'
type Tool = ElementTool | DrawTool | ActionTool

interface PlayerShape {
  kind: 'player'
  id: string
  bib: PlayerBib
  number: number
  x: number
  y: number
}

interface ConeShape {
  kind: 'cone'
  id: string
  x: number
  y: number
}

interface BallShape {
  kind: 'ball'
  id: string
  x: number
  y: number
}

interface GoalShape {
  kind: 'goal'
  id: string
  size: 'large' | 'small'
  x: number
  y: number
}

interface ArrowShape {
  kind: 'arrow'
  id: string
  points: number[]
  dashed: boolean
  color: string
}

interface LineShape {
  kind: 'line'
  id: string
  points: number[]
  dashed: boolean
  color: string
}

interface RectShape {
  kind: 'rect'
  id: string
  x: number
  y: number
  width: number
  height: number
  color: string
}

type Shape = PlayerShape | ConeShape | BallShape | GoalShape | ArrowShape | LineShape | RectShape

type FieldMode = 'full' | 'half'

interface TwoPointDraft {
  x1: number
  y1: number
}

interface TacticalBoardProps {
  onExport?: (dataUrl: string) => void
}

export interface TacticalBoardHandle {
  /** Returns a PNG data URL of the current canvas (or null if no shapes drawn). */
  exportImage: () => string | null
}

/* ------------------------------------------------------------------ */
/*  PITCH DRAWING HELPERS                                              */
/* ------------------------------------------------------------------ */

function FullPitch() {
  return (
    <>
      <Rect x={0} y={0} width={FULL_W} height={FULL_H} fill={PITCH_GREEN} />
      <Rect x={10} y={10} width={FULL_W - 20} height={FULL_H - 20} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Center line */}
      <Line points={[FULL_W / 2, 10, FULL_W / 2, FULL_H - 10]} stroke={LINE_COLOR} strokeWidth={LINE_W} />
      {/* Center circle */}
      <Circle x={FULL_W / 2} y={FULL_H / 2} radius={65} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Circle x={FULL_W / 2} y={FULL_H / 2} radius={4} fill={LINE_COLOR} />
      {/* Left penalty box */}
      <Rect x={10} y={(FULL_H - 260) / 2} width={120} height={260} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Right penalty box */}
      <Rect x={FULL_W - 130} y={(FULL_H - 260) / 2} width={120} height={260} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Left 6-yard box */}
      <Rect x={10} y={(FULL_H - 120) / 2} width={40} height={120} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Right 6-yard box */}
      <Rect x={FULL_W - 50} y={(FULL_H - 120) / 2} width={40} height={120} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Left goal */}
      <Rect x={2} y={(FULL_H - 60) / 2} width={8} height={60} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Right goal */}
      <Rect x={FULL_W - 10} y={(FULL_H - 60) / 2} width={8} height={60} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Penalty spots */}
      <Circle x={10 + 90} y={FULL_H / 2} radius={4} fill={LINE_COLOR} />
      <Circle x={FULL_W - 10 - 90} y={FULL_H / 2} radius={4} fill={LINE_COLOR} />
      {/* Corner arcs */}
      <Arc x={10} y={10} innerRadius={0} outerRadius={12} angle={90} rotation={0} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Arc x={FULL_W - 10} y={10} innerRadius={0} outerRadius={12} angle={90} rotation={90} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Arc x={FULL_W - 10} y={FULL_H - 10} innerRadius={0} outerRadius={12} angle={90} rotation={180} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Arc x={10} y={FULL_H - 10} innerRadius={0} outerRadius={12} angle={90} rotation={270} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
    </>
  )
}

function HalfPitch() {
  const W = HALF_W
  const H = HALF_H
  return (
    <>
      <Rect x={0} y={0} width={W} height={H} fill={PITCH_GREEN} />
      {/* Outer */}
      <Rect x={10} y={10} width={W - 20} height={H - 20} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Bottom line acts as center; top is goal line */}
      {/* Penalty box (centered top) */}
      <Rect x={(W - 320) / 2} y={10} width={320} height={120} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* 6-yard box */}
      <Rect x={(W - 160) / 2} y={10} width={160} height={40} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Goal */}
      <Rect x={(W - 80) / 2} y={2} width={80} height={8} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      {/* Penalty spot */}
      <Circle x={W / 2} y={10 + 90} radius={4} fill={LINE_COLOR} />
      {/* Center arc at bottom */}
      <Arc x={W / 2} y={H - 10} innerRadius={0} outerRadius={65} angle={180} rotation={180} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Circle x={W / 2} y={H - 10} radius={4} fill={LINE_COLOR} />
      {/* Corner arcs */}
      <Arc x={10} y={10} innerRadius={0} outerRadius={12} angle={90} rotation={0} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
      <Arc x={W - 10} y={10} innerRadius={0} outerRadius={12} angle={90} rotation={90} stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export const TacticalBoard = forwardRef<TacticalBoardHandle, TacticalBoardProps>(function TacticalBoard(
  { onExport },
  ref,
) {
  const stageRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [tool, setTool] = useState<Tool>('player_naranja')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [twoPointDraft, setTwoPointDraft] = useState<TwoPointDraft | null>(null)
  const [arrowColor, setArrowColor] = useState(ARROW_COLORS[0])
  const [fieldMode, setFieldMode] = useState<FieldMode>('full')

  const pitchW = fieldMode === 'full' ? FULL_W : HALF_W
  const pitchH = fieldMode === 'full' ? FULL_H : HALF_H

  // Counts per bib
  const bibCounts: Record<PlayerBib, number> = {
    naranja: shapes.filter((s) => s.kind === 'player' && s.bib === 'naranja').length,
    rosa: shapes.filter((s) => s.kind === 'player' && s.bib === 'rosa').length,
    blanco: shapes.filter((s) => s.kind === 'player' && s.bib === 'blanco').length,
  }

  /* ----- click handler ----- */
  const handleStageClick = useCallback(
    (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const stage = e.target.getStage()
      const pos = stage.getPointerPosition()
      if (!pos) return

      if (tool === 'player_naranja' || tool === 'player_rosa' || tool === 'player_blanco') {
        const bib = tool.replace('player_', '') as PlayerBib
        const number = bibCounts[bib] + 1
        const id = `player-${Date.now()}`
        setShapes((prev) => [...prev, { kind: 'player', id, bib, number, x: pos.x, y: pos.y }])
      } else if (tool === 'cone') {
        const id = `cone-${Date.now()}`
        setShapes((prev) => [...prev, { kind: 'cone', id, x: pos.x, y: pos.y }])
      } else if (tool === 'ball') {
        const id = `ball-${Date.now()}`
        setShapes((prev) => [...prev, { kind: 'ball', id, x: pos.x, y: pos.y }])
      } else if (tool === 'goal_large' || tool === 'goal_small') {
        const id = `goal-${Date.now()}`
        setShapes((prev) => [
          ...prev,
          { kind: 'goal', id, size: tool === 'goal_large' ? 'large' : 'small', x: pos.x, y: pos.y },
        ])
      } else if (
        tool === 'arrow_solid' ||
        tool === 'arrow_dashed' ||
        tool === 'line_solid' ||
        tool === 'line_dashed' ||
        tool === 'rect'
      ) {
        if (!twoPointDraft) {
          setTwoPointDraft({ x1: pos.x, y1: pos.y })
        } else {
          const id = `${tool}-${Date.now()}`
          if (tool === 'arrow_solid' || tool === 'arrow_dashed') {
            setShapes((prev) => [
              ...prev,
              {
                kind: 'arrow',
                id,
                points: [twoPointDraft.x1, twoPointDraft.y1, pos.x, pos.y],
                dashed: tool === 'arrow_dashed',
                color: arrowColor,
              },
            ])
          } else if (tool === 'line_solid' || tool === 'line_dashed') {
            setShapes((prev) => [
              ...prev,
              {
                kind: 'line',
                id,
                points: [twoPointDraft.x1, twoPointDraft.y1, pos.x, pos.y],
                dashed: tool === 'line_dashed',
                color: arrowColor,
              },
            ])
          } else if (tool === 'rect') {
            const x = Math.min(twoPointDraft.x1, pos.x)
            const y = Math.min(twoPointDraft.y1, pos.y)
            const width = Math.abs(pos.x - twoPointDraft.x1)
            const height = Math.abs(pos.y - twoPointDraft.y1)
            if (width >= 4 && height >= 4) {
              setShapes((prev) => [
                ...prev,
                { kind: 'rect', id, x, y, width, height, color: arrowColor },
              ])
            }
          }
          setTwoPointDraft(null)
        }
      }
      // eraser handled per-shape
    },
    [tool, bibCounts, twoPointDraft, arrowColor]
  )

  function handleShapeClick(id: string, e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (tool !== 'eraser') return
    e.cancelBubble = true
    setShapes((prev) => prev.filter((s) => s.id !== id))
  }

  function handleDragEnd(id: string, e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { x, y } = e.target.attrs
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        if (s.kind === 'player') return { ...s, x, y }
        if (s.kind === 'cone') return { ...s, x, y }
        if (s.kind === 'ball') return { ...s, x, y }
        if (s.kind === 'goal') return { ...s, x, y }
        if (s.kind === 'rect') return { ...s, x, y }
        return s
      })
    )
  }

  function handleClear() {
    if (!confirm('Limpiar todo el tablero?')) return
    setShapes([])
    setTwoPointDraft(null)
  }

  function handleExport() {
    if (!stageRef.current || !onExport) return
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
    onExport(dataUrl)
  }

  // Expose imperative export so parent can grab the image at submit time
  // (avoids requiring the user to remember clicking "Exportar imagen")
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (!stageRef.current) return null
      // Only export if there is actually something drawn beyond the empty pitch
      if (shapes.length === 0) return null
      try {
        return stageRef.current.toDataURL({ pixelRatio: 2 })
      } catch {
        return null
      }
    },
  }), [shapes.length])

  const isDraw =
    tool === 'arrow_solid' ||
    tool === 'arrow_dashed' ||
    tool === 'line_solid' ||
    tool === 'line_dashed' ||
    tool === 'rect'

  /* ---------------------------------------------------------------- */
  /*  TOOLBAR CONFIG                                                   */
  /* ---------------------------------------------------------------- */

  const toolSections: { label: string; items: { id: Tool; label: string; title: string }[] }[] = [
    {
      label: 'Jugadores',
      items: [
        { id: 'player_naranja', label: 'Naranja', title: 'Jugador peto naranja' },
        { id: 'player_rosa', label: 'Rosa', title: 'Jugador peto rosa' },
        { id: 'player_blanco', label: 'Blanco', title: 'Jugador peto blanco' },
      ],
    },
    {
      label: 'Objetos',
      items: [
        { id: 'cone', label: 'Cono', title: 'Colocar cono' },
        { id: 'ball', label: 'Balon', title: 'Colocar balon' },
        { id: 'goal_large', label: 'Porteria G', title: 'Porteria grande' },
        { id: 'goal_small', label: 'Porteria P', title: 'Porteria pequena' },
      ],
    },
    {
      label: 'Trazos',
      items: [
        { id: 'arrow_solid', label: 'Pase', title: 'Flecha continua (pase)' },
        { id: 'arrow_dashed', label: 'Carrera', title: 'Flecha discontinua (carrera)' },
        { id: 'line_solid', label: 'Linea', title: 'Linea recta sin punta' },
        { id: 'line_dashed', label: 'Linea -', title: 'Linea discontinua sin punta' },
        { id: 'rect', label: 'Cuadrado', title: 'Rectangulo / zona' },
      ],
    },
    {
      label: '',
      items: [
        { id: 'eraser', label: 'Borrar', title: 'Borrar elemento (clic sobre el)' },
      ],
    },
  ]

  return (
    <div className="space-y-3">
      {/* Top bar: field mode + export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Campo:</span>
          <button
            type="button"
            onClick={() => setFieldMode('full')}
            className={fieldMode === 'full' ? 'btn-primary text-xs py-1 px-3' : 'btn-secondary text-xs py-1 px-3'}
          >
            Completo
          </button>
          <button
            type="button"
            onClick={() => setFieldMode('half')}
            className={fieldMode === 'half' ? 'btn-primary text-xs py-1 px-3' : 'btn-secondary text-xs py-1 px-3'}
          >
            Medio campo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="btn-ghost text-xs py-1 px-3 text-red-600 hover:bg-red-50"
          >
            Limpiar todo
          </button>
          {onExport && (
            <button
              type="button"
              onClick={handleExport}
              className="btn-secondary text-xs py-1 px-3"
            >
              Exportar imagen
            </button>
          )}
        </div>
      </div>

      {/* Tool palette */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 rounded-lg">
        {toolSections.map((section, si) => (
          <React.Fragment key={si}>
            {si > 0 && <div className="w-px h-6 bg-border mx-1" />}
            {section.items.map((btn) => {
              const active = tool === btn.id
              // Color dot for player tools
              let dotColor: string | undefined
              if (btn.id === 'player_naranja') dotColor = BIB_COLORS.naranja
              if (btn.id === 'player_rosa') dotColor = BIB_COLORS.rosa
              if (btn.id === 'player_blanco') dotColor = BIB_COLORS.blanco

              return (
                <button
                  key={btn.id}
                  type="button"
                  title={btn.title}
                  onClick={() => {
                    setTool(btn.id)
                    setTwoPointDraft(null)
                  }}
                  className={`flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-md transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-muted'
                  }`}
                >
                  {dotColor && (
                    <span
                      className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                  {btn.id === 'cone' && <span className="text-sm">🔶</span>}
                  {btn.id === 'ball' && <span className="text-sm">⚽</span>}
                  {btn.id === 'goal_large' && <span className="text-sm">🥅</span>}
                  {btn.id === 'goal_small' && <span className="text-xs">🥅</span>}
                  {btn.id === 'arrow_solid' && <span className="text-sm">→</span>}
                  {btn.id === 'arrow_dashed' && <span className="text-sm">⇢</span>}
                  {btn.id === 'line_solid' && <span className="text-sm">─</span>}
                  {btn.id === 'line_dashed' && <span className="text-sm">┄</span>}
                  {btn.id === 'rect' && <span className="text-sm">▢</span>}
                  {btn.id === 'eraser' && <span className="text-sm">🧹</span>}
                  {btn.label}
                </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Color picker — only when drawing strokes/shapes */}
      {isDraw && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Color:</span>
          {ARROW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setArrowColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                arrowColor === c ? 'border-foreground scale-125' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {twoPointDraft && (
        <p className="text-xs text-muted-foreground">
          Punto inicial marcado — haz clic en el destino para completar.
          <button
            type="button"
            onClick={() => setTwoPointDraft(null)}
            className="ml-2 underline"
          >
            Cancelar
          </button>
        </p>
      )}

      {/* Canvas */}
      <div className="border rounded-lg overflow-hidden inline-block" style={{ maxWidth: pitchW }}>
        <Stage
          ref={stageRef}
          width={pitchW}
          height={pitchH}
          onClick={handleStageClick}
          style={{ cursor: tool === 'eraser' ? 'crosshair' : isDraw ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* Pitch */}
            {fieldMode === 'full' ? <FullPitch /> : <HalfPitch />}

            {/* Arrows (below everything else) */}
            {shapes
              .filter((s): s is ArrowShape => s.kind === 'arrow')
              .map((shape) => (
                <Arrow
                  key={shape.id}
                  points={shape.points}
                  stroke={shape.color}
                  strokeWidth={2.5}
                  fill={shape.color}
                  pointerLength={10}
                  pointerWidth={8}
                  dash={shape.dashed ? [10, 6] : undefined}
                  onClick={(e) => handleShapeClick(shape.id, e)}
                  hitStrokeWidth={12}
                />
              ))}

            {/* Two-point draft indicator (arrows / lines / rect) */}
            {twoPointDraft && (
              <Circle
                x={twoPointDraft.x1}
                y={twoPointDraft.y1}
                radius={6}
                fill={arrowColor}
                opacity={0.7}
              />
            )}

            {/* Plain lines */}
            {shapes
              .filter((s): s is LineShape => s.kind === 'line')
              .map((shape) => (
                <Line
                  key={shape.id}
                  points={shape.points}
                  stroke={shape.color}
                  strokeWidth={2.5}
                  dash={shape.dashed ? [10, 6] : undefined}
                  lineCap="round"
                  hitStrokeWidth={12}
                  onClick={(e) => handleShapeClick(shape.id, e)}
                />
              ))}

            {/* Rectangles / zones */}
            {shapes
              .filter((s): s is RectShape => s.kind === 'rect')
              .map((shape) => (
                <Rect
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  stroke={shape.color}
                  strokeWidth={2.5}
                  dash={[8, 6]}
                  fill={shape.color}
                  opacity={0.18}
                  draggable={tool !== 'eraser'}
                  onClick={(e) => handleShapeClick(shape.id, e)}
                  onDragEnd={(e) => handleDragEnd(shape.id, e)}
                />
              ))}

            {/* Cones — triangle body + base ellipse + white stripe (3D look) */}
            {shapes
              .filter((s): s is ConeShape => s.kind === 'cone')
              .map((shape) => (
                <React.Fragment key={shape.id}>
                  {/* base shadow */}
                  <Ellipse
                    x={shape.x}
                    y={shape.y + 8}
                    radiusX={11}
                    radiusY={3}
                    fill="rgba(0,0,0,0.35)"
                    listening={false}
                  />
                  {/* cone body */}
                  <RegularPolygon
                    x={shape.x}
                    y={shape.y}
                    sides={3}
                    radius={13}
                    fill="#ff7a00"
                    stroke="#a64a00"
                    strokeWidth={1.2}
                    draggable={tool !== 'eraser'}
                    onClick={(e) => handleShapeClick(shape.id, e)}
                    onDragEnd={(e) => handleDragEnd(shape.id, e)}
                  />
                  {/* white reflective stripe */}
                  <Rect
                    x={shape.x - 6}
                    y={shape.y + 1}
                    width={12}
                    height={2.5}
                    fill="#ffffff"
                    listening={false}
                  />
                </React.Fragment>
              ))}

            {/* Balls */}
            {shapes
              .filter((s): s is BallShape => s.kind === 'ball')
              .map((shape) => (
                <React.Fragment key={shape.id}>
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={10}
                    fill="white"
                    stroke="#333"
                    strokeWidth={1.5}
                    draggable={tool !== 'eraser'}
                    onClick={(e) => handleShapeClick(shape.id, e)}
                    onDragEnd={(e) => handleDragEnd(shape.id, e)}
                  />
                  {/* Pentagon pattern on ball */}
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={4}
                    fill="#333"
                    listening={false}
                  />
                </React.Fragment>
              ))}

            {/* Goals — large + small, drawn from the side: posts, crossbar, net */}
            {shapes
              .filter((s): s is GoalShape => s.kind === 'goal')
              .map((shape) => {
                const isLarge = shape.size === 'large'
                const w = isLarge ? 70 : 38
                const h = isLarge ? 26 : 16
                const post = isLarge ? 3 : 2
                const left = shape.x - w / 2
                const top = shape.y - h / 2
                const right = shape.x + w / 2
                const bottom = shape.y + h / 2
                // Net mesh — diagonal cross-hatch
                const meshSpacing = isLarge ? 8 : 6
                const meshLines: Array<{ pts: number[] }> = []
                for (let dx = meshSpacing; dx < w; dx += meshSpacing) {
                  meshLines.push({ pts: [left + dx, top, left + dx, bottom] })
                }
                for (let dy = meshSpacing; dy < h; dy += meshSpacing) {
                  meshLines.push({ pts: [left, top + dy, right, top + dy] })
                }
                return (
                  <React.Fragment key={shape.id}>
                    {/* invisible drag/click target so the goal moves as a whole */}
                    <Rect
                      x={left}
                      y={top}
                      width={w}
                      height={h}
                      fill="rgba(0,0,0,0.001)"
                      draggable={tool !== 'eraser'}
                      onClick={(e) => handleShapeClick(shape.id, e)}
                      onDragEnd={(e) => handleDragEnd(shape.id, e)}
                    />
                    {/* net mesh */}
                    {meshLines.map((m, i) => (
                      <Line
                        key={i}
                        points={m.pts}
                        stroke="rgba(255,255,255,0.55)"
                        strokeWidth={0.7}
                        listening={false}
                      />
                    ))}
                    {/* crossbar */}
                    <Line
                      points={[left, top, right, top]}
                      stroke="white"
                      strokeWidth={post}
                      lineCap="square"
                      listening={false}
                    />
                    {/* left post */}
                    <Line
                      points={[left, top, left, bottom]}
                      stroke="white"
                      strokeWidth={post}
                      lineCap="square"
                      listening={false}
                    />
                    {/* right post */}
                    <Line
                      points={[right, top, right, bottom]}
                      stroke="white"
                      strokeWidth={post}
                      lineCap="square"
                      listening={false}
                    />
                    {/* ground line (a touch thicker so it reads as the base) */}
                    <Line
                      points={[left, bottom, right, bottom]}
                      stroke="white"
                      strokeWidth={post}
                      lineCap="square"
                      listening={false}
                    />
                  </React.Fragment>
                )
              })}

            {/* Players */}
            {shapes
              .filter((s): s is PlayerShape => s.kind === 'player')
              .map((shape) => {
                const color = BIB_COLORS[shape.bib]
                const textColor = shape.bib === 'blanco' ? '#1e293b' : 'white'
                const strokeColor = shape.bib === 'blanco' ? '#94a3b8' : 'white'
                return (
                  <React.Fragment key={shape.id}>
                    <Circle
                      x={shape.x}
                      y={shape.y}
                      radius={13}
                      fill={color}
                      stroke={strokeColor}
                      strokeWidth={1.5}
                      draggable={tool !== 'eraser'}
                      onClick={(e) => handleShapeClick(shape.id, e)}
                      onDragEnd={(e) => handleDragEnd(shape.id, e)}
                      shadowColor="black"
                      shadowBlur={3}
                      shadowOpacity={0.3}
                      shadowOffset={{ x: 1, y: 1 }}
                    />
                    <Text
                      x={shape.x - 7}
                      y={shape.y - 6}
                      text={String(shape.number)}
                      fontSize={11}
                      fontStyle="bold"
                      fill={textColor}
                      align="center"
                      width={14}
                      listening={false}
                    />
                  </React.Fragment>
                )
              })}
          </Layer>
        </Stage>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BIB_COLORS.naranja }} />
          Naranja ({bibCounts.naranja})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: BIB_COLORS.rosa }} />
          Rosa ({bibCounts.rosa})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: BIB_COLORS.blanco }} />
          Blanco ({bibCounts.blanco})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm">🔶</span>
          Conos ({shapes.filter((s) => s.kind === 'cone').length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-sm">⚽</span>
          Balones ({shapes.filter((s) => s.kind === 'ball').length})
        </span>
      </div>
    </div>
  )
})
TacticalBoard.displayName = 'TacticalBoard'
