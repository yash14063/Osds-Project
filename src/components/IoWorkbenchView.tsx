import React, { useRef } from 'react';
import { Download, Play, Upload } from 'lucide-react';
import { INPUT_PRESETS } from '../data/presets';
import { BatchSimulationResult } from '../types/simulator';

interface IoWorkbenchViewProps {
  inputTxt: string;
  onChangeInputTxt: (next: string) => void;
  batchResult: BatchSimulationResult;
  onInspectJobInSimulator: (jobIndex: number) => void;
  onDownloadFile: (filename: string, content: string) => void;
}

export const IoWorkbenchView: React.FC<IoWorkbenchViewProps> = ({
  inputTxt,
  onChangeInputTxt,
  batchResult,
  onInspectJobInSimulator,
  onDownloadFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        onChangeInputTxt(ev.target.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      {/* Preset Selector & Format Reference */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Batch Job Input (input.txt) &amp; Generated Results (output.txt)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Edit job control cards (<code className="text-slate-800">$AMJ</code>,{' '}
              <code className="text-slate-800">$DTA</code>,{' '}
              <code className="text-slate-800">$END</code>), program instructions, and
              input data below. Every edit re-executes all jobs immediately and updates{' '}
              <code className="text-slate-800">output.txt</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Load Local input.txt
            </button>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {INPUT_PRESETS.map((preset) => {
            const isCurrent = inputTxt.trim() === preset.inputTxt.trim();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChangeInputTxt(preset.inputTxt)}
                className={`p-3.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-sky-50 ring-1 ring-sky-600 text-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900">
                  {preset.title}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {preset.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Side-by-Side input.txt Editor and output.txt Result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: input.txt */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-mono">
                input.txt
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Format: $AMJ[JID:4][TTL:4][TLL:4] · Program Cards · $DTA · Data · $END[JID:4]
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDownloadFile('input.txt', inputTxt)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download input.txt
            </button>
          </div>

          <textarea
            value={inputTxt}
            onChange={(e) => onChangeInputTxt(e.target.value)}
            spellCheck={false}
            aria-label="input.txt job stream editor"
            className="mt-4 flex-1 min-h-[420px] w-full p-4 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-2 focus:outline-sky-600 resize-y"
          />

          {batchResult.parseWarnings.length > 0 && (
            <div className="mt-3 text-xs text-amber-800 space-y-1">
              {batchResult.parseWarnings.map((w, i) => (
                <div key={i}>▲ {w}</div>
              ))}
            </div>
          )}
        </section>

        {/* Right: output.txt */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900 font-mono">
                output.txt
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Generated across {batchResult.jobs.length} parsed job(s)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onDownloadFile('output.txt', batchResult.combinedOutputTxt)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download output.txt
            </button>
          </div>

          <pre className="mt-4 flex-1 min-h-[420px] max-h-[560px] overflow-auto w-full p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed tabular-nums">
            {batchResult.combinedOutputTxt ||
              'No jobs found in input.txt. Add an $AMJ job block to generate output.txt.'}
          </pre>
        </section>
      </div>

      {/* Batch Execution Summary Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Batch Execution Summary ({batchResult.jobs.length} Jobs)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select any job row to trace its step-by-step memory frames, page table, and CPU registers in the Simulator.
          </p>
        </div>

        <div className="pt-3 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-medium">Job ID</th>
                <th className="py-2.5 pr-4 font-medium">Instructions</th>
                <th className="py-2.5 pr-4 font-medium">Time (TTC / TTL)</th>
                <th className="py-2.5 pr-4 font-medium">Lines (LLC / TLL)</th>
                <th className="py-2.5 pr-4 font-medium">Termination Reason</th>
                <th className="py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batchResult.jobs.map((job) => (
                <tr key={job.jobIndex} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono font-semibold text-slate-900">
                    {job.pcb.jobId}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-600 max-w-xs truncate">
                    {job.programCards.join(' ')}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-700">
                    {job.pcb.ttc} / {job.pcb.ttl}
                  </td>
                  <td className="py-3 pr-4 font-mono text-slate-700">
                    {job.pcb.llc} / {job.pcb.tll}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`font-medium ${
                        job.terminatedNormally
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {job.terminatedNormally ? '● ' : '▲ '}
                      {job.terminationSummary}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onInspectJobInSimulator(job.jobIndex)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      Step in Simulator
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
