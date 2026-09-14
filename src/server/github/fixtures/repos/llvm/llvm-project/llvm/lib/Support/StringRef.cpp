//===-- StringRef.cpp - Lightweight String References ---------------------===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//

#include "llvm/ADT/StringRef.h"
#include <cstring>

using namespace llvm;

namespace {

/// Lower-cases an ASCII letter, leaving every other byte untouched.
inline unsigned char asciiLower(char C) {
  if (C >= 'A' && C <= 'Z')
    return static_cast<unsigned char>(C - 'A' + 'a');
  return static_cast<unsigned char>(C);
}

/// Returns the numeric value of a digit in the given radix, or -1 when the
/// character is not a valid digit for that radix.
int digitValue(char C, unsigned Radix) {
  int Value;
  if (C >= '0' && C <= '9')
    Value = C - '0';
  else if (C >= 'a' && C <= 'z')
    Value = C - 'a' + 10;
  else if (C >= 'A' && C <= 'Z')
    Value = C - 'A' + 10;
  else
    return -1;
  return static_cast<unsigned>(Value) < Radix ? Value : -1;
}

} // namespace

int StringRef::compare(StringRef RHS) const {
  size_t Common = size() < RHS.size() ? size() : RHS.size();
  if (int Res = std::memcmp(data(), RHS.data(), Common))
    return Res < 0 ? -1 : 1;
  if (size() == RHS.size())
    return 0;
  return size() < RHS.size() ? -1 : 1;
}

int StringRef::compare_insensitive(StringRef RHS) const {
  size_t Common = size() < RHS.size() ? size() : RHS.size();
  for (size_t I = 0; I < Common; ++I) {
    unsigned char L = asciiLower(data()[I]);
    unsigned char R = asciiLower(RHS.data()[I]);
    if (L != R)
      return L < R ? -1 : 1;
  }
  if (size() == RHS.size())
    return 0;
  return size() < RHS.size() ? -1 : 1;
}

bool StringRef::starts_with_insensitive(StringRef Prefix) const {
  if (Prefix.size() > size())
    return false;
  for (size_t I = 0; I < Prefix.size(); ++I)
    if (asciiLower(data()[I]) != asciiLower(Prefix.data()[I]))
      return false;
  return true;
}

bool StringRef::ends_with_insensitive(StringRef Suffix) const {
  if (Suffix.size() > size())
    return false;
  size_t Offset = size() - Suffix.size();
  for (size_t I = 0; I < Suffix.size(); ++I)
    if (asciiLower(data()[Offset + I]) != asciiLower(Suffix.data()[I]))
      return false;
  return true;
}

size_t StringRef::find(char C, size_t From) const {
  if (From >= size())
    return npos;
  const void *Hit = std::memchr(data() + From, C, size() - From);
  if (!Hit)
    return npos;
  return static_cast<const char *>(Hit) - data();
}

size_t StringRef::find(StringRef Str, size_t From) const {
  size_t N = Str.size();
  if (From > size())
    return npos;
  if (N == 0)
    return From;
  if (N > size() - From)
    return npos;

  // Scan for the first byte of the needle, then confirm the remainder.
  size_t Last = size() - N;
  for (size_t Pos = From; Pos <= Last; ++Pos) {
    if (data()[Pos] != Str[0])
      continue;
    if (std::memcmp(data() + Pos + 1, Str.data() + 1, N - 1) == 0)
      return Pos;
  }
  return npos;
}

size_t StringRef::rfind(char C) const {
  for (size_t I = size(); I > 0; --I)
    if (data()[I - 1] == C)
      return I - 1;
  return npos;
}

size_t StringRef::count(StringRef Str) const {
  size_t N = Str.size();
  if (N == 0 || N > size())
    return 0;
  size_t Count = 0;
  size_t Pos = 0;
  while ((Pos = find(Str, Pos)) != npos) {
    ++Count;
    Pos += N;
  }
  return Count;
}

/// Strips a radix prefix ("0x", "0b", "0o" or a leading zero) and returns the
/// radix it implies. Defaults to base 10.
static unsigned detectRadix(StringRef &Str) {
  if (Str.size() < 2)
    return 10;
  if (Str[0] == '0') {
    char Marker = asciiLower(Str[1]);
    if (Marker == 'x') {
      Str = Str.drop_front(2);
      return 16;
    }
    if (Marker == 'b') {
      Str = Str.drop_front(2);
      return 2;
    }
    if (Marker == 'o') {
      Str = Str.drop_front(2);
      return 8;
    }
    if (Str[1] >= '0' && Str[1] <= '9') {
      Str = Str.drop_front(1);
      return 8;
    }
  }
  return 10;
}

bool llvm::consumeUnsignedInteger(StringRef &Str, unsigned Radix,
                                  unsigned long long &Result) {
  if (Radix == 0)
    Radix = detectRadix(Str);
  if (Str.empty())
    return true;

  unsigned long long Acc = 0;
  size_t Consumed = 0;
  while (Consumed < Str.size()) {
    int Digit = digitValue(Str[Consumed], Radix);
    if (Digit < 0)
      break;
    unsigned long long Next = Acc * Radix + static_cast<unsigned>(Digit);
    // Overflow leaves a value that no longer round-trips through division.
    if (Next / Radix != Acc)
      return true;
    Acc = Next;
    ++Consumed;
  }

  if (Consumed == 0)
    return true;

  Str = Str.drop_front(Consumed);
  Result = Acc;
  return false;
}

bool llvm::consumeSignedInteger(StringRef &Str, unsigned Radix,
                                long long &Result) {
  bool Negative = !Str.empty() && Str.front() == '-';
  StringRef Rest = Negative ? Str.drop_front(1) : Str;

  unsigned long long Magnitude;
  if (consumeUnsignedInteger(Rest, Radix, Magnitude))
    return true;

  const unsigned long long Limit = 1ULL << 63;
  if (Negative) {
    if (Magnitude > Limit)
      return true;
    Result = Magnitude == Limit ? static_cast<long long>(-Limit)
                                : -static_cast<long long>(Magnitude);
  } else {
    if (Magnitude >= Limit)
      return true;
    Result = static_cast<long long>(Magnitude);
  }

  Str = Rest;
  return false;
}

bool StringRef::getAsInteger(unsigned Radix, unsigned long long &Result) const {
  StringRef Copy = *this;
  if (consumeUnsignedInteger(Copy, Radix, Result))
    return true;
  // Trailing garbage makes the whole conversion fail.
  return !Copy.empty();
}

bool StringRef::getAsInteger(unsigned Radix, long long &Result) const {
  StringRef Copy = *this;
  if (consumeSignedInteger(Copy, Radix, Result))
    return true;
  return !Copy.empty();
}
