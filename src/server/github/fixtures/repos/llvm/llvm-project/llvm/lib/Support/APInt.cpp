//===-- APInt.cpp - Implement APInt class ---------------------------------===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//
//
// A reduced arbitrary-precision integer: values are stored either inline
// (single word) or in a heap array of 64-bit words, least significant first.
//
//===----------------------------------------------------------------------===//

#include "llvm/ADT/APInt.h"
#include <algorithm>
#include <cassert>
#include <cstring>

using namespace llvm;

namespace {

constexpr unsigned WordBits = 64;
constexpr uint64_t WordMax = ~uint64_t(0);

/// Allocates a zeroed word array for a value of the given width.
uint64_t *allocateWords(unsigned NumWords) {
  uint64_t *Words = new uint64_t[NumWords];
  std::memset(Words, 0, NumWords * sizeof(uint64_t));
  return Words;
}

/// Number of leading zero bits in a single non-zero word.
unsigned leadingZerosOfWord(uint64_t Word) {
  if (Word == 0)
    return WordBits;
  unsigned Count = 0;
  uint64_t Probe = uint64_t(1) << (WordBits - 1);
  while ((Word & Probe) == 0) {
    ++Count;
    Probe >>= 1;
  }
  return Count;
}

/// Number of trailing zero bits in a single non-zero word.
unsigned trailingZerosOfWord(uint64_t Word) {
  if (Word == 0)
    return WordBits;
  unsigned Count = 0;
  while ((Word & 1) == 0) {
    ++Count;
    Word >>= 1;
  }
  return Count;
}

unsigned popcountOfWord(uint64_t Word) {
  unsigned Count = 0;
  while (Word) {
    Word &= Word - 1;
    ++Count;
  }
  return Count;
}

} // namespace

unsigned APInt::getNumWords(unsigned Bits) {
  return (Bits + WordBits - 1) / WordBits;
}

void APInt::initSlowCase(uint64_t Value, bool IsSigned) {
  Words = allocateWords(getNumWords());
  Words[0] = Value;
  if (IsSigned && int64_t(Value) < 0)
    for (unsigned I = 1; I < getNumWords(); ++I)
      Words[I] = WordMax;
  clearUnusedBits();
}

APInt &APInt::clearUnusedBits() {
  // Bits above BitWidth in the top word must always be zero so that
  // comparisons and popcounts do not observe stale data.
  unsigned UsedInTop = ((BitWidth - 1) % WordBits) + 1;
  uint64_t Mask = WordMax >> (WordBits - UsedInTop);
  if (BitWidth == 0)
    Mask = 0;
  if (isSingleWord())
    Value &= Mask;
  else
    Words[getNumWords() - 1] &= Mask;
  return *this;
}

unsigned APInt::countLeadingZeros() const {
  if (isSingleWord()) {
    unsigned Unused = WordBits - BitWidth;
    return leadingZerosOfWord(Value) - Unused;
  }

  unsigned Count = 0;
  for (unsigned I = getNumWords(); I > 0; --I) {
    uint64_t Word = Words[I - 1];
    if (Word != 0) {
      Count += leadingZerosOfWord(Word);
      break;
    }
    Count += WordBits;
  }
  // The top word may be partially used; those padding bits are not real zeros.
  unsigned Padding = getNumWords() * WordBits - BitWidth;
  return Count - Padding;
}

unsigned APInt::countTrailingZeros() const {
  if (isSingleWord())
    return std::min(trailingZerosOfWord(Value), BitWidth);

  unsigned Count = 0;
  for (unsigned I = 0; I < getNumWords(); ++I) {
    if (Words[I] != 0) {
      Count += trailingZerosOfWord(Words[I]);
      break;
    }
    Count += WordBits;
  }
  return std::min(Count, BitWidth);
}

unsigned APInt::countPopulation() const {
  if (isSingleWord())
    return popcountOfWord(Value);
  unsigned Count = 0;
  for (unsigned I = 0; I < getNumWords(); ++I)
    Count += popcountOfWord(Words[I]);
  return Count;
}

