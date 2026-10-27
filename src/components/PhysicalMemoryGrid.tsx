import React, { useState } from 'react';
import { ExecutionStepSnapshot, FrameRole } from '../types/simulator';

interface PhysicalMemoryGridProps {
  snapshot: ExecutionStepSnapshot;
  selectedFrame: number;
  onSelectFrame: (frameNumber: number) => void;
}

function getFrameRoleMeta(role: FrameRole) {
  switch (role) {
    case FrameRole.PAGE_TABLE:
      return {
        symbol: '◆',
        shortLabel: 'Page Table',
        cellClass: 'bg-amber-50/90 text-amber-950 hover:bg-amber-100/80',
        ringClass: 'ring-2 ring-amber-600',
      };
    case FrameRole.CODE:
      return {
        symbol: '■',
        shortLabel: 'Code',
        cellClass: 'bg-sky-50/90 text-sky-950 hover:bg-sky-100/80',
        ringClass: 'ring-2 ring-sky-600',
      };
    case FrameRole.DATA:
      return {
        symbol: '●',
        shortLabel: 'Data',
        cellClass: 'bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100/80',
        ringClass: 'ring-2 ring-emerald-600',
      };
    default:
      return {
        symbol: '○',
        shortLabel: 'Free',
        cellClass: 'bg-slate-50/80 text-slate-500 hover:bg-slate-100',
        ringClass: 'ring-2 ring-slate-700',
      };
  }
}

