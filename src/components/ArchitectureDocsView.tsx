import React from 'react';

const INSTRUCTION_SET = [
  {
    opcode: 'GD',
    syntax: 'GDxx',
    name: 'Get Data',
    interrupt: 'SI = 1',
    behavior:
      'Reads a 40-character data card (10 words) from input.txt into the physical frame mapped to virtual block xx. Allocates a frame on valid page fault.',
  },
  {
    opcode: 'PD',
    syntax: 'PDxx',
    name: 'Put Data',
    interrupt: 'SI = 2',
    behavior:
      'Writes 10 words (40 characters) from the physical frame mapped to virtual address xx into output.txt and increments Line Limit Counter (LLC).',
  },
  {
    opcode: 'LR',
    syntax: 'LRxx',
    name: 'Load Register',
    interrupt: 'User Mode',
    behavior:
      'Translates virtual address xx to physical address RA and loads the 4-character word M[RA] into CPU General Register R.',
  },
  {
    opcode: 'SR',
    syntax: 'SRxx',
    name: 'Store Register',
    interrupt: 'User Mode',
    behavior:
      'Stores the 4-character contents of General Register R into M[RA]. If page is unmapped, triggers a valid page fault to allocate a new frame.',
  },
  {
    opcode: 'CR',
    syntax: 'CRxx',
    name: 'Compare Register',
    interrupt: 'User Mode',
    behavior:
      'Compares 4-character Register R with M[RA]. Sets comparison toggle flag C = TRUE if identical, otherwise C = FALSE.',
  },
  {
    opcode: 'BT',
    syntax: 'BTxx',
    name: 'Branch if True',
    interrupt: 'User Mode',
    behavior:
      'If comparison toggle C is TRUE, sets Instruction Counter IC = xx to jump execution; otherwise continues sequentially.',
  },
  {
    opcode: 'H',
    syntax: 'H   ',
    name: 'Halt',
    interrupt: 'SI = 3',
    behavior:
      'Stops execution of the current job and invokes Master Mode (MOS) for normal job termination (Error Code 0) if within time limits.',
  },
];

const ERROR_CODES = [
  {
    code: 'EM = 0',
    condition: 'SI = 3, TI = 0',
    meaning: 'No Error (Normal Termination on H instruction)',
  },
  {
    code: 'EM = 1',
    condition: 'SI = 1 at $END',
    meaning: 'Out of Data Error (GD attempted when no data cards remain)',
  },
  {
    code: 'EM = 2',
    condition: 'LLC > TLL on PD',
    meaning: 'Line Limit Exceeded (Output lines exceeded job TLL quota)',
  },
  {
    code: 'EM = 3',
    condition: 'TI = 2 (TTC > TTL)',
    meaning: 'Time Limit Exceeded (Execution cycles exceeded job TTL quota)',
  },
  {
    code: 'EM = 4',
    condition: 'PI = 1',
    meaning: 'Operation Code Error (Unrecognized instruction opcode in IR)',
  },
  {
    code: 'EM = 5',
    condition: 'PI = 2',
    meaning: 'Operand Error (Non-numeric or out-of-range virtual operand)',
  },
  {
    code: 'EM = 6',
    condition: 'PI = 3 (Read)',
    meaning: 'Invalid Page Fault (Reading unallocated virtual page on LR/PD/CR)',
  },
];

