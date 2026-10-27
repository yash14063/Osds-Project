export const CPP_SOURCE_CODE = `// ============================================================================
// OSDS Project: Paging and Memory Management Simulator
// Language: C++ (Standard C++17, Compiles cleanly with g++)
// Input:    input.txt
// Output:   output.txt
//
// Features Implemented:
//   1. Physical Memory: 300 words (M[300][4]), divided into 30 frames of 10 words
//   2. Page Table (PTR): Maps 10 virtual pages (0-9) to physical frames (00-29)
//   3. Virtual-to-Physical Address Translation: RA = Frame * 10 + Offset
//   4. Frame Allocation & Valid/Invalid Page-Fault Handling
//   5. CPU Execution: GD, PD, LR, SR, CR, BT, H instructions
//   6. Interrupts & Error Detection: SI, TI, PI (Invalid Opcode, Operand, Page Fault)
//   7. Job Control & Termination Tracking: TTL/TTC, TLL/LLC, EM 0-6
// ============================================================================

#include <iostream>
#include <fstream>
#include <string>
#include <iomanip>
#include <vector>
#include <cstdlib>
#include <cctype>

using namespace std;

struct PCB {
    int jobId = 0;
    int TTL = 0; // Total Time Limit
    int TLL = 0; // Total Line Limit
    int TTC = 0; // Total Time Counter
    int LLC = 0; // Line Limit Counter
};

class OSDSSimulator {
private:
    char M[300][4];             // 300-word physical memory (4 chars per word)
    char IR[4];                 // Instruction Register
    char R[4];                  // General Purpose Register
    int IC;                     // Instruction Counter (Virtual Address 00-99)
    int PTR;                    // Page Table Register (Physical base address)
    bool C;                     // Comparison Toggle Flag
    int SI, TI, PI;             // System, Time, and Program Interrupts
    bool allocatedFrames[30];   // Tracks occupied frames (00-29)
    bool jobTerminated;         // Halts current job loop upon termination
    PCB pcb;

    ifstream fin;
    ofstream fout;
    string currentLine;

    // Deterministic pseudo-random frame allocator per job
    unsigned int rngState;
    int allocateFrame() {
        vector<int> freeList;
        for (int i = 0; i < 30; ++i) {
            if (!allocatedFrames[i]) freeList.push_back(i);
        }
        if (freeList.empty()) return -1;
        rngState = (rngState * 1103515245u + 12345u) & 0x7fffffffu;
        int chosen = freeList[rngState % freeList.size()];
        allocatedFrames[chosen] = true;
        return chosen;
    }

    string errorDescription(int em) const {
        switch (em) {
            case 0: return "No Error (Normal Termination)";
            case 1: return "Out of Data Error";
            case 2: return "Line Limit Exceeded";
            case 3: return "Time Limit Exceeded";
            case 4: return "Operation Code Error";
            case 5: return "Operand Error";
            case 6: return "Invalid Page Fault";
            default: return "Unknown Error";
        }
    }

    void initJob(const string& amjCard) {
        for (int i = 0; i < 300; ++i)
            for (int j = 0; j < 4; ++j)
                M[i][j] = ' ';

        for (int j = 0; j < 4; ++j) {
            IR[j] = ' ';
            R[j] = ' ';
        }

        for (int i = 0; i < 30; ++i) allocatedFrames[i] = false;

        IC = 0;
        C = false;
        SI = 0; TI = 0; PI = 0;
        jobTerminated = false;

        pcb.jobId = stoi(amjCard.substr(4, 4));
        pcb.TTL   = stoi(amjCard.substr(8, 4));
        pcb.TLL   = stoi(amjCard.substr(12, 4));
        pcb.TTC   = 0;
        pcb.LLC   = 0;

        rngState = static_cast<unsigned int>(pcb.jobId + 17);

        // Allocate frame for Page Table and initialize 10 entries to "****"
        int ptFrame = allocateFrame();
        PTR = ptFrame * 10;
        for (int i = 0; i < 10; ++i) {
            for (int j = 0; j < 4; ++j) M[PTR + i][j] = '*';
        }
    }

    // Virtual-to-Physical Address Translation
    int addressMap(int VA) {
        if (VA < 0 || VA > 99) {
            PI = 2; // Operand Error
            return -1;
        }
        int pte = PTR + (VA / 10);
        if (M[pte][0] == '*') {
            PI = 3; // Page Fault
            return -1;
        }
        int frame = (M[pte][2] - '0') * 10 + (M[pte][3] - '0');
        return frame * 10 + (VA % 10);
    }

    void terminateJob(int em1, int em2 = -1) {
        jobTerminated = true;
        fout << "\\nJob ID: " << setw(4) << setfill('0') << pcb.jobId
             << " | Status: " << errorDescription(em1);
        if (em2 != -1) {
            fout << " + " << errorDescription(em2);
        }
        fout << "\\nIC: " << setw(2) << setfill('0') << IC
             << " | IR: [" << string(IR, 4) << "]"
             << " | R: [" << string(R, 4) << "]"
             << " | C: " << (C ? 'T' : 'F')
             << " | PTR: " << setw(4) << setfill('0') << PTR
             << "\\nTTL: " << setw(4) << setfill('0') << pcb.TTL
             << " | TTC: " << setw(4) << setfill('0') << pcb.TTC
             << " | TLL: " << setw(4) << setfill('0') << pcb.TLL
             << " | LLC: " << setw(4) << setfill('0') << pcb.LLC
             << " | SI: " << SI << " TI: " << TI << " PI: " << PI
             << "\\n------------------------------------------------------------------------\\n\\n";
    }

    void readData(int RA) {
        if (!getline(fin, currentLine) || currentLine.rfind("$END", 0) == 0) {
            terminateJob(1); // Out of Data
            return;
        }
        int blockBase = (RA / 10) * 10;
        for (int w = 0; w < 10; ++w) {
            for (int c = 0; c < 4; ++c) {
                size_t idx = w * 4 + c;
                M[blockBase + w][c] = (idx < currentLine.size()) ? currentLine[idx] : ' ';
            }
        }
        SI = 0;
    }

    void writeData(int RA) {
        pcb.LLC++;
        if (pcb.LLC > pcb.TLL) {
            pcb.LLC--;
            if (TI == 2) terminateJob(2, 3);
            else terminateJob(2); // Line Limit Exceeded
            return;
        }
        int blockBase = (RA / 10) * 10;
        string lineOut;
        for (int w = 0; w < 10; ++w) {
            lineOut.append(M[blockBase + w], 4);
        }
        while (!lineOut.empty() && lineOut.back() == ' ') lineOut.pop_back();
        fout << lineOut << "\\n";

        if (TI == 2) {
            terminateJob(3);
            return;
        }
        SI = 0;
    }

    // Master Mode (MOS Interrupt Service Routine)
    void MOS(int RA, int operandVA, const string& opcode) {
        if (TI == 0) {
            if (PI == 1) { terminateJob(4); return; }
            if (PI == 2) { terminateJob(5); return; }
            if (PI == 3) {
                // Valid Page Fault for GD and SR
                if (opcode == "GD" || opcode == "SR") {
                    int newFrame = allocateFrame();
                    if (newFrame == -1) { terminateJob(6); return; }
                    int page = operandVA / 10;
                    M[PTR + page][0] = '0';
                    M[PTR + page][1] = '0';
                    M[PTR + page][2] = static_cast<char>('0' + (newFrame / 10));
                    M[PTR + page][3] = static_cast<char>('0' + (newFrame % 10));
                    IC--; // Re-execute instruction with mapped frame
                    PI = 0;
                    return;
                } else {
                    terminateJob(6); // Invalid Page Fault
                    return;
                }
            }
            if (SI == 1) readData(RA);
            else if (SI == 2) writeData(RA);
            else if (SI == 3) terminateJob(0);
        } else if (TI == 2) {
            if (PI == 1) terminateJob(3, 4);
            else if (PI == 2) terminateJob(3, 5);
            else if (PI == 3) terminateJob(3);
            else if (SI == 1) terminateJob(3);
            else if (SI == 2) writeData(RA);
            else if (SI == 3) terminateJob(3);
            else terminateJob(3);
        }
    }

    void executeUserProgram() {
        while (!jobTerminated) {
            SI = 0; PI = 0;
            int fetchRA = addressMap(IC);
            if (PI != 0) {
                MOS(-1, IC, "");
                break;
            }

            for (int i = 0; i < 4; ++i) IR[i] = M[fetchRA][i];
            IC++;

            string opcode = (IR[0] == 'H') ? "H" : string(1, IR[0]) + string(1, IR[1]);

            if (opcode == "H") {
                pcb.TTC++;
                if (pcb.TTC > pcb.TTL) TI = 2;
                SI = 3;
                MOS(-1, 0, opcode);
                break;
            }

            if (opcode != "GD" && opcode != "PD" && opcode != "LR" &&
                opcode != "SR" && opcode != "CR" && opcode != "BT") {
                pcb.TTC++;
                if (pcb.TTC > pcb.TTL) TI = 2;
                PI = 1; // Operation Code Error
                MOS(-1, 0, opcode);
                break;
            }

            if (!isdigit(static_cast<unsigned char>(IR[2])) ||
                !isdigit(static_cast<unsigned char>(IR[3]))) {
                pcb.TTC++;
                if (pcb.TTC > pcb.TTL) TI = 2;
                PI = 2; // Operand Error
                MOS(-1, 0, opcode);
                break;
            }

            int operandVA = (IR[2] - '0') * 10 + (IR[3] - '0');
            int operandRA = addressMap(operandVA);

            pcb.TTC++;
            if (pcb.TTC > pcb.TTL) TI = 2;

            if (PI != 0) {
                MOS(operandRA, operandVA, opcode);
                continue;
            }

            if (opcode == "LR") {
                if (TI == 2) { MOS(operandRA, operandVA, opcode); break; }
                for (int i = 0; i < 4; ++i) R[i] = M[operandRA][i];
            } else if (opcode == "SR") {
                if (TI == 2) { MOS(operandRA, operandVA, opcode); break; }
                for (int i = 0; i < 4; ++i) M[operandRA][i] = R[i];
            } else if (opcode == "CR") {
                if (TI == 2) { MOS(operandRA, operandVA, opcode); break; }
                C = true;
                for (int i = 0; i < 4; ++i) {
                    if (R[i] != M[operandRA][i]) { C = false; break; }
                }
            } else if (opcode == "BT") {
                if (TI == 2) { MOS(operandRA, operandVA, opcode); break; }
                if (C) IC = operandVA;
            } else if (opcode == "GD") {
                SI = 1;
                MOS(operandRA, operandVA, opcode);
            } else if (opcode == "PD") {
                SI = 2;
                MOS(operandRA, operandVA, opcode);
            }
        }
    }

public:
    bool run(const string& inputPath, const string& outputPath) {
        fin.open(inputPath);
        fout.open(outputPath);
        if (!fin.is_open() || !fout.is_open()) {
            cerr << "Error opening " << inputPath << " or " << outputPath << endl;
            return false;
        }

        int codePage = 0;
        while (getline(fin, currentLine)) {
            if (currentLine.empty()) continue;

            if (currentLine.rfind("$AMJ", 0) == 0) {
                initJob(currentLine);
                codePage = 0;
            } else if (currentLine.rfind("$DTA", 0) == 0) {
                executeUserProgram();
                // Drain remaining data cards if job terminated early before $END
                while (currentLine.rfind("$END", 0) != 0 && getline(fin, currentLine)) {
                    if (currentLine.rfind("$END", 0) == 0) break;
                }
            } else if (currentLine.rfind("$END", 0) == 0) {
                continue;
            } else {
                // Load Program Card into newly allocated frame
                int frame = allocateFrame();
                if (frame == -1 || codePage >= 10) continue;
                M[PTR + codePage][0] = '0';
                M[PTR + codePage][1] = '0';
                M[PTR + codePage][2] = static_cast<char>('0' + (frame / 10));
                M[PTR + codePage][3] = static_cast<char>('0' + (frame % 10));

                size_t cursor = 0;
                int wordIdx = 0;
                while (cursor < currentLine.size() && wordIdx < 10) {
                    if (currentLine[cursor] == 'H') {
                        M[frame * 10 + wordIdx][0] = 'H';
                        M[frame * 10 + wordIdx][1] = ' ';
                        M[frame * 10 + wordIdx][2] = ' ';
                        M[frame * 10 + wordIdx][3] = ' ';
                        if (cursor + 3 < currentLine.size() &&
                            currentLine.substr(cursor + 1, 3) == "   ") {
                            cursor += 4;
                        } else {
                            cursor += 1;
                        }
                    } else {
                        for (int c = 0; c < 4; ++c) {
                            M[frame * 10 + wordIdx][c] =
                                (cursor + c < currentLine.size()) ? currentLine[cursor + c] : ' ';
                        }
                        cursor += 4;
                    }
                    wordIdx++;
                }
                codePage++;
            }
        }

        fin.close();
        fout.close();
        return true;
    }
};

int main() {
    OSDSSimulator simulator;
    if (simulator.run("input.txt", "output.txt")) {
        cout << "Simulation complete. Results written to output.txt" << endl;
        return 0;
    }
    return 1;
}
`;
