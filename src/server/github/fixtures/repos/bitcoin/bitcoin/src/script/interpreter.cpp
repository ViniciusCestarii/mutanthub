// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <script/interpreter.h>

#include <cassert>
#include <cstring>

namespace {

inline bool set_success(ScriptError* ret)
{
    if (ret) *ret = ScriptError::OK;
    return true;
}

inline bool set_error(ScriptError* ret, const ScriptError serror)
{
    if (ret) *ret = serror;
    return false;
}

inline void popstack(std::vector<valtype>& stack)
{
    if (stack.empty()) {
        throw std::runtime_error("popstack(): stack empty");
    }
    stack.pop_back();
}

} // namespace

bool CastToBool(const valtype& vch)
{
    for (unsigned int i = 0; i < vch.size(); i++) {
        if (vch[i] != 0) {
            // Can be negative zero
            if (i == vch.size() - 1 && vch[i] == 0x80) {
                return false;
            }
            return true;
        }
    }
    return false;
}

bool CheckMinimalPush(const valtype& data, opcodetype opcode)
{
    // Excludes OP_1NEGATE, OP_1 .. OP_16 since they are by definition minimal
    assert(0 <= opcode && opcode <= OP_PUSHDATA4);
    if (data.size() == 0) {
        // Should have used OP_0.
        return opcode == OP_0;
    } else if (data.size() == 1 && data[0] >= 1 && data[0] <= 16) {
        // Should have used OP_1 .. OP_16.
        return false;
    } else if (data.size() == 1 && data[0] == 0x81) {
        // Should have used OP_1NEGATE.
        return false;
    } else if (data.size() <= 75) {
        // Must have used a direct push (opcode indicating number of bytes pushed + those bytes).
        return opcode == data.size();
    } else if (data.size() <= 255) {
        // Must have used OP_PUSHDATA.
        return opcode == OP_PUSHDATA1;
    } else if (data.size() <= 65535) {
        // Must have used OP_PUSHDATA2.
        return opcode == OP_PUSHDATA2;
    }
    return true;
}

static bool GetOp(const std::vector<unsigned char>& script, size_t& pc, opcodetype& opcodeRet,
                  valtype& vchRet)
{
    vchRet.clear();
    if (pc >= script.size()) return false;

    unsigned int opcode = script[pc++];
    unsigned int nSize = 0;
    if (opcode < OP_PUSHDATA1) {
        nSize = opcode;
    } else if (opcode == OP_PUSHDATA1) {
        if (script.size() - pc < 1) return false;
        nSize = script[pc++];
    } else if (opcode == OP_PUSHDATA2) {
        if (script.size() - pc < 2) return false;
        nSize = script[pc] | (script[pc + 1] << 8);
        pc += 2;
    } else if (opcode == OP_PUSHDATA4) {
        if (script.size() - pc < 4) return false;
        nSize = script[pc] | (script[pc + 1] << 8) | (script[pc + 2] << 16) | (script[pc + 3] << 24);
        pc += 4;
    }
    if (opcode <= OP_PUSHDATA4) {
        if (script.size() - pc < nSize) return false;
        vchRet.assign(script.begin() + pc, script.begin() + pc + nSize);
        pc += nSize;
    }
    opcodeRet = static_cast<opcodetype>(opcode);
    return true;
}

static int64_t DecodeSmallInt(const valtype& vch)
{
    if (vch.empty()) return 0;
    int64_t result = 0;
    for (size_t i = 0; i != vch.size(); ++i) {
        result |= static_cast<int64_t>(vch[i]) << (8 * i);
    }
    if (vch.back() & 0x80) {
        return -(result & ~(0x80ULL << (8 * (vch.size() - 1))));
    }
    return result;
}

static valtype EncodeSmallInt(int64_t value)
{
    valtype result;
    if (value == 0) return result;
    const bool neg = value < 0;
    uint64_t absvalue = neg ? -value : value;
    while (absvalue) {
        result.push_back(absvalue & 0xff);
        absvalue >>= 8;
    }
    if (result.back() & 0x80) {
        result.push_back(neg ? 0x80 : 0);
    } else if (neg) {
        result.back() |= 0x80;
    }
    return result;
}