export const ArchitectureDocsView: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* 1. Overview, Problem Statement & Objectives */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="text-xs font-medium text-sky-700">
            Operating System Design &amp; Simulation (OSDS)
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mt-1 text-balance">
            Paging and Memory Management Simulator Architecture
          </h1>
          <p className="text-sm md:text-base text-slate-600 mt-3 leading-relaxed">
            Programs reference instructions and data using logical virtual addresses
            (00–99), whereas hardware stores words in physical RAM frames. This project
            demonstrates how an operating system manages 300 words of physical memory,
            allocates 10-word frames, maintains per-job page tables, translates virtual
            addresses into physical locations, and handles interrupts and termination
            conditions.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Problem Statement</h2>
            <p className="text-slate-600 mt-1.5 text-xs leading-relaxed">
              Understand and model how an operating system isolates jobs from physical
              memory layout by mapping contiguous virtual address spaces onto
              non-contiguous physical frames while enforcing CPU time and I/O limits.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Core Memory Geometry</h2>
            <ul className="text-slate-600 mt-1.5 text-xs leading-relaxed space-y-1 font-mono tabular-nums">
              <li>Physical Memory: 300 words (4 chars/word)</li>
              <li>Frame Size: 10 words per frame (30 frames)</li>
              <li>Virtual Space: 100 words (10 pages × 10 words)</li>
              <li>Page Table: 1 dedicated 10-word frame (PTR)</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Execution Pipeline</h2>
            <p className="text-slate-600 mt-1.5 text-xs leading-relaxed">
              Reads batch jobs from <code className="text-slate-800">input.txt</code>,
              allocates a Page Table frame and program frames, executes CPU cycles via
              MMU translation, services interrupts in Master Mode (MOS), and logs
              outputs and register states to{' '}
              <code className="text-slate-800">output.txt</code>.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Instruction Set & Error Handling Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Supported Instruction Set
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Each instruction occupies 1 word (4 characters: 2-char opcode + 2-digit virtual address)
            </p>
          </div>

          <div className="pt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Opcode</th>
                  <th className="py-2 pr-3 font-medium">Meaning</th>
                  <th className="py-2 pr-3 font-medium">Mode</th>
                  <th className="py-2 font-medium">Operation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {INSTRUCTION_SET.map((inst) => (
                  <tr key={inst.opcode}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-sky-800 whitespace-nowrap">
                      {inst.syntax}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                      {inst.name}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {inst.interrupt}
                    </td>
                    <td className="py-2.5 text-slate-600 leading-relaxed">
                      {inst.behavior}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Interrupts &amp; Termination Codes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hardware interrupts (SI, TI, PI) transition CPU into Master Mode (MOS)
            </p>
          </div>

          <div className="pt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Trigger</th>
                  <th className="py-2 font-medium">Termination Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ERROR_CODES.map((err) => (
                  <tr key={err.code}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {err.code}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                      {err.condition}
                    </td>
                    <td className="py-2.5 text-slate-600 leading-relaxed">
                      {err.meaning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 3. Explicit Scope Boundaries: Current Limitations vs Proposed Future Enhancements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Current Scope &amp; Limitations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Intentional boundaries of this simplified OSDS simulation model
          </p>
          <ul className="mt-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-800">
                Simplified OS Model:
              </span>{' '}
              Focuses specifically on paging, page tables, address translation, and
              single-job-at-a-time batch execution rather than a full kernel.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                No Full Demand Paging or Swapping:
              </span>{' '}
              Program cards are loaded prior to execution, and frame allocation on page
              faults is restricted to <code className="text-slate-800">GD</code> and{' '}
              <code className="text-slate-800">SR</code> data writes without secondary
              backing-store swap space.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                No FIFO or LRU Page Replacement:
              </span>{' '}
              Frames are allocated from free physical memory without evicting or
              replacing existing pages via FIFO, Optimal, or LRU algorithms.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                No Multiprocess Scheduling or Synchronization:
              </span>{' '}
              Does not include preemptive CPU scheduling queues, semaphores, mutexes,
              or deadlock detection/recovery.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Proposed Future Enhancements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Planned extensions beyond the baseline C++ simulator specification
          </p>
          <ul className="mt-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <li>
              <span className="font-semibold text-slate-800">
                Full Demand Paging with Backing Store:
              </span>{' '}
              Load code and data pages lazily from simulated drum/disk storage only when
              referenced during execution.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                FIFO &amp; LRU Page-Replacement Algorithms:
              </span>{' '}
              Introduce frame eviction policies when all 30 physical frames are occupied
              under multiprogramming workloads.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                Page-Fault Counters &amp; Algorithm Benchmarking:
              </span>{' '}
              Track hit/miss ratios and compare page-fault rates across FIFO, LRU, and
              Optimal replacement strategies.
            </li>
            <li>
              <span className="font-semibold text-slate-800">
                Multiprogramming Ready Queue &amp; Spooling:
              </span>{' '}
              Extend with input/output spooling and Round-Robin CPU scheduling across
              concurrent resident jobs.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
