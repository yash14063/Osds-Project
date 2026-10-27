export interface InputPreset {
  id: string;
  title: string;
  subtitle: string;
  inputTxt: string;
}

export const ERROR_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'No Error (Normal Termination)',
  1: 'Out of Data Error',
  2: 'Line Limit Exceeded',
  3: 'Time Limit Exceeded',
  4: 'Operation Code Error',
  5: 'Operand Error',
  6: 'Invalid Page Fault',
};

export const FULL_SUITE_INPUT_TXT = `$AMJ100100120003
GD20GD30PD20PD30H
$DTA
OSDS PAGING AND MEMORY SIMULATOR
VIRTUAL TO PHYSICAL ADDRESS MAPPING
$END1001
$AMJ100200180002
GD20LR20CR21BT06PD20H   SR40PD40H
$DTA
PASSPASSMISMATCH
$END1002
$AMJ100300100002
GD20AD20PD20H
$DTA
SAMPLE DATA FOR OPCODE CHECK
$END1003
$AMJ100400100002
GD20LR2XPD20H
$DTA
OPERAND VALIDATION TEST LINE
$END1004
$AMJ100500100002
GD20LR50PD20H
$DTA
PAGE FAULT DETECTION TEST
$END1005
$AMJ100600100002
GD20GD30PD20H
$DTA
ONLY ONE DATA CARD PROVIDED
$END1006
$AMJ100700080001
GD20PD20PD20H
$DTA
LINE LIMIT ENFORCEMENT CHECK
$END1007`;

export const INPUT_PRESETS: InputPreset[] = [
  {
    id: 'full-suite',
    title: 'Complete 7-Job Verification Suite',
    subtitle: 'Covers normal execution, conditional branching, valid/invalid page faults, opcodes, operands, EOF, and limits',
    inputTxt: FULL_SUITE_INPUT_TXT,
  },
  {
    id: 'paging-demo',
    title: 'Job 1001: Multi-Page Data Read & Print',
    subtitle: 'Demonstrates GD, valid page-fault frame allocation, page table mapping, PD, and normal Halt (EM = 0)',
    inputTxt: `$AMJ100100140003
GD20GD30LR20SR40PD20PD30PD40H
$DTA
FRAME ALLOCATION IN 300 WORD MEMORY
PAGE TABLE MAPS VIRTUAL TO PHYSICAL
$END1001`,
  },
  {
    id: 'branch-compare',
    title: 'Job 2002: Register Load, Compare & Branch',
    subtitle: 'Exercises LR, CR, BT conditional jump, SR into unmapped virtual page 5, and PD output',
    inputTxt: `$AMJ200200160002
GD20LR20CR21BT06PD20H   SR50PD50H
$DTA
SYNCSYNCMISMATCH
$END2002`,
  },
  {
    id: 'error-cases',
    title: 'Error & Interrupt Handling Batch',
    subtitle: 'Tests PI=1 (Invalid Opcode), PI=2 (Invalid Operand), PI=3 (Invalid Page Fault), and Time Limit Exceeded',
    inputTxt: `$AMJ300100080002
GD10MUL2PD10H
$DTA
INVALID OPCODE TEST
$END3001
$AMJ300200080002
GD10LR1ZPD10H
$DTA
NON NUMERIC OPERAND TEST
$END3002
$AMJ300300080002
LR70PD70H
$DTA
READ UNALLOCATED PAGE 7
$END3003
$AMJ300400040005
GD10LR10CR10BT01H
$DTA
INFINITE LOOP STOPPED BY TTL
$END3004`,
  },
];
