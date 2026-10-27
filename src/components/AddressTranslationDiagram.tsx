import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ExecutionStepSnapshot } from '../types/simulator';

interface AddressTranslationDiagramProps {
  snapshot: ExecutionStepSnapshot;
  onSelectFrame?: (frameNumber: number) => void;
}

export const AddressTranslationDiagram: React.FC<AddressTranslationDiagramProps> = ({
  snapshot,
  onSelectFrame,
}) => {
  const [mode, setMode] = useState<'live' | 'probe'>('live');
  const [probeVA, setProbeVA] = useState<number>(20);

  // Choose operand translation if available on this step; otherwise instruction fetch
  const activeTrace = snapshot.operandTranslation ?? snapshot.fetchTranslation;

  // Compute interactive probe translation against current job's live Page Table
  const probePage = Math.floor(probeVA / 10);
  const probeOffset = probeVA % 10;
  const probePteAddr = snapshot.cpu.ptr + probePage;
  const probeEntry = snapshot.pageTable[probePage];
  const probeFrame = probeEntry?.isAllocated ? probeEntry.frameNumber : null;
  const probeRA = probeFrame !== null ? probeFrame * 10 + probeOffset : null;
  const probeWord = probeRA !== null ? snapshot.memory[probeRA] : null;

  const isProbe = mode === 'probe';

  const displayVA = isProbe
    ? probeVA.toString().padStart(2, '0')
    : activeTrace?.rawOperand ?? '--';

  const displayPage = isProbe
    ? probePage
    : activeTrace?.pageNumber ?? null;

  const displayOffset = isProbe
    ? probeOffset
    : activeTrace?.offset ?? null;

  const displayPteAddr = isProbe
    ? probePteAddr
    : activeTrace?.pteAddress ?? null;

  const displayFrame = isProbe
    ? probeFrame
    : activeTrace?.frameNumber ?? null;

  const displayRA = isProbe
    ? probeRA
    : activeTrace?.physicalAddress ?? null;

  const statusSummary = (() => {
    if (isProbe) {
      if (probeFrame !== null && probeRA !== null) {
        return {
          symbol: '●',
          tone: 'text-emerald-700',
          label: `Mapped · Physical Word M[${probeRA.toString().padStart(3, '0')}] = "${probeWord}"`,
        };
      }
      return {
        symbol: '▲',
        tone: 'text-amber-700',
        label: `Unmapped Page ${probePage} · Accessing triggers Page Fault (PI = 3)`,
      };
    }

    if (!activeTrace) {
      return {
        symbol: '○',
        tone: 'text-slate-500',
        label: 'Awaiting instruction fetch or memory operand translation',
      };
    }

    switch (activeTrace.status) {
      case 'VALID':
        return {
          symbol: '●',
          tone: 'text-sky-700',
          label:
            activeTrace.context === 'OPERAND_ACCESS'
              ? 'Operand Address Translated'
              : 'Instruction Fetch Address Translated',
        };
      case 'VALID_PAGE_FAULT':
        return {
          symbol: '◆',
          tone: 'text-emerald-700',
          label: 'Valid Page Fault (PI = 3) · OS Allocated Frame & Updated Page Table',
        };
      case 'INVALID_PAGE_FAULT':
        return {
          symbol: '▲',
          tone: 'text-red-700',
          label: 'Invalid Page Fault (PI = 3) · Unallocated Virtual Page Read',
        };
      case 'OPERAND_ERROR':
        return {
          symbol: '▲',
          tone: 'text-red-700',
          label: 'Operand Error (PI = 2) · Non-Numeric Virtual Address',
        };
      default:
        return {
          symbol: '○',
          tone: 'text-slate-500',
          label: 'Idle',
        };
    }
  })();

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Virtual-to-Physical Address Translation (MMU)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            <span>Formula: </span>
            <code className="text-slate-700">p = floor(VA / 10)</code>
            <span className="mx-1.5">·</span>
            <code className="text-slate-700">d = VA mod 10</code>
            <span className="mx-1.5">·</span>
            <code className="text-slate-700">RA = Frame(M[PTR + p]) × 10 + d</code>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('live')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'live'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live CPU Cycle
          </button>
          <button
            type="button"
            onClick={() => setMode('probe')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'probe'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Interactive VA Probe
          </button>
        </div>
      </div>

      {isProbe && (
        <div className="py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <label
            htmlFor="va-probe-slider"
            className="text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            Test Virtual Address (VA):{' '}
            <span className="font-mono font-semibold text-sky-700 tabular-nums">
              {probeVA.toString().padStart(2, '0')}
            </span>{' '}
            <span className="text-slate-400 font-normal">(Range: 00–99 words)</span>
          </label>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <span className="text-xs font-mono text-slate-400 tabular-nums">00</span>
            <input
              id="va-probe-slider"
              type="range"
              min={0}
              max={99}
              value={probeVA}
              onChange={(e) => setProbeVA(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-400 tabular-nums">99</span>
          </div>
        </div>
      )}

      {/* 4-Stage Pipeline Flow */}
      <div className="pt-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
        {/* Stage 1: Virtual Address */}
        <div className="bg-slate-50 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>1. Virtual Address</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-semibold text-slate-900 tabular-nums">
              {displayVA}
            </span>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {isProbe
                ? 'User Probe'
                : activeTrace?.context === 'OPERAND_ACCESS'
                ? `IR [${snapshot.cpu.ir}]`
                : `IC Fetch`}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs font-mono text-slate-600 tabular-nums">
            <span>Page p = {displayPage !== null ? displayPage : '-'}</span>
            <span>·</span>
            <span>Offset d = {displayOffset !== null ? displayOffset : '-'}</span>
          </div>
        </div>

        {/* Stage 2: Page Table Lookup */}
        <div className="bg-slate-50 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>2. Page Table Entry</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
              {displayPteAddr !== null
                ? `M[${displayPteAddr.toString().padStart(3, '0')}]`
                : 'M[---]'}
            </span>
            <button
              type="button"
              onClick={() => onSelectFrame?.(snapshot.cpu.ptrFrame)}
              className="text-xs font-mono text-sky-700 hover:underline whitespace-nowrap"
            >
              PTR = {snapshot.cpu.ptr.toString().padStart(4, '0')}
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/70 text-xs font-mono text-slate-600 tabular-nums">
            {displayPteAddr !== null
              ? `${snapshot.cpu.ptr} + ${displayPage} = ${displayPteAddr}`
              : 'No PTE lookup'}
          </div>
        </div>

        {/* Stage 3: Physical Frame */}
        <div className="bg-slate-50 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>3. Physical Frame</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-mono font-semibold tabular-nums ${
                displayFrame !== null ? 'text-slate-900' : 'text-red-600'
              }`}
            >
              {displayFrame !== null
                ? `F${displayFrame.toString().padStart(2, '0')}`
                : '****'}
            </span>
            {displayFrame !== null && onSelectFrame && (
              <button
                type="button"
                onClick={() => onSelectFrame(displayFrame)}
                className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap"
              >
                Inspect Frame
              </button>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/70 text-xs font-mono text-slate-600 tabular-nums">
            {displayFrame !== null
              ? `Words ${(displayFrame * 10).toString().padStart(3, '0')}–${(
                  displayFrame * 10 +
                  9
                )
                  .toString()
                  .padStart(3, '0')}`
              : 'Unallocated in PT'}
          </div>
        </div>

        {/* Stage 4: Real Physical Address (RA) */}
        <div className="bg-sky-50/70 rounded-lg p-3.5 flex flex-col justify-between">
          <div className="text-xs text-slate-600">4. Physical Address (RA)</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-mono font-semibold tabular-nums ${
                displayRA !== null ? 'text-sky-800' : 'text-red-700'
              }`}
            >
              {displayRA !== null
                ? displayRA.toString().padStart(3, '0')
                : 'FAULT'}
            </span>
            {displayRA !== null && (
              <span className="text-xs font-mono text-slate-700 tabular-nums">
                [{snapshot.memory[displayRA]}]
              </span>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-sky-200/60 text-xs font-mono text-slate-700 tabular-nums">
            {displayFrame !== null && displayOffset !== null && displayRA !== null
              ? `${displayFrame} × 10 + ${displayOffset} = ${displayRA}`
              : 'PI = 3 / Interrupt'}
          </div>
        </div>
      </div>

      {/* Contextual Status Line (Zero-Pill Clean Text) */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className={`font-medium ${statusSummary.tone}`}>
          <span aria-hidden="true" className="mr-1.5">
            {statusSummary.symbol}
          </span>
          <span>{statusSummary.label}</span>
        </div>
        {!isProbe && activeTrace && (
          <div className="text-slate-500 font-mono tabular-nums">
            {activeTrace.explanation}
          </div>
        )}
      </div>
    </section>
  );
};
