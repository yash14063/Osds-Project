import React from 'react';
import { ExecutionStepSnapshot, SimulatedJobResult } from '../types/simulator';

interface CpuAndPageTableProps {
  job: SimulatedJobResult;
  snapshot: ExecutionStepSnapshot;
  currentStepIndex: number;
  onJumpToStep: (index: number) => void;
  onSelectFrame: (frameNumber: number) => void;
}

const SI_LABELS: Record<number, string> = {
  0: '0 · None',
  1: '1 · GD (Read)',
  2: '2 · PD (Write)',
  3: '3 · H (Halt)',
};

const TI_LABELS: Record<number, string> = {
  0: '0 · Normal',
  2: '2 · Time Exceeded',
};

const PI_LABELS: Record<number, string> = {
  0: '0 · None',
  1: '1 · Opcode Error',
  2: '2 · Operand Error',
  3: '3 · Page Fault',
};

export const CpuAndPageTable: React.FC<CpuAndPageTableProps> = ({
  job,
  snapshot,
  currentStepIndex,
  onJumpToStep,
  onSelectFrame,
}) => {
  const { cpu, pcb } = snapshot;

  return (
    <div className="space-y-6">
      {/* CPU Registers, Job Limits & Interrupts */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            CPU Registers &amp; Interrupt Lines
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Job {pcb.jobId}
          </span>
        </div>

        {/* Core Registers Grid */}
        <div className="pt-4 grid grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">IR (Instruction)</div>
            <div className="mt-1 text-lg font-mono font-semibold text-slate-900 tabular-nums">
              [{cpu.ir.replace(/ /g, '·')}]
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">IC (Counter)</div>
            <div className="mt-1 text-lg font-mono font-semibold text-slate-900 tabular-nums">
              {cpu.ic.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">PTR (Page Table)</div>
            <button
              type="button"
              onClick={() => onSelectFrame(cpu.ptrFrame)}
              className="mt-1 text-lg font-mono font-semibold text-sky-700 hover:underline tabular-nums"
            >
              {cpu.ptr.toString().padStart(4, '0')}
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">R (Register)</div>
            <div className="mt-1 text-lg font-mono font-semibold text-slate-900 tabular-nums">
              [{cpu.r.replace(/ /g, '·')}]
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">C (Toggle Flag)</div>
            <div
              className={`mt-1 text-lg font-mono font-semibold tabular-nums ${
                cpu.c ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {cpu.c ? 'TRUE' : 'FALSE'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-slate-500">Time (TTC / TTL)</div>
            <div
              className={`mt-1 text-lg font-mono font-semibold tabular-nums ${
                pcb.ttc > pcb.ttl ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {pcb.ttc} / {pcb.ttl}
            </div>
          </div>
        </div>

        {/* Interrupts & Output Line Limit */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs font-mono tabular-nums">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans">
              Line Limit (LLC / TLL)
            </span>
            <span className="font-semibold text-slate-800">
              {pcb.llc} / {pcb.tll} lines
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans">
              SI (System Interrupt)
            </span>
            <span
              className={
                cpu.si !== 0 ? 'font-semibold text-sky-700' : 'text-slate-600'
              }
            >
              {SI_LABELS[cpu.si] ?? cpu.si}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans">
              TI (Time Interrupt)
            </span>
            <span
              className={
                cpu.ti !== 0 ? 'font-semibold text-red-700' : 'text-slate-600'
              }
            >
              {TI_LABELS[cpu.ti] ?? cpu.ti}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans">
              PI (Program Interrupt)
            </span>
            <span
              className={
                cpu.pi !== 0 ? 'font-semibold text-red-700' : 'text-slate-600'
              }
            >
              {PI_LABELS[cpu.pi] ?? cpu.pi}
            </span>
          </div>
        </div>
      </section>

      {/* Active Job Page Table (10 Virtual Pages) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Page Table (Frame {cpu.ptrFrame.toString().padStart(2, '0')})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Maps Virtual Pages 0–9 to 10-word Physical Frames
            </p>
          </div>
        </div>

        <div className="pt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-sans">
                <th className="py-1.5 font-medium">V-Page</th>
                <th className="py-1.5 font-medium">PTE Addr</th>
                <th className="py-1.5 font-medium">Word</th>
                <th className="py-1.5 font-medium text-right">Mapping</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.pageTable.map((entry) => (
                <tr
                  key={entry.virtualPage}
                  onClick={() => {
                    if (entry.frameNumber !== null) {
                      onSelectFrame(entry.frameNumber);
                    }
                  }}
                  className={
                    entry.isAllocated
                      ? 'hover:bg-slate-50 cursor-pointer text-slate-800'
                      : 'text-slate-400'
                  }
                >
                  <td className="py-1.5 font-semibold">
                    Page {entry.virtualPage}
                  </td>
                  <td className="py-1.5">
                    M[{entry.pteAddress.toString().padStart(3, '0')}]
                  </td>
                  <td className="py-1.5">[{entry.rawWord}]</td>
                  <td className="py-1.5 text-right">
                    {entry.isAllocated && entry.frameNumber !== null ? (
                      <span className="text-sky-700 font-medium">
                        ● Frame {entry.frameNumber.toString().padStart(2, '0')}
                      </span>
                    ) : (
                      <span>○ Unmapped</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Output Buffer & Cycle Trace */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Job Output &amp; Cycle History
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {currentStepIndex + 1} / {job.steps.length} steps
          </span>
        </div>

        {/* Output Buffer Produced So Far */}
        <div className="pt-3 pb-4 border-b border-slate-100">
          <div className="text-xs font-medium text-slate-600 mb-2">
            Lines Written to output.txt ({snapshot.jobOutputLines.length})
          </div>
          {snapshot.jobOutputLines.length === 0 ? (
            <div className="text-xs text-slate-400 font-mono bg-slate-50 rounded-lg p-3">
              No PD output lines written yet at this cycle.
            </div>
          ) : (
            <pre className="text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed">
              {snapshot.jobOutputLines.join('\n')}
            </pre>
          )}
          {snapshot.isTerminated && snapshot.terminationMessage && (
            <div
              className={`mt-2.5 text-xs font-medium ${
                snapshot.errorCodes[0] === 0
                  ? 'text-emerald-700'
                  : 'text-red-700'
              }`}
            >
              {snapshot.errorCodes[0] === 0 ? '● ' : '▲ '}
              Termination Status: {snapshot.terminationMessage}
            </div>
          )}
        </div>

        {/* Interactive Step List */}
        <div className="pt-3 max-h-60 overflow-y-auto space-y-1 pr-1">
          {job.steps.map((s) => {
            const active = s.stepIndex === currentStepIndex;
            return (
              <button
                key={s.stepIndex}
                type="button"
                onClick={() => onJumpToStep(s.stepIndex)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                  active
                    ? 'bg-sky-50 text-sky-950 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="font-mono text-slate-400 tabular-nums shrink-0">
                  {s.stepIndex.toString().padStart(2, '0')}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
