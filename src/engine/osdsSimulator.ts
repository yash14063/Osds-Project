import {
  AddressTranslationTrace,
  AllocationStrategy,
  BatchSimulationResult,
  CpuState,
  ExecutionStepSnapshot,
  FrameMetadata,
  FrameRole,
  PageTableEntry,
  PCB,
  SimulatedJobResult,
  StepPhase,
} from '../types/simulator';
import { ERROR_CODE_DESCRIPTIONS } from '../data/presets';

const TOTAL_WORDS = 300;
const FRAME_SIZE = 10;
const TOTAL_FRAMES = 30;
const PAGE_TABLE_ENTRIES = 10;
const MAX_SAFETY_STEPS = 250;

function padWord(str: string): string {
  const clean = str.slice(0, 4);
  return clean.padEnd(4, ' ');
}

function formatTwoDigits(n: number): string {
  return Math.max(0, Math.min(99, n)).toString().padStart(2, '0');
}

function formatFourDigits(n: number): string {
  return Math.max(0, n).toString().padStart(4, '0');
}

class DeterministicAllocator {
  private used: boolean[] = new Array(TOTAL_FRAMES).fill(false);
  private roles: FrameRole[] = new Array(TOTAL_FRAMES).fill(FrameRole.FREE);
  private virtualPages: (number | null)[] = new Array(TOTAL_FRAMES).fill(null);
  private seed: number;
  private strategy: AllocationStrategy;

  constructor(jobSeed: number, strategy: AllocationStrategy) {
    this.seed = jobSeed || 1337;
    this.strategy = strategy;
  }

  private nextRand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed;
  }

  allocate(role: FrameRole, virtualPage: number | null): number | null {
    const freeIndices: number[] = [];
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      if (!this.used[i]) {
        freeIndices.push(i);
      }
    }
    if (freeIndices.length === 0) {
      return null;
    }

    let chosen: number;
    if (this.strategy === AllocationStrategy.SEQUENTIAL) {
      chosen = freeIndices[0];
    } else {
      const idx = this.nextRand() % freeIndices.length;
      chosen = freeIndices[idx];
    }

    this.used[chosen] = true;
    this.roles[chosen] = role;
    this.virtualPages[chosen] = virtualPage;
    return chosen;
  }

  buildFramesSnapshot(memory: string[]): FrameMetadata[] {
    const frames: FrameMetadata[] = [];
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const base = f * FRAME_SIZE;
      frames.push({
        frameNumber: f,
        role: this.roles[f],
        virtualPage: this.virtualPages[f],
        words: memory.slice(base, base + FRAME_SIZE),
      });
    }
    return frames;
  }

  getRole(frame: number): FrameRole {
    return this.roles[frame] ?? FrameRole.FREE;
  }
}

function buildPageTableSnapshot(
  memory: string[],
  ptr: number,
  allocator: DeterministicAllocator
): PageTableEntry[] {
  const entries: PageTableEntry[] = [];
  for (let p = 0; p < PAGE_TABLE_ENTRIES; p++) {
    const pteAddr = ptr + p;
    const raw = memory[pteAddr] ?? '****';
    const isAlloc = raw !== '****' && raw.trim() !== '';
    let frameNum: number | null = null;
    if (isAlloc) {
      const parsed = parseInt(raw.slice(2, 4), 10);
      if (!Number.isNaN(parsed)) {
        frameNum = parsed;
      }
    }
    entries.push({
      virtualPage: p,
      pteAddress: pteAddr,
      isAllocated: isAlloc && frameNum !== null,
      frameNumber: frameNum,
      role: frameNum !== null ? allocator.getRole(frameNum) : FrameRole.FREE,
      rawWord: raw,
    });
  }
  return entries;
}

interface RawParsedJob {
  amjLine: string;
  programLines: string[];
  dataLines: string[];
  endLine: string;
}