bool EvalScript(std::vector<valtype>& stack, const std::vector<unsigned char>& script,
                uint32_t flags, ScriptError* serror)
{
    static const valtype vchFalse(0);
    static const valtype vchTrue(1, 1);

    size_t pc = 0;
    opcodetype opcode;
    valtype vchPushValue;
    std::vector<bool> vfExec;
    int nOpCount = 0;
    const bool fRequireMinimal = (flags & SCRIPT_VERIFY_MINIMALDATA) != 0;

    set_error(serror, ScriptError::UNKNOWN);

    if (script.size() > MAX_SCRIPT_SIZE) {
        return set_error(serror, ScriptError::SCRIPT_SIZE);
    }

    try {
        while (pc < script.size()) {
            bool fExec = true;
            for (bool b : vfExec) fExec = fExec && b;

            if (!GetOp(script, pc, opcode, vchPushValue)) {
                return set_error(serror, ScriptError::UNKNOWN);
            }
            if (vchPushValue.size() > MAX_SCRIPT_ELEMENT_SIZE) {
                return set_error(serror, ScriptError::PUSH_SIZE);
            }
            if (opcode > OP_16 && ++nOpCount > MAX_OPS_PER_SCRIPT) {
                return set_error(serror, ScriptError::OP_COUNT);
            }

            if (fExec && 0 <= opcode && opcode <= OP_PUSHDATA4) {
                if (fRequireMinimal && !CheckMinimalPush(vchPushValue, opcode)) {
                    return set_error(serror, ScriptError::MINIMALDATA);
                }
                stack.push_back(vchPushValue);
            } else if (fExec || (OP_IF <= opcode && opcode <= OP_ENDIF)) {
                switch (opcode) {
                case OP_1NEGATE:
                case OP_1:
                case OP_16: {
                    const int64_t bn = static_cast<int>(opcode) - static_cast<int>(OP_1 - 1);
                    stack.push_back(EncodeSmallInt(bn));
                } break;

                case OP_NOP:
                    break;

                case OP_IF:
                case OP_NOTIF: {
                    bool fValue = false;
                    if (fExec) {
                        if (stack.size() < 1) {
                            return set_error(serror, ScriptError::UNBALANCED_CONDITIONAL);
                        }
                        fValue = CastToBool(stack.back());
                        if (opcode == OP_NOTIF) fValue = !fValue;
                        popstack(stack);
                    }
                    vfExec.push_back(fValue);
                } break;

                case OP_ELSE: {
                    if (vfExec.empty()) {
                        return set_error(serror, ScriptError::UNBALANCED_CONDITIONAL);
                    }
                    vfExec.back() = !vfExec.back();
                } break;

                case OP_ENDIF: {
                    if (vfExec.empty()) {
                        return set_error(serror, ScriptError::UNBALANCED_CONDITIONAL);
                    }
                    vfExec.pop_back();
                } break;

                case OP_VERIFY: {
                    if (stack.size() < 1) return set_error(serror, ScriptError::STACK_SIZE);
                    const bool fValue = CastToBool(stack.back());
                    if (fValue) {
                        popstack(stack);
                    } else {
                        return set_error(serror, ScriptError::VERIFY);
                    }
                } break;

                case OP_RETURN:
                    return set_error(serror, ScriptError::OP_RETURN);

                case OP_DUP: {
                    if (stack.size() < 1) return set_error(serror, ScriptError::STACK_SIZE);
                    stack.push_back(stack.back());
                } break;

                case OP_EQUAL:
                case OP_EQUALVERIFY: {
                    if (stack.size() < 2) return set_error(serror, ScriptError::STACK_SIZE);
                    const bool fEqual = stack[stack.size() - 2] == stack[stack.size() - 1];
                    popstack(stack);
                    popstack(stack);
                    stack.push_back(fEqual ? vchTrue : vchFalse);
                    if (opcode == OP_EQUALVERIFY) {
                        if (fEqual) {
                            popstack(stack);
                        } else {
                            return set_error(serror, ScriptError::EQUALVERIFY);
                        }
                    }
                } break;

                case OP_ADD:
                case OP_SUB: {
                    if (stack.size() < 2) return set_error(serror, ScriptError::STACK_SIZE);
                    const int64_t bn1 = DecodeSmallInt(stack[stack.size() - 2]);
                    const int64_t bn2 = DecodeSmallInt(stack[stack.size() - 1]);
                    const int64_t bn = (opcode == OP_ADD) ? bn1 + bn2 : bn1 - bn2;
                    popstack(stack);
                    popstack(stack);
                    stack.push_back(EncodeSmallInt(bn));
                } break;

                default:
                    return set_error(serror, ScriptError::UNKNOWN);
                }
            }

            if (stack.size() > MAX_STACK_SIZE) {
                return set_error(serror, ScriptError::STACK_SIZE);
            }
        }
    } catch (...) {
        return set_error(serror, ScriptError::UNKNOWN);
    }

    if (!vfExec.empty()) {
        return set_error(serror, ScriptError::UNBALANCED_CONDITIONAL);
    }

    return set_success(serror);
}

bool VerifyScript(const std::vector<unsigned char>& scriptSig,
                  const std::vector<unsigned char>& scriptPubKey, uint32_t flags,
                  ScriptError* serror)
{
    set_error(serror, ScriptError::UNKNOWN);

    std::vector<valtype> stack;
    if (!EvalScript(stack, scriptSig, flags, serror)) {
        return false;
    }
    std::vector<valtype> stackCopy = stack;
    if (!EvalScript(stack, scriptPubKey, flags, serror)) {
        return false;
    }
    if (stack.empty()) {
        return set_error(serror, ScriptError::EVAL_FALSE);
    }
    if (CastToBool(stack.back()) == false) {
        return set_error(serror, ScriptError::EVAL_FALSE);
    }

    // The CLEANSTACK check is only performed after potential P2SH evaluation,
    // as the non-P2SH evaluation of a P2SH script will obviously not result in
    // a clean stack (the P2SH inputs remain).
    if ((flags & SCRIPT_VERIFY_CLEANSTACK) != 0) {
        assert((flags & SCRIPT_VERIFY_P2SH) != 0);
        if (stack.size() != 1) {
            return set_error(serror, ScriptError::CLEANSTACK);
        }
    }

    return set_success(serror);
}
