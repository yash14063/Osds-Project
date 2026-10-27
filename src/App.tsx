/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { CPP_SOURCE_CODE } from './data/cppSource';
import { FULL_SUITE_INPUT_TXT } from './data/presets';
import { runBatchSimulation } from './engine/osdsSimulator';
import { AllocationStrategy } from './types/simulator';
import { AddressTranslationDiagram } from './components/AddressTranslationDiagram';
import { PhysicalMemoryGrid } from './components/PhysicalMemoryGrid';
import { CpuAndPageTable } from './components/CpuAndPageTable';
import { IoWorkbenchView } from './components/IoWorkbenchView';
import { CppSourceView } from './components/CppSourceView';
import { ArchitectureDocsView } from './components/ArchitectureDocsView';

type ActiveTab = 'simulator' | 'io' | 'cpp' | 'architecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [inputTxt, setInputTxt] = useState<string>(FULL_SUITE_INPUT_TXT);
  const [strategy, setStrategy] = useState<AllocationStrategy>(
    AllocationStrategy.SCATTERED
  );

  const [selectedJobIndex, setSelectedJobIndex] = useState<number>(0);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [stepDelayMs, setStepDelayMs] = useState<number>(500);
  const [selectedFrame, setSelectedFrame] = useState<number>(0);

  const batchResult = useMemo(
    () => runBatchSimulation(inputTxt, strategy),
    [inputTxt, strategy]
  );

  const safeJobIndex =
    batchResult.jobs.length === 0
      ? 0
      : Math.min(selectedJobIndex, batchResult.jobs.length - 1);

  const activeJob = batchResult.jobs[safeJobIndex] ?? null;

  const safeStepIndex = activeJob
    ? Math.min(currentStepIndex, activeJob.steps.length - 1)
    : 0;

  const activeSnapshot = activeJob ? activeJob.steps[safeStepIndex] : null;

  // Keep selectedFrame synchronized with newly allocated or active operand/instruction frame when stepping
  useEffect(() => {
    if (!activeSnapshot) return;
    if (activeSnapshot.newlyAllocatedFrame !== null) {
      setSelectedFrame(activeSnapshot.newlyAllocatedFrame);
    } else if (activeSnapshot.activeOperandRA !== null) {
      setSelectedFrame(Math.floor(activeSnapshot.activeOperandRA / 10));
    } else if (activeSnapshot.activeInstructionRA !== null) {
      setSelectedFrame(Math.floor(activeSnapshot.activeInstructionRA / 10));
    } else {
      setSelectedFrame(activeSnapshot.cpu.ptrFrame);
    }
  }, [activeSnapshot]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !activeJob) return;
    if (safeStepIndex >= activeJob.steps.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentStepIndex((prev) =>
        Math.min(prev + 1, activeJob.steps.length - 1)
      );
    }, stepDelayMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, safeStepIndex, activeJob, stepDelayMs]);

  const handleSelectJob = (index: number) => {
    setIsPlaying(false);
    setSelectedJobIndex(index);
    setCurrentStepIndex(0);
  };

  const handleInspectJobFromIo = (jobIndex: number) => {
    handleSelectJob(jobIndex);
    setActiveTab('simulator');
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('simulator');
            }}
            className="text-base md:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            OSDS Paging Simulator
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 md:gap-7 text-sm font-medium text-slate-600 overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'simulator'
                  ? 'text-slate-900 border-sky-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('io')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'io'
                  ? 'text-slate-900 border-sky-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Input &amp; Output
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cpp')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'cpp'
                  ? 'text-slate-900 border-sky-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              C++ Source
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'architecture'
                  ? 'text-slate-900 border-sky-600'
                  : 'border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Architecture
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() =>
                handleDownloadFile('osds_simulator.cpp', CPP_SOURCE_CODE)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download C++
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (1440px Desktop Presence) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* Simulation Control Deck */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Job Selector + Allocation Mode */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="job-select"
                      className="text-xs font-medium text-slate-600 whitespace-nowrap"
                    >
                      Active Job:
                    </label>
                    <select
                      id="job-select"
                      value={safeJobIndex}
                      onChange={(e) => handleSelectJob(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-2 focus:outline-sky-600 cursor-pointer"
                    >
                      {batchResult.jobs.map((j) => (
                        <option key={j.jobIndex} value={j.jobIndex}>
                          Job {j.pcb.jobId} — {j.terminationSummary}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setStrategy(AllocationStrategy.SCATTERED);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        strategy === AllocationStrategy.SCATTERED
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Scattered Frames
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setStrategy(AllocationStrategy.SEQUENTIAL);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        strategy === AllocationStrategy.SEQUENTIAL
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sequential Frames
                    </button>
                  </div>
                </div>

                {/* Step Playback Controls & Speed Slider */}
                {activeJob && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 mr-2">
                      <label
                        htmlFor="speed-slider"
                        className="text-xs text-slate-500 whitespace-nowrap tabular-nums"
                      >
                        Delay: {stepDelayMs} ms
                      </label>
                      <input
                        id="speed-slider"
                        type="range"
                        min={150}
                        max={1200}
                        step={50}
                        value={stepDelayMs}
                        onChange={(e) => setStepDelayMs(Number(e.target.value))}
                        className="w-24 accent-sky-600 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex(0);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>

                    <button
                      type="button"
                      disabled={safeStepIndex <= 0}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex((p) => Math.max(0, p - 1));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Step Back
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (safeStepIndex >= activeJob.steps.length - 1) {
                          setCurrentStepIndex(0);
                          setIsPlaying(true);
                        } else {
                          setIsPlaying((prev) => !prev);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          {safeStepIndex >= activeJob.steps.length - 1
                            ? 'Replay Job'
                            : 'Play Simulation'}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={safeStepIndex >= activeJob.steps.length - 1}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex((p) =>
                          Math.min(activeJob.steps.length - 1, p + 1)
                        );
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Step Forward
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Active Cycle Explanation Strip */}
              {activeSnapshot && activeJob && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-baseline justify-between gap-4">
                  <div className="space-y-1 max-w-4xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span className="font-semibold text-sky-700">
                        Cycle {safeStepIndex + 1} of {activeJob.steps.length}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans font-semibold text-slate-900 text-sm">
                        {activeSnapshot.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activeSnapshot.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('io')}
                    className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Edit input.txt / View Full output.txt →
                  </button>
                </div>
              )}
            </section>

            {/* Two-Zone Educational Sandbox Layout */}
            {activeJob && activeSnapshot ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Interactive Stage (~67% width) */}
                <div className="lg:col-span-8 space-y-6">
                  <AddressTranslationDiagram
                    snapshot={activeSnapshot}
                    onSelectFrame={(f) => setSelectedFrame(f)}
                  />
                  <PhysicalMemoryGrid
                    snapshot={activeSnapshot}
                    selectedFrame={selectedFrame}
                    onSelectFrame={(f) => setSelectedFrame(f)}
                  />
                </div>

                {/* Right Control, Registers & Page Table Deck (~33% width) */}
                <div className="lg:col-span-4">
                  <CpuAndPageTable
                    job={activeJob}
                    snapshot={activeSnapshot}
                    currentStepIndex={safeStepIndex}
                    onJumpToStep={(idx) => {
                      setIsPlaying(false);
                      setCurrentStepIndex(idx);
                    }}
                    onSelectFrame={(f) => setSelectedFrame(f)}
                  />
                </div>
              </div>
            ) : (
              <section className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <h2 className="text-base font-semibold text-slate-900">
                  No Valid $AMJ Jobs Found in input.txt
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Open the Input &amp; Output tab to load a sample job suite or add an{' '}
                  <code>$AMJ</code> control block.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('io')}
                  className="mt-4 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                >
                  Open Input &amp; Output Editor
                </button>
              </section>
            )}
          </div>
        )}

        {activeTab === 'io' && (
          <IoWorkbenchView
            inputTxt={inputTxt}
            onChangeInputTxt={(next) => {
              setIsPlaying(false);
              setInputTxt(next);
              setSelectedJobIndex(0);
              setCurrentStepIndex(0);
            }}
            batchResult={batchResult}
            onInspectJobInSimulator={handleInspectJobFromIo}
            onDownloadFile={handleDownloadFile}
          />
        )}

        {activeTab === 'cpp' && (
          <CppSourceView
            inputTxt={inputTxt}
            outputTxt={batchResult.combinedOutputTxt}
            onDownloadFile={handleDownloadFile}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureDocsView />}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12 px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            OSDS Project · Paging, Page Tables, Address Translation &amp; Memory Management Simulator
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleDownloadFile('input.txt', inputTxt)}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Download input.txt
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                handleDownloadFile('output.txt', batchResult.combinedOutputTxt)
              }
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Download output.txt
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() =>
                handleDownloadFile('osds_simulator.cpp', CPP_SOURCE_CODE)
              }
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Download C++ Source
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
