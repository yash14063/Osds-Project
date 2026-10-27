export enum FrameRole {
  FREE = 'FREE',
  PAGE_TABLE = 'PAGE_TABLE',
  CODE = 'CODE',
  DATA = 'DATA',
}

export enum AllocationStrategy {
  SCATTERED = 'SCATTERED',
  SEQUENTIAL = 'SEQUENTIAL',
}

export enum StepPhase {
  INIT = 'INIT',
  LOAD = 'LOAD',
  FETCH_EXECUTE = 'FETCH_EXECUTE',
  PAGE_FAULT_ALLOC = 'PAGE_FAULT_ALLOC',
  MOS_IO = 'MOS_IO',
  TERMINATED = 'TERMINATED',
}

export interface PageTableEntry {
  virtualPage: number; // 0..9
  pteAddress: number; // PTR + virtualPage
  isAllocated: boolean;
  frameNumber: number | null; // 0..29 if allocated
  role: FrameRole;
  rawWord: string; // 4 chars stored at M[PTR + virtualPage]
}

export interface AddressTranslationTrace {
  context: 'INSTRUCTION_FETCH' | 'OPERAND_ACCESS';
  virtualAddress: number | null; // 0..99
  rawOperand: string; // 2 chars e.g. "20" or "1A"
  pageNumber: number | null; // floor(VA / 10)
  offset: number | null; // VA % 10
  pteAddress: number | null; // PTR + pageNumber
  frameNumber: number | null; // mapped frame 0..29
  physicalAddress: number | null; // frameNumber * 10 + offset
  status: 'VALID' | 'VALID_PAGE_FAULT' | 'INVALID_PAGE_FAULT' | 'OPERAND_ERROR' | 'NONE';
  explanation: string;
}

export interface FrameMetadata {
  frameNumber: number; // 0..29
  role: FrameRole;
  virtualPage: number | null;
  words: string[]; // 10 words, each 4 chars
}

export interface PCB {
  jobId: string;
  ttl: number; // Total Time Limit
  tll: number; // Total Line Limit
  ttc: number; // Total Time Counter
  llc: number; // Line Limit Counter
}

export interface CpuState {
  ptr: number; // Page Table Register (physical address e.g. 140)
  ptrFrame: number; // PTR / 10 (0..29)
  ic: number; // Instruction Counter (0..99)
  ir: string; // Instruction Register (4 chars)
  r: string; // General Purpose Register (4 chars)
  c: boolean; // Toggle / Comparison Register
  si: number; // System Interrupt: 0=None, 1=GD, 2=PD, 3=H
  ti: number; // Time Interrupt: 0=Normal, 2=Time Limit Exceeded
  pi: number; // Program Interrupt: 0=None, 1=Opcode Error, 2=Operand Error, 3=Page Fault
}

export interface ExecutionStepSnapshot {
  stepIndex: number;
  phase: StepPhase;
  title: string;
  description: string;
  cpu: CpuState;
  pcb: PCB;
  memory: string[]; // 300 words of 4 characters
  frames: FrameMetadata[]; // 30 frames derived snapshot
  pageTable: PageTableEntry[]; // 10 entries
  fetchTranslation: AddressTranslationTrace | null;
  operandTranslation: AddressTranslationTrace | null;
  activeInstructionRA: number | null;
  activeOperandRA: number | null;
  newlyAllocatedFrame: number | null;
  jobOutputLines: string[];
  isTerminated: boolean;
  errorCodes: number[];
  terminationMessage: string | null;
}

export interface SimulatedJobResult {
  jobIndex: number;
  pcb: PCB;
  programCards: string[];
  dataCards: string[];
  steps: ExecutionStepSnapshot[];
  finalOutputBlock: string;
  terminatedNormally: boolean;
  errorCodes: number[];
  terminationSummary: string;
}

export interface BatchSimulationResult {
  jobs: SimulatedJobResult[];
  combinedOutputTxt: string;
  parseWarnings: string[];
}
