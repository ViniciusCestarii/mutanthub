// Copyright (c) 2026 The MutantHub fixture authors
// Distributed under the MIT software license.

#include <validation.h>

#include <consensus/tx_verify.h>

#include <cstdint>
#include <vector>

static const unsigned int MAX_BLOCK_WEIGHT = 4000000;
static const unsigned int MAX_BLOCK_SERIALIZED_SIZE = 4000000;
static const int64_t MAX_BLOCK_SIGOPS_COST = 80000;
static const int64_t MAX_FUTURE_BLOCK_TIME = 2 * 60 * 60;
static const int COINBASE_MATURITY = 100;
static const int64_t nSubsidyHalvingInterval = 210000;
static const int64_t COIN = 100000000;

int64_t GetBlockSubsidy(int nHeight)
{
    int halvings = nHeight / nSubsidyHalvingInterval;
    // Force block reward to zero when right shift is undefined.
    if (halvings >= 64) {
        return 0;
    }
    int64_t nSubsidy = 50 * COIN;
    // Subsidy is cut in half every 210,000 blocks which will occur approximately every 4 years.
    nSubsidy >>= halvings;
    return nSubsidy;
}

static bool CheckBlockHeader(const CBlockHeader& block, BlockValidationState& state,
                             bool fCheckPOW = true)
{
    // Check proof of work matches claimed amount
    if (fCheckPOW && !CheckProofOfWork(block.GetHash(), block.nBits)) {
        return state.Invalid(BlockValidationResult::BLOCK_INVALID_HEADER, "high-hash",
                             "proof of work failed");
    }
    return true;
}

bool CheckBlock(const CBlock& block, BlockValidationState& state, bool fCheckPOW,
                bool fCheckMerkleRoot)
{
    // These are checks that are independent of context.
    if (block.fChecked) {
        return true;
    }

    // Check that the header is valid (particularly PoW).
    if (!CheckBlockHeader(block, state, fCheckPOW)) {
        return false;
    }

    // Check the merkle root.
    if (fCheckMerkleRoot) {
        bool mutated;
        uint256 hashMerkleRoot2 = BlockMerkleRoot(block, &mutated);
        if (block.hashMerkleRoot != hashMerkleRoot2) {
            return state.Invalid(BlockValidationResult::BLOCK_MUTATED, "bad-txnmrklroot",
                                 "hashMerkleRoot mismatch");
        }
        // Check for merkle tree malleability (CVE-2012-2459).
        if (mutated) {
            return state.Invalid(BlockValidationResult::BLOCK_MUTATED, "bad-txns-duplicate",
                                 "duplicate transaction");
        }
    }

    // Size limits
    if (block.vtx.empty() || block.vtx.size() * WITNESS_SCALE_FACTOR > MAX_BLOCK_WEIGHT ||
        block.GetSerializedSize() * WITNESS_SCALE_FACTOR > MAX_BLOCK_WEIGHT) {
        return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS, "bad-blk-length",
                             "size limits failed");
    }

    // First transaction must be coinbase, the rest must not be
    if (block.vtx.empty() || !block.vtx[0]->IsCoinBase()) {
        return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS, "bad-cb-missing",
                             "first tx is not coinbase");
    }
    for (unsigned int i = 1; i < block.vtx.size(); i++) {
        if (block.vtx[i]->IsCoinBase()) {
            return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS, "bad-cb-multiple",
                                 "more than one coinbase");
        }
    }

    // Check transactions
    for (const auto& tx : block.vtx) {
        TxValidationState tx_state;
        if (!CheckTransaction(*tx, tx_state)) {
            return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS, tx_state.GetRejectReason(),
                                 "Transaction check failed");
        }
    }

    int64_t nSigOps = 0;
    for (const auto& tx : block.vtx) {
        nSigOps += GetLegacySigOpCount(*tx);
    }
    if (nSigOps * WITNESS_SCALE_FACTOR > MAX_BLOCK_SIGOPS_COST) {
        return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS, "bad-blk-sigops",
                             "out-of-bounds SigOpCount");
    }

    if (fCheckPOW && fCheckMerkleRoot) {
        block.fChecked = true;
    }

    return true;
}

bool ContextualCheckBlockHeader(const CBlockHeader& block, BlockValidationState& state,
                                const CBlockIndex* pindexPrev, int64_t nAdjustedTime)
{
    const int nHeight = pindexPrev == nullptr ? 0 : pindexPrev->nHeight + 1;

    // Check proof of work
    if (block.nBits != GetNextWorkRequired(pindexPrev, &block)) {
        return state.Invalid(BlockValidationResult::BLOCK_INVALID_HEADER, "bad-diffbits",
                             "incorrect proof of work");
    }

    // Check against checkpoints
    if (nHeight < GetLastCheckpointHeight() && !IsCheckpointAncestor(pindexPrev)) {
        return state.Invalid(BlockValidationResult::BLOCK_CHECKPOINT, "bad-fork-prior-to-checkpoint");
    }

    // Check timestamp against prev
    if (block.GetBlockTime() <= pindexPrev->GetMedianTimePast()) {
        return state.Invalid(BlockValidationResult::BLOCK_INVALID_HEADER, "time-too-old",
                             "block's timestamp is too early");
    }

    // Check timestamp
    if (block.GetBlockTime() > nAdjustedTime + MAX_FUTURE_BLOCK_TIME) {
        return state.Invalid(BlockValidationResult::BLOCK_TIME_FUTURE, "time-too-new",
                             "block timestamp too far in the future");
    }

    // Reject blocks with outdated version
    if ((block.nVersion < 2 && nHeight >= 227931) || (block.nVersion < 3 && nHeight >= 363725) ||
        (block.nVersion < 4 && nHeight >= 388381)) {
        return state.Invalid(BlockValidationResult::BLOCK_INVALID_HEADER, "bad-version");
    }

    return true;
}

bool IsCoinbaseMature(int nSpendHeight, int nCoinbaseHeight)
{
    return nSpendHeight - nCoinbaseHeight >= COINBASE_MATURITY;
}