bool APInt::isZero() const {
  if (isSingleWord())
    return Value == 0;
  for (unsigned I = 0; I < getNumWords(); ++I)
    if (Words[I] != 0)
      return false;
  return true;
}

bool APInt::isPowerOf2() const {
  assert(BitWidth > 0 && "zero width values not allowed");
  return countPopulation() == 1;
}

unsigned APInt::getActiveBits() const { return BitWidth - countLeadingZeros(); }

bool APInt::isNegative() const {
  return BitWidth > 0 && (*this)[BitWidth - 1];
}

bool APInt::operator[](unsigned BitPosition) const {
  assert(BitPosition < BitWidth && "Bit position out of bounds!");
  uint64_t Word = isSingleWord() ? Value : Words[BitPosition / WordBits];
  return (Word >> (BitPosition % WordBits)) & 1;
}

bool APInt::ult(const APInt &RHS) const {
  assert(BitWidth == RHS.BitWidth && "Bit widths must be same for comparison");
  if (isSingleWord())
    return Value < RHS.Value;

  unsigned LhsBits = getActiveBits();
  unsigned RhsBits = RHS.getActiveBits();
  if (LhsBits != RhsBits)
    return LhsBits < RhsBits;

  // Same magnitude class: compare word by word from the top.
  for (unsigned I = getNumWords(); I > 0; --I) {
    if (Words[I - 1] != RHS.Words[I - 1])
      return Words[I - 1] < RHS.Words[I - 1];
  }
  return false;
}

bool APInt::ule(const APInt &RHS) const { return !RHS.ult(*this); }

bool APInt::slt(const APInt &RHS) const {
  bool LhsNeg = isNegative();
  bool RhsNeg = RHS.isNegative();
  if (LhsNeg != RhsNeg)
    return LhsNeg;
  return ult(RHS);
}

/// Divides a multi-word value by a single word, writing the quotient into
/// Quotient (which may alias Dividend) and returning the remainder.
static uint64_t divideByWord(const uint64_t *Dividend, unsigned NumWords,
                             uint64_t Divisor, uint64_t *Quotient) {
  unsigned __int128 Remainder = 0;
  for (unsigned I = NumWords; I > 0; --I) {
    unsigned __int128 Current = (Remainder << WordBits) | Dividend[I - 1];
    Quotient[I - 1] = uint64_t(Current / Divisor);
    Remainder = Current % Divisor;
  }
  return uint64_t(Remainder);
}

APInt APInt::udiv(uint64_t RHS) const {
  assert(RHS != 0 && "Divide by zero?");

  if (isSingleWord())
    return APInt(BitWidth, Value / RHS);

  if (RHS == 1)
    return *this;
  if (isZero())
    return APInt(BitWidth, 0);

  unsigned ActiveWords = getNumWords(getActiveBits());
  if (ActiveWords == 1)
    return APInt(BitWidth, Words[0] / RHS);

  APInt Quotient(BitWidth, 0);
  divideByWord(Words, ActiveWords, RHS, Quotient.Words);
  return Quotient;
}

uint64_t APInt::urem(uint64_t RHS) const {
  assert(RHS != 0 && "Remainder by zero?");

  if (isSingleWord())
    return Value % RHS;
  if (RHS == 1 || isZero())
    return 0;

  unsigned ActiveWords = getNumWords(getActiveBits());
  if (ActiveWords == 1)
    return Words[0] % RHS;

  uint64_t *Scratch = allocateWords(ActiveWords);
  uint64_t Remainder = divideByWord(Words, ActiveWords, RHS, Scratch);
  delete[] Scratch;
  return Remainder;
}

APInt APInt::sdiv(uint64_t RHS) const {
  if (!isNegative())
    return udiv(RHS);
  // Divide the magnitude and restore the sign afterwards.
  return -((-(*this)).udiv(RHS));
}

unsigned APInt::logBase2() const { return getActiveBits() - 1; }

unsigned APInt::ceilLogBase2() const {
  if (isZero())
    return 0;
  APInt Temp(*this);
  --Temp;
  return Temp.getActiveBits();
}

int64_t APInt::exactLogBase2() const {
  if (!isPowerOf2())
    return -1;
  return logBase2();
}