export const PhysicalMemoryGrid: React.FC<PhysicalMemoryGridProps> = ({
  snapshot,
  selectedFrame,
  onSelectFrame,
}) => {
  const [viewMode, setViewMode] = useState<'frames' | 'all-words'>('frames');

  const allocatedCount = snapshot.frames.filter(
    (f) => f.role !== FrameRole.FREE
  ).length;

  const currentFrameObj =
    snapshot.frames[selectedFrame] ?? snapshot.frames[snapshot.cpu.ptrFrame];

  const instFrame =
    snapshot.activeInstructionRA !== null
      ? Math.floor(snapshot.activeInstructionRA / 10)
      : null;

  const opFrame =
    snapshot.activeOperandRA !== null
      ? Math.floor(snapshot.activeOperandRA / 10)
      : null;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Physical Memory (300 Words · 30 Frames × 10 Words)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5 tabular-nums">
            <span>Occupied: {allocatedCount} / 30 frames</span>
            <span aria-hidden="true">·</span>
            <span>Free: {30 - allocatedCount} frames</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-800">◆ Page Table</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-800">■ Program Code</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-800">● Job Data</span>
            <span aria-hidden="true">·</span>
            <span>○ Free</span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('frames')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'frames'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Frame Matrix + Inspector
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all-words')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'all-words'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All 300 Words
          </button>
        </div>
      </div>

      {viewMode === 'frames' ? (
        <div className="pt-5 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* 30-Frame Matrix (6 cols x 5 rows) */}
          <div className="xl:col-span-7">
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {snapshot.frames.map((frame) => {
                const meta = getFrameRoleMeta(frame.role);
                const isSelected = frame.frameNumber === selectedFrame;
                const isNewlyAlloc =
                  snapshot.newlyAllocatedFrame === frame.frameNumber;
                const isInstActive = instFrame === frame.frameNumber;
                const isOpActive = opFrame === frame.frameNumber;

                return (
                  <button
                    key={frame.frameNumber}
                    type="button"
                    onClick={() => onSelectFrame(frame.frameNumber)}
                    className={`p-2.5 rounded-lg text-left transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-600 ${
                      meta.cellClass
                    } ${
                      isSelected
                        ? meta.ringClass
                        : 'border border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-semibold tabular-nums">
                      <span>F{frame.frameNumber.toString().padStart(2, '0')}</span>
                      <span aria-hidden="true">{meta.symbol}</span>
                    </div>
                    <div className="mt-1 text-[11px] font-medium truncate">
                      {frame.role === FrameRole.PAGE_TABLE
                        ? 'PTR Table'
                        : frame.virtualPage !== null
                        ? `VP ${frame.virtualPage} · ${meta.shortLabel}`
                        : 'Free'}
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-slate-500 tabular-nums">
                      {(frame.frameNumber * 10).toString().padStart(3, '0')}–
                      {(frame.frameNumber * 10 + 9).toString().padStart(3, '0')}
                    </div>
                    {(isNewlyAlloc || isInstActive || isOpActive) && (
                      <div className="mt-1 text-[10px] font-mono font-semibold text-sky-800 truncate">
                        {isNewlyAlloc
                          ? '+ Allocated'
                          : isOpActive
                          ? '→ Target RA'
                          : '→ Fetch IC'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10-Word Physical Frame Inspector */}
          <div className="xl:col-span-5 bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                  Frame {currentFrameObj.frameNumber.toString().padStart(2, '0')}{' '}
                  Words (
                  {(currentFrameObj.frameNumber * 10)
                    .toString()
                    .padStart(3, '0')}
                  –
                  {(currentFrameObj.frameNumber * 10 + 9)
                    .toString()
                    .padStart(3, '0')}
                  )
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentFrameObj.role === FrameRole.PAGE_TABLE
                    ? `Page Table Base (PTR = ${snapshot.cpu.ptr})`
                    : currentFrameObj.virtualPage !== null
                    ? `Mapped from Virtual Page ${currentFrameObj.virtualPage} (${currentFrameObj.role})`
                    : 'Unallocated Physical Frame (Initialized to spaces)'}
                </p>
              </div>
            </div>

            <div className="mt-3 divide-y divide-slate-200/70">
              {currentFrameObj.words.map((word, offset) => {
                const physAddr = currentFrameObj.frameNumber * 10 + offset;
                const isActiveInst = snapshot.activeInstructionRA === physAddr;
                const isActiveOp = snapshot.activeOperandRA === physAddr;

                return (
                  <div
                    key={physAddr}
                    className={`py-1.5 px-2 flex items-center justify-between text-xs font-mono tabular-nums rounded-sm ${
                      isActiveOp
                        ? 'bg-emerald-100/80 text-emerald-950 font-semibold'
                        : isActiveInst
                        ? 'bg-sky-100/80 text-sky-950 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">
                        M[{physAddr.toString().padStart(3, '0')}]
                      </span>
                      <span className="text-slate-400">+{offset}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {word.split('').map((ch, idx) => (
                        <span
                          key={idx}
                          className="w-5 h-5 inline-flex items-center justify-center bg-white border border-slate-200 rounded-xs text-slate-900"
                        >
                          {ch === ' ' ? '·' : ch}
                        </span>
                      ))}
                    </div>

                    <div className="w-24 text-right text-[11px] truncate">
                      {isActiveOp ? (
                        <span className="text-emerald-800">● Operand RA</span>
                      ) : isActiveInst ? (
                        <span className="text-sky-800">■ Fetched IR</span>
                      ) : currentFrameObj.role === FrameRole.PAGE_TABLE ? (
                        <span className="text-amber-800">VP {offset} Entry</span>
                      ) : (
                        <span className="text-slate-400">4 bytes</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Full 300-Word Memory Dump View */
        <div className="pt-4 max-h-[520px] overflow-y-auto pr-1">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Frame</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                {Array.from({ length: 10 }, (_, d) => (
                  <th key={d} className="py-2 px-1.5 font-medium text-center">
                    +{d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.frames.map((frame) => {
                const meta = getFrameRoleMeta(frame.role);
                return (
                  <tr
                    key={frame.frameNumber}
                    onClick={() => {
                      onSelectFrame(frame.frameNumber);
                      setViewMode('frames');
                    }}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-1.5 pr-3 font-semibold text-slate-800 whitespace-nowrap">
                      F{frame.frameNumber.toString().padStart(2, '0')}{' '}
                      <span className="text-slate-400 font-normal">
                        ({(frame.frameNumber * 10).toString().padStart(3, '0')})
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">
                      {meta.symbol}{' '}
                      {frame.role === FrameRole.PAGE_TABLE
                        ? 'PTR'
                        : frame.virtualPage !== null
                        ? `VP${frame.virtualPage}`
                        : 'Free'}
                    </td>
                    {frame.words.map((w, d) => {
                      const addr = frame.frameNumber * 10 + d;
                      const isInst = snapshot.activeInstructionRA === addr;
                      const isOp = snapshot.activeOperandRA === addr;
                      return (
                        <td
                          key={d}
                          className={`py-1.5 px-1.5 text-center rounded-xs ${
                            isOp
                              ? 'bg-emerald-100 text-emerald-950 font-semibold'
                              : isInst
                              ? 'bg-sky-100 text-sky-950 font-semibold'
                              : w.trim() === ''
                              ? 'text-slate-300'
                              : 'text-slate-800'
                          }`}
                        >
                          {w.replace(/ /g, '·')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
