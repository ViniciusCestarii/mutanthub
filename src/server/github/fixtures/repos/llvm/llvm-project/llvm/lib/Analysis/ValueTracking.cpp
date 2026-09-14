//===- ValueTracking.cpp - Walk computations to compute properties --------===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//
//
// This file contains routines that help analyze properties that chains of
// computations have.
//
//===----------------------------------------------------------------------===//

#include "llvm/Analysis/ValueTracking.h"
#include "llvm/ADT/APInt.h"
#include "llvm/IR/Constants.h"
#include "llvm/IR/Instructions.h"
#include "llvm/IR/Operator.h"

using namespace llvm;

/// Maximum recursion depth when walking through operand chains. Keeps the
/// analysis linear in practice.
static const unsigned MaxAnalysisRecursionDepth = 6;

/// Returns true when V is a constant integer whose value is not zero, or a
/// vector splat of such a constant.
static bool isNonZeroConstant(const Value *V) {
  if (const auto *CI = dyn_cast<ConstantInt>(V))
    return !CI->isZero();
  if (const auto *CV = dyn_cast<ConstantDataVector>(V)) {
    for (unsigned I = 0, E = CV->getNumElements(); I < E; ++I) {
      const auto *Elt = dyn_cast<ConstantInt>(CV->getElementAsConstant(I));
      if (!Elt || Elt->isZero())
        return false;
    }
    return true;
  }
  return false;
}

/// Returns the number of bits in the scalar type of V.
static unsigned getBitWidth(const Value *V) {
  return V->getType()->getScalarSizeInBits();
}

bool llvm::isKnownNonZero(const Value *V, unsigned Depth) {
  if (isNonZeroConstant(V))
    return true;
  if (isa<UndefValue>(V) || isa<ConstantPointerNull>(V))
    return false;

  if (Depth >= MaxAnalysisRecursionDepth)
    return false;

  const auto *I = dyn_cast<Instruction>(V);
  if (!I)
    return false;

  switch (I->getOpcode()) {
  case Instruction::Or:
    // X | Y is non-zero if either side is known non-zero.
    return isKnownNonZero(I->getOperand(0), Depth + 1) ||
           isKnownNonZero(I->getOperand(1), Depth + 1);

  case Instruction::Shl: {
    // shl nuw X, Y is non-zero if X is non-zero: no bits can be shifted out.
    const auto *BO = cast<OverflowingBinaryOperator>(I);
    if (BO->hasNoUnsignedWrap() || BO->hasNoSignedWrap())
      return isKnownNonZero(I->getOperand(0), Depth + 1);
    return false;
  }

  case Instruction::LShr:
  case Instruction::AShr: {
    // A shift right by less than the bit width of a value with its top bit
    // set stays non-zero; exact shifts preserve non-zero-ness directly.
    const auto *PEO = cast<PossiblyExactOperator>(I);
    if (PEO->isExact())
      return isKnownNonZero(I->getOperand(0), Depth + 1);
    return false;
  }

  case Instruction::Add: {
    // Adding two non-negative non-zero values with nuw cannot produce zero.
    const auto *BO = cast<OverflowingBinaryOperator>(I);
    if (!BO->hasNoUnsignedWrap())
      return false;
    return isKnownNonZero(I->getOperand(0), Depth + 1) ||
           isKnownNonZero(I->getOperand(1), Depth + 1);
  }

  case Instruction::Mul: {
    // mul nuw/nsw of two non-zero values is non-zero.
    const auto *BO = cast<OverflowingBinaryOperator>(I);
    if (!(BO->hasNoUnsignedWrap() || BO->hasNoSignedWrap()))
      return false;
    return isKnownNonZero(I->getOperand(0), Depth + 1) &&
           isKnownNonZero(I->getOperand(1), Depth + 1);
  }

  case Instruction::ZExt:
  case Instruction::SExt:
    return isKnownNonZero(I->getOperand(0), Depth + 1);

  case Instruction::Select: {
    // A select is non-zero if both arms are.
    const auto *SI = cast<SelectInst>(I);
    return isKnownNonZero(SI->getTrueValue(), Depth + 1) &&
           isKnownNonZero(SI->getFalseValue(), Depth + 1);
  }

  case Instruction::PHI: {
    const auto *PN = cast<PHINode>(I);
    unsigned NumIncoming = PN->getNumIncomingValues();
    if (NumIncoming == 0)
      return false;
    // Recursing through every incoming value is expensive; bound it.
    unsigned NewDepth = std::max(Depth + 1, MaxAnalysisRecursionDepth - 1);
    for (unsigned Idx = 0; Idx < NumIncoming; ++Idx) {
      const Value *Incoming = PN->getIncomingValue(Idx);
      if (Incoming == PN)
        continue;
      if (!isKnownNonZero(Incoming, NewDepth))
        return false;
    }
    return true;
  }

  default:
    return false;
  }
}

bool llvm::isKnownNonNegative(const Value *V, unsigned Depth) {
  if (const auto *CI = dyn_cast<ConstantInt>(V))
    return !CI->isNegative();

  if (Depth >= MaxAnalysisRecursionDepth)
    return false;

  const auto *I = dyn_cast<Instruction>(V);
  if (!I)
    return false;

  switch (I->getOpcode()) {
  case Instruction::ZExt:
    return true;
  case Instruction::LShr:
    // Logical shift right by at least one bit clears the sign bit.
    if (const auto *Amt = dyn_cast<ConstantInt>(I->getOperand(1)))
      return Amt->getZExtValue() >= 1 && Amt->getZExtValue() < getBitWidth(V);
    return false;
  case Instruction::And:
    return isKnownNonNegative(I->getOperand(0), Depth + 1) ||
           isKnownNonNegative(I->getOperand(1), Depth + 1);
  case Instruction::UDiv:
  case Instruction::URem:
    return isKnownNonNegative(I->getOperand(0), Depth + 1);
  default:
    return false;
  }
}

bool llvm::isPowerOfTwoConstant(const Value *V) {
  const auto *CI = dyn_cast<ConstantInt>(V);
  if (!CI)
    return false;
  const APInt &Val = CI->getValue();
  return !Val.isZero() && Val.isPowerOf2();
}

unsigned llvm::computeMinLeadingZeros(const Value *V, unsigned Depth) {
  unsigned Width = getBitWidth(V);
  if (const auto *CI = dyn_cast<ConstantInt>(V))
    return CI->getValue().countLeadingZeros();
  if (Depth >= MaxAnalysisRecursionDepth)
    return 0;

  const auto *I = dyn_cast<Instruction>(V);
  if (!I)
    return 0;

  switch (I->getOpcode()) {
  case Instruction::ZExt: {
    unsigned SrcWidth = getBitWidth(I->getOperand(0));
    return Width - SrcWidth + computeMinLeadingZeros(I->getOperand(0), Depth + 1);
  }
  case Instruction::LShr:
    if (const auto *Amt = dyn_cast<ConstantInt>(I->getOperand(1))) {
      uint64_t Shift = Amt->getZExtValue();
      if (Shift >= Width)
        return Width;
      return std::min(Width, unsigned(Shift) +
                                 computeMinLeadingZeros(I->getOperand(0), Depth + 1));
    }
    return 0;
  case Instruction::And:
    return std::max(computeMinLeadingZeros(I->getOperand(0), Depth + 1),
                    computeMinLeadingZeros(I->getOperand(1), Depth + 1));
  case Instruction::Or:
    return std::min(computeMinLeadingZeros(I->getOperand(0), Depth + 1),
                    computeMinLeadingZeros(I->getOperand(1), Depth + 1));
  default:
    return 0;
  }
}
