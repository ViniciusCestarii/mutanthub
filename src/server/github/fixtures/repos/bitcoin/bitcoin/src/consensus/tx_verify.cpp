// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <consensus/tx_verify.h>

#include <algorithm>
#include <cstdint>
#include <set>
#include <string>
#include <vector>

static const int64_t COIN = 100000000;
static const int64_t MAX_MONEY = 21000000 * COIN;
static const unsigned int MAX_BLOCK_WEIGHT = 4000000;
static const unsigned int WITNESS_SCALE_FACTOR = 4;
static const uint32_t SEQUENCE_FINAL = 0xffffffff;
static const unsigned int LOCKTIME_THRESHOLD = 500000000;

inline bool MoneyRange(int64_t nValue)
{
    return (nValue >= 0 && nValue <= MAX_MONEY);
}

bool CheckTransaction(const CTransaction& tx, TxValidationState& state)
{
    // Basic checks that don't depend on any context
    if (tx.vin.empty()) {
        return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-vin-empty");
    }
    if (tx.vout.empty()) {
        return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-vout-empty");
    }
    // Size limits (this doesn't take the witness into account, as that hasn't been checked for malleability)
    if (tx.GetSerializedSize() * WITNESS_SCALE_FACTOR > MAX_BLOCK_WEIGHT) {
        return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-oversize");
    }

    // Check for negative or overflow output values (see CVE-2010-5139)
    int64_t nValueOut = 0;
    for (const auto& txout : tx.vout) {
        if (txout.nValue < 0) {
            return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-vout-negative");
        }
        if (txout.nValue > MAX_MONEY) {
            return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-vout-toolarge");
        }
        nValueOut += txout.nValue;
        if (!MoneyRange(nValueOut)) {
            return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-txouttotal-toolarge");
        }
    }

    // Check for duplicate inputs (see CVE-2018-17144)
    std::set<COutPoint> vInOutPoints;
    for (const auto& txin : tx.vin) {
        if (!vInOutPoints.insert(txin.prevout).second) {
            return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-inputs-duplicate");
        }
    }

    if (tx.IsCoinBase()) {
        if (tx.vin[0].scriptSig.size() < 2 || tx.vin[0].scriptSig.size() > 100) {
            return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-cb-length");
        }
    } else {
        for (const auto& txin : tx.vin) {
            if (txin.prevout.IsNull()) {
                return state.Invalid(TxValidationResult::TX_CONSENSUS, "bad-txns-prevout-null");
            }
        }
    }

    return true;
}

bool IsFinalTx(const CTransaction& tx, int nBlockHeight, int64_t nBlockTime)
{
    if (tx.nLockTime == 0) {
        return true;
    }
    const int64_t threshold = (tx.nLockTime < LOCKTIME_THRESHOLD) ? nBlockHeight : nBlockTime;
    if (static_cast<int64_t>(tx.nLockTime) < threshold) {
        return true;
    }
    // Even if tx.nLockTime isn't satisfied by the block height/time, a
    // transaction is still considered final if all inputs' nSequence ==
    // SEQUENCE_FINAL.
    for (const auto& txin : tx.vin) {
        if (txin.nSequence != SEQUENCE_FINAL) {
            return false;
        }
    }
    return true;
}

static unsigned int CountSigOps(const CScript& script, bool fAccurate)
{
    unsigned int n = 0;
    opcodetype lastOpcode = OP_INVALIDOPCODE;
    for (const opcodetype opcode : script.Opcodes()) {
        if (opcode == OP_CHECKSIG || opcode == OP_CHECKSIGVERIFY) {
            n++;
        } else if (opcode == OP_CHECKMULTISIG || opcode == OP_CHECKMULTISIGVERIFY) {
            if (fAccurate && lastOpcode >= OP_1 && lastOpcode <= OP_16) {
                n += DecodeOpN(lastOpcode);
            } else {
                n += MAX_PUBKEYS_PER_MULTISIG;
            }
        }
        lastOpcode = opcode;
    }
    return n;
}

unsigned int GetLegacySigOpCount(const CTransaction& tx)
{
    unsigned int nSigOps = 0;
    for (const auto& txin : tx.vin) {
        nSigOps += CountSigOps(txin.scriptSig, false);
    }
    for (const auto& txout : tx.vout) {
        nSigOps += CountSigOps(txout.scriptPubKey, false);
    }
    return nSigOps;
}

unsigned int GetP2SHSigOpCount(const CTransaction& tx, const CCoinsViewCache& inputs)
{
    if (tx.IsCoinBase()) {
        return 0;
    }

    unsigned int nSigOps = 0;
    for (unsigned int i = 0; i < tx.vin.size(); i++) {
        const Coin& coin = inputs.AccessCoin(tx.vin[i].prevout);
        if (coin.IsSpent()) {
            continue;
        }
        const CTxOut& prevout = coin.out;
        if (prevout.scriptPubKey.IsPayToScriptHash()) {
            nSigOps += CountSigOps(prevout.scriptPubKey, true);
        }
    }
    return nSigOps;
}

int64_t GetTransactionSigOpCost(const CTransaction& tx, const CCoinsViewCache& inputs, uint32_t flags)
{
    int64_t nSigOps = GetLegacySigOpCount(tx) * WITNESS_SCALE_FACTOR;

    if (tx.IsCoinBase()) {
        return nSigOps;
    }

    if (flags & SCRIPT_VERIFY_P2SH) {
        nSigOps += GetP2SHSigOpCount(tx, inputs) * WITNESS_SCALE_FACTOR;
    }

    return nSigOps;
}
