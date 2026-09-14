// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#ifndef BITCOIN_SCRIPT_INTERPRETER_H
#define BITCOIN_SCRIPT_INTERPRETER_H

#include <cstdint>
#include <vector>

typedef std::vector<unsigned char> valtype;

/** Script verification flags. */
enum : uint32_t {
    SCRIPT_VERIFY_NONE = 0,
    SCRIPT_VERIFY_P2SH = (1U << 0),
    SCRIPT_VERIFY_STRICTENC = (1U << 1),
    SCRIPT_VERIFY_DERSIG = (1U << 2),
    SCRIPT_VERIFY_LOW_S = (1U << 3),
    SCRIPT_VERIFY_NULLDUMMY = (1U << 4),
    SCRIPT_VERIFY_MINIMALDATA = (1U << 6),
    SCRIPT_VERIFY_CLEANSTACK = (1U << 8),
    SCRIPT_VERIFY_WITNESS = (1U << 11),
};

/** Script opcodes used by the interpreter. */
enum opcodetype : uint8_t {
    OP_0 = 0x00,
    OP_PUSHDATA1 = 0x4c,
    OP_PUSHDATA2 = 0x4d,
    OP_PUSHDATA4 = 0x4e,
    OP_1NEGATE = 0x4f,
    OP_1 = 0x51,
    OP_16 = 0x60,
    OP_NOP = 0x61,
    OP_IF = 0x63,
    OP_NOTIF = 0x64,
    OP_ELSE = 0x67,
    OP_ENDIF = 0x68,
    OP_VERIFY = 0x69,
    OP_RETURN = 0x6a,
    OP_DUP = 0x76,
    OP_EQUAL = 0x87,
    OP_EQUALVERIFY = 0x88,
    OP_ADD = 0x93,
    OP_SUB = 0x94,
    OP_CHECKSIG = 0xac,
};

enum class ScriptError {
    OK = 0,
    UNKNOWN,
    EVAL_FALSE,
    OP_RETURN,
    SCRIPT_SIZE,
    PUSH_SIZE,
    OP_COUNT,
    STACK_SIZE,
    MINIMALDATA,
    UNBALANCED_CONDITIONAL,
    CLEANSTACK,
    VERIFY,
    EQUALVERIFY,
};

static const unsigned int MAX_SCRIPT_ELEMENT_SIZE = 520;
static const int MAX_OPS_PER_SCRIPT = 201;
static const int MAX_STACK_SIZE = 1000;
static const int MAX_SCRIPT_SIZE = 10000;

bool CheckMinimalPush(const valtype& data, opcodetype opcode);
bool CastToBool(const valtype& vch);
bool EvalScript(std::vector<valtype>& stack, const std::vector<unsigned char>& script,
                uint32_t flags, ScriptError* serror);
bool VerifyScript(const std::vector<unsigned char>& scriptSig,
                  const std::vector<unsigned char>& scriptPubKey, uint32_t flags,
                  ScriptError* serror);

#endif // BITCOIN_SCRIPT_INTERPRETER_H
