import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { CPP_SOURCE_CODE } from '../data/cppSource';

interface CppSourceViewProps {
  inputTxt: string;
  outputTxt: string;
  onDownloadFile: (filename: string, content: string) => void;
}

export const CppSourceView: React.FC<CppSourceViewProps> = ({
  inputTxt,
  outputTxt,
  onDownloadFile,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CPP_SOURCE_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback if clipboard unavailable in strict iframe
      onDownloadFile('osds_simulator.cpp', CPP_SOURCE_CODE);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Build Guide */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              C++ Reference Implementation (osds_simulator.cpp)
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Complete, standalone C++17 source code implementing the 300-word physical
              memory, 10-word frame paging, page table translation, instruction set (
              <code className="text-slate-800">GD, PD, LR, SR, CR, BT, H</code>), and
              interrupt handling (<code className="text-slate-800">SI, TI, PI</code>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  Copied C++ Code
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Source
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                onDownloadFile('osds_simulator.cpp', CPP_SOURCE_CODE)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download osds_simulator.cpp
            </button>
            <button
              type="button"
              onClick={() => onDownloadFile('input.txt', inputTxt)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              input.txt
            </button>
            <button
              type="button"
              onClick={() => onDownloadFile('output.txt', outputTxt)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              output.txt
            </button>
          </div>
        </div>

        {/* Local Compilation Steps */}
        <div className="pt-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <div className="font-semibold text-slate-900">
              01. Place Project Files in Workspace
            </div>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Save <code className="text-slate-800">osds_simulator.cpp</code> and{' '}
              <code className="text-slate-800">input.txt</code> in the same folder in VS
              Code or any C++ IDE.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              02. Compile with G++
            </div>
            <pre className="mt-1.5 p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono overflow-x-auto">
              g++ -std=c++17 osds_simulator.cpp -o osds_sim
            </pre>
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              03. Run &amp; Inspect output.txt
            </div>
            <pre className="mt-1.5 p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono overflow-x-auto">
              ./osds_sim &amp;&amp; cat output.txt
            </pre>
          </div>
        </div>
      </section>

      {/* Source Code Viewer */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
          <span className="font-mono font-semibold text-slate-800">
            osds_simulator.cpp
          </span>
          <span>Standard C++17 · Zero External Dependencies · G++ Compatible</span>
        </div>
        <pre className="mt-4 max-h-[680px] overflow-auto p-5 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed tabular-nums">
          {CPP_SOURCE_CODE}
        </pre>
      </section>
    </div>
  );
};