function parseInputTxtJobs(inputTxt: string): {
  rawJobs: RawParsedJob[];
  warnings: string[];
} {
  const normalized = inputTxt.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const rawJobs: RawParsedJob[] = [];
  const warnings: string[] = [];

  let currentJob: RawParsedJob | null = null;
  let inDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' && !currentJob) {
      continue;
    }

    if (line.startsWith('$AMJ')) {
      if (currentJob) {
        warnings.push(`Line ${i + 1}: New $AMJ encountered before $END closed previous job.`);
        rawJobs.push(currentJob);
      }
      currentJob = {
        amjLine: line,
        programLines: [],
        dataLines: [],
        endLine: '',
      };
      inDataSection = false;
    } else if (line.startsWith('$DTA')) {
      if (!currentJob) {
        warnings.push(`Line ${i + 1}: $DTA card found outside an active $AMJ job.`);
      } else {
        inDataSection = true;
      }
    } else if (line.startsWith('$END')) {
      if (!currentJob) {
        warnings.push(`Line ${i + 1}: $END card found without matching $AMJ.`);
      } else {
        currentJob.endLine = line;
        rawJobs.push(currentJob);
        currentJob = null;
        inDataSection = false;
      }
    } else if (currentJob) {
      if (inDataSection) {
        currentJob.dataLines.push(line);
      } else {
        currentJob.programLines.push(line);
      }
    }
  }

  if (currentJob) {
    warnings.push('Final job was missing an $END control card; auto-closed at EOF.');
    rawJobs.push(currentJob);
  }

  return { rawJobs, warnings };
}

function formatErrorMessage(codes: number[]): string {
  if (codes.length === 0 || (codes.length === 1 && codes[0] === 0)) {
    return ERROR_CODE_DESCRIPTIONS[0];
  }
  return codes.map((c) => ERROR_CODE_DESCRIPTIONS[c] || `Error Code ${c}`).join(' + ');
}

function formatJobOutputBlock(
  pcb: PCB,
  cpu: CpuState,
  outputLines: string[],
  errorCodes: number[]
): string {
  const out: string[] = [];
  for (const line of outputLines) {
    out.push(line.trimEnd());
  }
  const msg = formatErrorMessage(errorCodes);
  out.push('');
  out.push(`Job ID: ${pcb.jobId} | Status: ${msg}`);
  out.push(
    `IC: ${formatTwoDigits(cpu.ic)} | IR: [${cpu.ir}] | R: [${cpu.r}] | C: ${cpu.c ? 'T' : 'F'} | PTR: ${formatFourDigits(cpu.ptr)}`
  );
  out.push(
    `TTL: ${formatFourDigits(pcb.ttl)} | TTC: ${formatFourDigits(pcb.ttc)} | TLL: ${formatFourDigits(pcb.tll)} | LLC: ${formatFourDigits(pcb.llc)} | SI: ${cpu.si} TI: ${cpu.ti} PI: ${cpu.pi}`
  );
  out.push('------------------------------------------------------------------------');
  return out.join('\n');
}

