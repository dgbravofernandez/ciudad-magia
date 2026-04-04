'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Stage, Layer, Rect, Circle, Line, Arc, Text, Arrow } from 'react-konva'

const PITCH_W = 800
const PITCH_H = 520
const PITCH_GREEN = '#2d7a3e'
const LINE_COLOR = 'white'
const LINE_W = 2

const HOME_COLOR = '#3b82f6'
const AWAY_COLOR = '#ef4444'

type Tool = 'home' | 'away' | 'arrow' | 'eraser' | 'clear'

interface PlayerShape {
  kind: 'player'
  id: string
  team: 'home' | 'away'
  number: number
  x: number
  y: number
}

interface ArrowShape {
  kind: 'arrow'
  id: string
  points: number[]
}

type Shape = PlayerShape | ArrowShape

interface ArrowDraft {
  x1: number
  y1: number
}

interface TacticalBoardProps {
  onExport?: (dataUrl: string) => void
}

export function TacticalBoard({ onExport }: TacticalBoardProps) {
  const stageRef = useRef<any>(null)
  const [tool, setTool] = useState<Tool>('home')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [arrowDraft, setArrowDraft] = useState<ArrowDraft | null>(null)

  const homeCount = shapes.filter((s) => s.kind === 'player' && s.team === 'home').length
  const awayCount = shapes.filter((s) => s.kind === 'player' && s.team === 'away').length

  const handleStageClick = useCallback(
    (e: any) => {
      if (tool === 'clear') return

      const stage = e.target.getStage()
      const pos = stage.getPointerPosition()
      if (!pos) return

      if (tool === 'home' || tool === 'away') {
        const team = tool
        const number = team === 'home' ? homeCount + 1 : awayCount + 1
        const id = `${team}-${Date.now()}`
        setShapes((prev) => [
          ...prev,
          { kind: 'player', id, team, number, x: pos.x, y: pos.y },
        ])
      } else if (tool === 'arrow') {
        if (!arrowDraft) {
          setArrowDraft({ x1: pos.x, y1: pos.y })
        } else {
          const id = `arrow-${Date.now()}`
          setShapes((prev) => [
            ...prev,
            {
              kind: 'arrow',
              id,
              points: [arrowDraft.x1, arrowDraft.y1, pos.x, pos.y],
            },
          ])
          setArrowDraft(null)
        }
      }
    },
    [tool, homeCount, awayCount, arrowDraft]
  )

  function handleShapeClick(id: string, e: any) {
    if (tool !== 'eraser') return
    e.cancelBubble = true
    setShapes((prev) => prev.filter((s) => s.id !== id))
  }

  function handleDragEnd(id: string, e: any) {
    const { x, y } = e.target.attrs
    setShapes((prev) =>
      prev.map((s) => (s.id === id && s.kind === 'player' ? { ...s, x, y } : s))
    )
  }

  function handleClear() {
    setShapes([])
    setArrowDraft(null)
  }

  function handleExport() {
    if (!stageRef.current || !onExport) return
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 })
    onExport(dataUrl)
  }

  const toolButtons: { id: Tool; label: string; title: string }[] = [
    { id: 'home', label: '🔵 Local', title: 'Añadir jugador local' },
    { id: 'away', label: '🔴 Visitante', title: 'Añadir jugador visitante' },
    { id: 'arrow', label: '➡️ Flecha', title: 'Dibujar flecha (clic inicio, clic fin)' },
    { id: 'eraser', label: '🧹 Borrar', title: 'Borrar elemento' },
    { id: 'clear', label: '🗑️ Limpiar', title: 'Limpiar todo' },
  ]

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {toolButtons.map((btn) => (
          <button
            key={btn.id}
            title={btn.title}
            onClick={() => {
              if (btn.id === 'clear') {
                handleClear()
              } else {
                setTool(btn.id)
                setArrowDraft(null)
              }
            }}
            className={
              tool === btn.id && btn.id !== 'clear'
                ? 'btn-primary text-sm py-1.5 px-3'
                : 'btn-secondary text-sm py-1.5 px-3'
            }
          >
            {btn.label}
          </button>
        ))}

        {onExport && (
          <button
            onClick={handleExport}
            className="btn-ghost text-sm py-1.5 px-3 ml-auto"
          >
            Exportar imagen
          </button>
        )}
      </div>

      {arrowDraft && (
        <p className="text-xs text-muted-foreground">
          Inicio de flecha marcado — haz clic en el destino para completarla
        </p>
      )}

      {/* Canvas */}
      <div className="border rounded-lg overflow-hidden" style={{ maxWidth: PITCH_W }}>
        <Stage
          ref={stageRef}
          width={PITCH_W}
          height={PITCH_H}
          onClick={handleStageClick}
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'default' }}
        >
          <Layer>
            {/* Pitch background */}
            <Rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill={PITCH_GREEN} />

            {/* Outer border */}
            <Rect
              x={10} y={10}
              width={PITCH_W - 20} height={PITCH_H - 20}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Center line */}
            <Line
              points={[PITCH_W / 2, 10, PITCH_W / 2, PITCH_H - 10]}
              stroke={LINE_COLOR} strokeWidth={LINE_W}
            />

            {/* Center circle r=65 */}
            <Circle
              x={PITCH_W / 2} y={PITCH_H / 2}
              radius={65}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Center spot */}
            <Circle x={PITCH_W / 2} y={PITCH_H / 2} radius={4} fill={LINE_COLOR} />

            {/* Left penalty box: 120w x 260h centered */}
            <Rect
              x={10} y={(PITCH_H - 260) / 2}
              width={120} height={260}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Right penalty box */}
            <Rect
              x={PITCH_W - 130} y={(PITCH_H - 260) / 2}
              width={120} height={260}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Left 6-yard box: 40w x 120h centered */}
            <Rect
              x={10} y={(PITCH_H - 120) / 2}
              width={40} height={120}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Right 6-yard box */}
            <Rect
              x={PITCH_W - 50} y={(PITCH_H - 120) / 2}
              width={40} height={120}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Left goal: 8w x 60h centered */}
            <Rect
              x={2} y={(PITCH_H - 60) / 2}
              width={8} height={60}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Right goal */}
            <Rect
              x={PITCH_W - 10} y={(PITCH_H - 60) / 2}
              width={8} height={60}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Penalty spots */}
            <Circle x={10 + 90} y={PITCH_H / 2} radius={4} fill={LINE_COLOR} />
            <Circle x={PITCH_W - 10 - 90} y={PITCH_H / 2} radius={4} fill={LINE_COLOR} />

            {/* Corner arcs (radius 12) */}
            <Arc
              x={10} y={10}
              innerRadius={0} outerRadius={12}
              angle={90} rotation={0}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />
            <Arc
              x={PITCH_W - 10} y={10}
              innerRadius={0} outerRadius={12}
              angle={90} rotation={90}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />
            <Arc
              x={PITCH_W - 10} y={PITCH_H - 10}
              innerRadius={0} outerRadius={12}
              angle={90} rotation={180}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />
            <Arc
              x={10} y={PITCH_H - 10}
              innerRadius={0} outerRadius={12}
              angle={90} rotation={270}
              stroke={LINE_COLOR} strokeWidth={LINE_W} fill="transparent"
            />

            {/* Arrow shapes */}
            {shapes
              .filter((s): s is ArrowShape => s.kind === 'arrow')
              .map((shape) => (
                <Arrow
                  key={shape.id}
                  points={shape.points}
                  stroke="white"
                  strokeWidth={2}
                  fill="white"
                  pointerLength={10}
                  pointerWidth={8}
                  onClick={(e) => handleShapeClick(shape.id, e)}
                />
              ))}

            {/* Arrow draft indicator */}
            {arrowDraft && (
              <Circle
                x={arrowDraft.x1}
                y={arrowDraft.y1}
                radius={6}
                fill="white"
                opacity={0.7}
              />
            )}

            {/* Player shapes */}
            {shapes
              .filter((s): s is PlayerShape => s.kind === 'player')
              .map((shape) => (
                <React.Fragment key={shape.id}>
                  <Circle
                    x={shape.x}
                    y={shape.y}
                    radius={18}
                    fill={shape.team === 'home' ? HOME_COLOR : AWAY_COLOR}
                    stroke="white"
                    strokeWidth={2}
                    draggable={tool !== 'eraser'}
                    onClick={(e) => handleShapeClick(shape.id, e)}
                    onDragEnd={(e) => handleDragEnd(shape.id, e)}
                  />
                  <Text
                    x={shape.x - 9}
                    y={shape.y - 8}
                    text={String(shape.number)}
                    fontSize={14}
                    fontStyle="bold"
                    fill="white"
                    align="center"
                    width={18}
                    listening={false}
                  />
                </React.Fragment>
              ))}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