function simulateSingleJob(
  rawJob: RawParsedJob,
  jobIndex: number,
  strategy: AllocationStrategy
): SimulatedJobResult {
  const amj = rawJob.amjLine.padEnd(16, '0');
  const jobId = amj.slice(4, 8).trim() || formatFourDigits(jobIndex + 1);
  const ttlParsed = parseInt(amj.slice(8, 12), 10);
  const tllParsed = parseInt(amj.slice(12, 16), 10);

  const pcb: PCB = {
    jobId,
    ttl: Number.isNaN(ttlParsed) ? 10 : ttlParsed,
    tll: Number.isNaN(tllParsed) ? 2 : tllParsed,
    ttc: 0,
    llc: 0,
  };

  const memory: string[] = new Array(TOTAL_WORDS).fill('    ');
  const numericJobSeed = parseInt(jobId.replace(/\D/g, ''), 10) || (jobIndex + 1) * 97;
  const allocator = new DeterministicAllocator(numericJobSeed + 17, strategy);

  const ptrFrame = allocator.allocate(FrameRole.PAGE_TABLE, null) ?? 0;
  const ptr = ptrFrame * FRAME_SIZE;

  for (let i = 0; i < PAGE_TABLE_ENTRIES; i++) {
    memory[ptr + i] = '****';
  }

  const cpu: CpuState = {
    ptr,
    ptrFrame,
    ic: 0,
    ir: '    ',
    r: '    ',
    c: false,
    si: 0,
    ti: 0,
    pi: 0,
  };

  const steps: ExecutionStepSnapshot[] = [];
  const jobOutputLines: string[] = [];

  const pushSnapshot = (
    phase: StepPhase,
    title: string,
    description: string,
    opts?: {
      fetchTranslation?: AddressTranslationTrace | null;
      operandTranslation?: AddressTranslationTrace | null;
      activeInstructionRA?: number | null;
      activeOperandRA?: number | null;
      newlyAllocatedFrame?: number | null;
      isTerminated?: boolean;
      errorCodes?: number[];
      terminationMessage?: string | null;
    }
  ) => {
    steps.push({
      stepIndex: steps.length,
      phase,
      title,
      description,
      cpu: { ...cpu },
      pcb: { ...pcb },
      memory: [...memory],
      frames: allocator.buildFramesSnapshot(memory),
      pageTable: buildPageTableSnapshot(memory, cpu.ptr, allocator),
      fetchTranslation: opts?.fetchTranslation ?? null,
      operandTranslation: opts?.operandTranslation ?? null,
      activeInstructionRA: opts?.activeInstructionRA ?? null,
      activeOperandRA: opts?.activeOperandRA ?? null,
      newlyAllocatedFrame: opts?.newlyAllocatedFrame ?? null,
      jobOutputLines: [...jobOutputLines],
      isTerminated: opts?.isTerminated ?? false,
      errorCodes: opts?.errorCodes ?? [],
      terminationMessage: opts?.terminationMessage ?? null,
    });
  };

  // Snapshot 0: Job Initialization ($AMJ)
  pushSnapshot(
    StepPhase.INIT,
    `Initialize Job ${pcb.jobId} & Allocate Page Table`,
    `Parsed $AMJ control card (TTL=${pcb.ttl}, TLL=${pcb.tll}). Allocated physical Frame ${formatTwoDigits(ptrFrame)} (words ${ptr}–${ptr + 9}) for the Page Table (PTR = ${ptr}).`,
    { newlyAllocatedFrame: ptrFrame }
  );

  // Load Program Cards into Code Frames
  let codePage = 0;
  for (const card of rawJob.programLines) {
    if (codePage >= PAGE_TABLE_ENTRIES) break;
    const cleanCard = card.slice(0, 40);
    // Parse instructions on the program card cleanly (handling single-char 'H' if not padded, or standard 4-char slots)
    const tokens: string[] = [];
    let cursor = 0;
    while (cursor < cleanCard.length && tokens.length < 10) {
      if (cleanCard[cursor] === 'H') {
        // Check if padded as 'H   ' or immediately followed by another opcode
        const nextThree = cleanCard.slice(cursor + 1, cursor + 4);
        if (nextThree === '   ' || cursor + 1 >= cleanCard.length) {
          tokens.push('H   ');
          cursor += 4;
        } else {
          tokens.push('H   ');
          cursor += 1;
        }
      } else {
        tokens.push(padWord(cleanCard.slice(cursor, cursor + 4)));
        cursor += 4;
      }
    }

    const codeFrame = allocator.allocate(FrameRole.CODE, codePage);
    if (codeFrame === null) break;

    memory[ptr + codePage] = `00${formatTwoDigits(codeFrame)}`;
    for (let w = 0; w < tokens.length && w < FRAME_SIZE; w++) {
      memory[codeFrame * FRAME_SIZE + w] = tokens[w];
    }

    pushSnapshot(
      StepPhase.LOAD,
      `Load Program Card into Frame ${formatTwoDigits(codeFrame)}`,
      `Allocated physical Frame ${formatTwoDigits(codeFrame)} for Virtual Page ${codePage}. Updated Page Table entry M[${ptr + codePage}] = 00${formatTwoDigits(codeFrame)} and loaded ${tokens.length} instruction word(s).`,
      { newlyAllocatedFrame: codeFrame }
    );
    codePage++;
  }

  // Execute User Program following $DTA
  let dataCursor = 0;
  let terminated = false;
  let finalErrorCodes: number[] = [0];
  let safetyCounter = 0;

  const translateAddress = (
    va: number,
    rawOperand: string,
    context: 'INSTRUCTION_FETCH' | 'OPERAND_ACCESS'
  ): { ra: number | null; trace: AddressTranslationTrace } => {
    const page = Math.floor(va / 10);
    const offset = va % 10;
    const pteAddr = cpu.ptr + page;
    const pteWord = memory[pteAddr] ?? '****';

    if (pteWord === '****') {
      return {
        ra: null,
        trace: {
          context,
          virtualAddress: va,
          rawOperand,
          pageNumber: page,
          offset,
          pteAddress: pteAddr,
          frameNumber: null,
          physicalAddress: null,
          status: 'INVALID_PAGE_FAULT',
          explanation: `VA ${formatTwoDigits(va)} -> Page ${page}, Offset ${offset}. M[${pteAddr}] = [****] (unmapped) -> Page Fault (PI = 3).`,
        },
      };
    }

    const frame = parseInt(pteWord.slice(2, 4), 10);
    const ra = frame * 10 + offset;
    return {
      ra,
      trace: {
        context,
        virtualAddress: va,
        rawOperand,
        pageNumber: page,
        offset,
        pteAddress: pteAddr,
        frameNumber: frame,
        physicalAddress: ra,
        status: 'VALID',
        explanation: `VA ${formatTwoDigits(va)} -> Page ${page}, Offset ${offset}. M[${pteAddr}] maps to Frame ${formatTwoDigits(frame)} -> RA = ${frame} × 10 + ${offset} = ${ra}.`,
      },
    };
  };

  const finishJob = (
    codes: number[],
    fetchTrace: AddressTranslationTrace | null,
    opTrace: AddressTranslationTrace | null,
    instRA: number | null,
    opRA: number | null,
    detail: string
  ) => {
    terminated = true;
    finalErrorCodes = codes;
    const msg = formatErrorMessage(codes);
    pushSnapshot(
      StepPhase.TERMINATED,
      `Terminate Job ${pcb.jobId}: ${msg}`,
      detail,
      {
        fetchTranslation: fetchTrace,
        operandTranslation: opTrace,
        activeInstructionRA: instRA,
        activeOperandRA: opRA,
        isTerminated: true,
        errorCodes: codes,
        terminationMessage: msg,
      }
    );
  };

  while (!terminated && safetyCounter < MAX_SAFETY_STEPS) {
    safetyCounter++;
    cpu.si = 0;
    cpu.pi = 0;

    const currentIC = cpu.ic;
    if (currentIC < 0 || currentIC > 99) {
      cpu.pi = 2;
      finishJob(
        [5],
        null,
        null,
        null,
        null,
        `Instruction Counter IC=${currentIC} exceeded virtual address space (00–99).`
      );
      break;
    }

    // 1. Translate IC to fetch instruction
    const fetchResult = translateAddress(
      currentIC,
      formatTwoDigits(currentIC),
      'INSTRUCTION_FETCH'
    );

    if (fetchResult.ra === null) {
      cpu.pi = 3;
      finishJob(
        [6],
        fetchResult.trace,
        null,
        null,
        null,
        `Instruction fetch failed at Virtual Address ${formatTwoDigits(currentIC)}: Page ${Math.floor(currentIC / 10)} is unallocated (PI = 3 Invalid Page Fault).`
      );
      break;
    }

    const instRA = fetchResult.ra;
    cpu.ir = memory[instRA];
    cpu.ic = currentIC + 1;

    const op1 = cpu.ir[0] ?? ' ';
    const op2 = cpu.ir[1] ?? ' ';
    const opcode = op1 === 'H' ? 'H' : `${op1}${op2}`;
    const operandStr = cpu.ir.slice(2, 4);

    // Handle Halt ('H')
    if (opcode === 'H') {
      pcb.ttc += 1;
      if (pcb.ttc > pcb.ttl) {
        cpu.ti = 2;
      }
      cpu.si = 3;
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          null,
          instRA,
          null,
          `Fetched H (Halt) at RA ${instRA}, but Total Time Counter (${pcb.ttc}) exceeded Total Time Limit (${pcb.ttl}).`
        );
      } else {
        finishJob(
          [0],
          fetchResult.trace,
          null,
          instRA,
          null,
          `Fetched H (Halt) at RA ${instRA} (SI = 3). Job ${pcb.jobId} completed execution normally within limits (TTC = ${pcb.ttc}/${pcb.ttl}, LLC = ${pcb.llc}/${pcb.tll}).`
        );
      }
      break;
    }

    // Validate Opcode
    const validOpcodes = ['GD', 'PD', 'LR', 'SR', 'CR', 'BT'];
    if (!validOpcodes.includes(opcode)) {
      pcb.ttc += 1;
      if (pcb.ttc > pcb.ttl) cpu.ti = 2;
      cpu.pi = 1;
      const codes = cpu.ti === 2 ? [3, 4] : [4];
      finishJob(
        codes,
        fetchResult.trace,
        null,
        instRA,
        null,
        `Invalid opcode "${opcode}" in IR = [${cpu.ir}] raised Program Interrupt PI = 1 (Operation Code Error).`
      );
      break;
    }

    // Validate 2-digit numeric operand
    const d1 = operandStr[0];
    const d2 = operandStr[1];
    const isNumericOperand =
      d1 >= '0' && d1 <= '9' && d2 >= '0' && d2 <= '9';

    if (!isNumericOperand) {
      pcb.ttc += 1;
      if (pcb.ttc > pcb.ttl) cpu.ti = 2;
      cpu.pi = 2;
      const opErrTrace: AddressTranslationTrace = {
        context: 'OPERAND_ACCESS',
        virtualAddress: null,
        rawOperand: operandStr,
        pageNumber: null,
        offset: null,
        pteAddress: null,
        frameNumber: null,
        physicalAddress: null,
        status: 'OPERAND_ERROR',
        explanation: `Operand "${operandStr}" in [${cpu.ir}] is not a valid 2-digit virtual address (00–99) -> PI = 2 (Operand Error).`,
      };
      const codes = cpu.ti === 2 ? [3, 5] : [5];
      finishJob(
        codes,
        fetchResult.trace,
        opErrTrace,
        instRA,
        null,
        `Non-numeric operand "${operandStr}" in instruction [${cpu.ir}] raised Program Interrupt PI = 2 (Operand Error).`
      );
      break;
    }

    const operandVA = parseInt(operandStr, 10);
    const opResult = translateAddress(operandVA, operandStr, 'OPERAND_ACCESS');

    // Check Page Fault on Operand (PI = 3)
    if (opResult.ra === null) {
      cpu.pi = 3;
      // Check if Valid Page Fault (GD or SR) vs Invalid Page Fault (LR, PD, CR, BT)
      if (opcode === 'GD' || opcode === 'SR') {
        // Check time limit before servicing valid page fault
        if (pcb.ttc + 1 > pcb.ttl) {
          pcb.ttc += 1;
          cpu.ti = 2;
          finishJob(
            [3],
            fetchResult.trace,
            opResult.trace,
            instRA,
            null,
            `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) while handling page fault for [${cpu.ir}].`
          );
          break;
        }

        const pageToAlloc = Math.floor(operandVA / 10);
        const allocatedDataFrame = allocator.allocate(FrameRole.DATA, pageToAlloc);
        if (allocatedDataFrame === null) {
          finishJob(
            [6],
            fetchResult.trace,
            opResult.trace,
            instRA,
            null,
            `Physical memory exhausted: all 30 frames are occupied; cannot service page fault for Virtual Page ${pageToAlloc}.`
          );
          break;
        }

        memory[cpu.ptr + pageToAlloc] = `00${formatTwoDigits(allocatedDataFrame)}`;
        cpu.ic -= 1; // Decrement IC so instruction re-executes with mapped frame
        pcb.ttc += 1;

        const validFaultTrace: AddressTranslationTrace = {
          ...opResult.trace,
          frameNumber: allocatedDataFrame,
          physicalAddress: allocatedDataFrame * 10 + (operandVA % 10),
          status: 'VALID_PAGE_FAULT',
          explanation: `Valid Page Fault (PI = 3) on ${opcode} ${operandStr}: OS allocated Frame ${formatTwoDigits(allocatedDataFrame)} for Virtual Page ${pageToAlloc}, updated M[${cpu.ptr + pageToAlloc}] = 00${formatTwoDigits(allocatedDataFrame)}, and decremented IC to ${formatTwoDigits(cpu.ic)} to re-execute.`,
        };

        cpu.pi = 0;
        pushSnapshot(
          StepPhase.PAGE_FAULT_ALLOC,
          `Valid Page Fault (${opcode} ${operandStr}) -> Allocate Frame ${formatTwoDigits(allocatedDataFrame)}`,
          validFaultTrace.explanation,
          {
            fetchTranslation: fetchResult.trace,
            operandTranslation: validFaultTrace,
            activeInstructionRA: instRA,
            activeOperandRA: allocatedDataFrame * 10 + (operandVA % 10),
            newlyAllocatedFrame: allocatedDataFrame,
          }
        );
        continue;
      } else {
        // Invalid Page Fault on LR, PD, CR, BT
        pcb.ttc += 1;
        if (pcb.ttc > pcb.ttl) cpu.ti = 2;
        const codes = cpu.ti === 2 ? [3] : [6];
        finishJob(
          codes,
          fetchResult.trace,
          opResult.trace,
          instRA,
          null,
          `Instruction [${cpu.ir}] attempted to read unallocated Virtual Page ${Math.floor(operandVA / 10)} (M[${cpu.ptr + Math.floor(operandVA / 10)}] = ****) -> Invalid Page Fault (EM = 6).`
        );
        break;
      }
    }

    // Valid physical address `operandRA`
    const operandRA = opResult.ra;
    pcb.ttc += 1;
    if (pcb.ttc > pcb.ttl) {
      cpu.ti = 2;
    }

    // Execute user instruction or raise System Interrupt (SI)
    if (opcode === 'LR') {
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) during [${cpu.ir}].`
        );
        break;
      }
      cpu.r = memory[operandRA];
      pushSnapshot(
        StepPhase.FETCH_EXECUTE,
        `Execute LR ${operandStr} (Load Register)`,
        `Translated VA ${operandStr} -> RA ${operandRA}. Loaded word [${cpu.r}] from M[${operandRA}] into Register R.`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: operandRA,
        }
      );
    } else if (opcode === 'SR') {
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) during [${cpu.ir}].`
        );
        break;
      }
      memory[operandRA] = cpu.r;
      pushSnapshot(
        StepPhase.FETCH_EXECUTE,
        `Execute SR ${operandStr} (Store Register)`,
        `Translated VA ${operandStr} -> RA ${operandRA}. Stored Register R [${cpu.r}] into physical memory M[${operandRA}].`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: operandRA,
        }
      );
    } else if (opcode === 'CR') {
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) during [${cpu.ir}].`
        );
        break;
      }
      const memWord = memory[operandRA];
      cpu.c = cpu.r === memWord;
      pushSnapshot(
        StepPhase.FETCH_EXECUTE,
        `Execute CR ${operandStr} (Compare Register)`,
        `Compared R [${cpu.r}] with M[${operandRA}] [${memWord}] -> Toggle C set to ${cpu.c ? 'TRUE' : 'FALSE'}.`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: operandRA,
        }
      );
    } else if (opcode === 'BT') {
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) during [${cpu.ir}].`
        );
        break;
      }
      const branched = cpu.c;
      if (branched) {
        cpu.ic = operandVA;
      }
      pushSnapshot(
        StepPhase.FETCH_EXECUTE,
        `Execute BT ${operandStr} (Branch if True)`,
        branched
          ? `Toggle C is TRUE: branched Instruction Counter IC to Virtual Address ${formatTwoDigits(operandVA)}.`
          : `Toggle C is FALSE: branch not taken; IC proceeds to ${formatTwoDigits(cpu.ic)}.`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: operandRA,
        }
      );
    } else if (opcode === 'GD') {
      cpu.si = 1;
      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `Time Limit Exceeded (TTC=${pcb.ttc} > TTL=${pcb.ttl}) on GD ${operandStr} (SI = 1, TI = 2).`
        );
        break;
      }

      if (dataCursor >= rawJob.dataLines.length) {
        finishJob(
          [1],
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `GD ${operandStr} invoked MOS Read (SI = 1), but no data cards remain before $END -> Out of Data Error (EM = 1).`
        );
        break;
      }

      const dataCard = rawJob.dataLines[dataCursor].slice(0, 40);
      dataCursor++;
      const blockStart = Math.floor(operandRA / 10) * 10;
      for (let w = 0; w < 10; w++) {
        const chunk = dataCard.slice(w * 4, w * 4 + 4);
        memory[blockStart + w] = padWord(chunk);
      }

      cpu.si = 0;
      pushSnapshot(
        StepPhase.MOS_IO,
        `MOS Service SI=1: GD ${operandStr} (Get Data)`,
        `Read data card "${dataCard}" into Frame ${formatTwoDigits(Math.floor(blockStart / 10))} (physical words ${blockStart}–${blockStart + 9}).`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: blockStart,
        }
      );
    } else if (opcode === 'PD') {
      cpu.si = 2;
      pcb.llc += 1;
      if (pcb.llc > pcb.tll) {
        pcb.llc -= 1; // Keep LLC at actual printed count for report clarity or show attempt
        const codes = cpu.ti === 2 ? [2, 3] : [2];
        finishJob(
          codes,
          fetchResult.trace,
          opResult.trace,
          instRA,
          operandRA,
          `PD ${operandStr} attempted to write output line ${pcb.llc + 1}, exceeding Total Line Limit (TLL = ${pcb.tll}) -> Line Limit Exceeded (EM = 2).`
        );
        break;
      }

      const blockStart = Math.floor(operandRA / 10) * 10;
      let outLine = '';
      for (let w = 0; w < 10; w++) {
        outLine += memory[blockStart + w];
      }
      jobOutputLines.push(outLine.trimEnd());

      if (cpu.ti === 2) {
        finishJob(
          [3],
          fetchResult.trace,
          opResult.trace,
          instRA,
          blockStart,
          `PD ${operandStr} wrote "${outLine.trimEnd()}" to output.txt, then terminated because TTC (${pcb.ttc}) > TTL (${pcb.ttl}).`
        );
        break;
      }

      cpu.si = 0;
      pushSnapshot(
        StepPhase.MOS_IO,
        `MOS Service SI=2: PD ${operandStr} (Put Data)`,
        `Wrote Frame ${formatTwoDigits(Math.floor(blockStart / 10))} (words ${blockStart}–${blockStart + 9}) -> "${outLine.trimEnd()}" to output.txt (LLC = ${pcb.llc}/${pcb.tll}).`,
        {
          fetchTranslation: fetchResult.trace,
          operandTranslation: opResult.trace,
          activeInstructionRA: instRA,
          activeOperandRA: blockStart,
        }
      );
    }
  }

  if (!terminated) {
    finishJob(
      [3],
      null,
      null,
      null,
      null,
      `Simulation safety ceiling (${MAX_SAFETY_STEPS} cycles) reached; job terminated.`
    );
  }

  const finalSnap = steps[steps.length - 1];
  const finalOutputBlock = formatJobOutputBlock(
    finalSnap.pcb,
    finalSnap.cpu,
    finalSnap.jobOutputLines,
    finalErrorCodes
  );

  return {
    jobIndex,
    pcb: finalSnap.pcb,
    programCards: rawJob.programLines,
    dataCards: rawJob.dataLines,
    steps,
    finalOutputBlock,
    terminatedNormally: finalErrorCodes.length === 1 && finalErrorCodes[0] === 0,
    errorCodes: finalErrorCodes,
    terminationSummary: formatErrorMessage(finalErrorCodes),
  };
}

export function runBatchSimulation(
  inputTxt: string,
  strategy: AllocationStrategy = AllocationStrategy.SCATTERED
): BatchSimulationResult {
  const { rawJobs, warnings } = parseInputTxtJobs(inputTxt);
  const jobs = rawJobs.map((rj, idx) => simulateSingleJob(rj, idx, strategy));
  const combinedOutputTxt = jobs.map((j) => j.finalOutputBlock).join('\n\n');

  return {
    jobs,
    combinedOutputTxt,
    parseWarnings: warnings,
  };
}
