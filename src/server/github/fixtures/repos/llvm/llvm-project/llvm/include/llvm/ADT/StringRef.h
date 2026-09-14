//===- StringRef.h - Constant String Reference Wrapper ----------*- C++ -*-===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//

#ifndef LLVM_ADT_STRINGREF_H
#define LLVM_ADT_STRINGREF_H

#include <cassert>
#include <cstddef>
#include <cstring>
#include <string>

namespace llvm {

/// StringRef - Represent a constant reference to a string, i.e. a character
/// array and a length, which need not be null terminated.
class StringRef {
  const char *Data = nullptr;
  size_t Length = 0;

public:
  static constexpr size_t npos = ~size_t(0);

  StringRef() = default;
  StringRef(const char *Str) : Data(Str), Length(Str ? std::strlen(Str) : 0) {}
  StringRef(const char *Str, size_t Len) : Data(Str), Length(Len) {}
  StringRef(const std::string &Str) : Data(Str.data()), Length(Str.size()) {}

  const char *data() const { return Data; }
  size_t size() const { return Length; }
  bool empty() const { return Length == 0; }
  const char *begin() const { return Data; }
  const char *end() const { return Data + Length; }

  char operator[](size_t Index) const {
    assert(Index < Length && "Invalid index!");
    return Data[Index];
  }
  char front() const { return (*this)[0]; }
  char back() const { return (*this)[Length - 1]; }

  bool equals(StringRef RHS) const {
    return Length == RHS.Length && std::memcmp(Data, RHS.Data, Length) == 0;
  }
  int compare(StringRef RHS) const;
  int compare_insensitive(StringRef RHS) const;

  bool starts_with(StringRef Prefix) const {
    return Length >= Prefix.Length &&
           std::memcmp(Data, Prefix.Data, Prefix.Length) == 0;
  }
  bool ends_with(StringRef Suffix) const {
    return Length >= Suffix.Length &&
           std::memcmp(end() - Suffix.Length, Suffix.Data, Suffix.Length) == 0;
  }
  bool starts_with_insensitive(StringRef Prefix) const;
  bool ends_with_insensitive(StringRef Suffix) const;

  size_t find(char C, size_t From = 0) const;
  size_t find(StringRef Str, size_t From = 0) const;
  size_t rfind(char C) const;
  size_t count(StringRef Str) const;

  StringRef substr(size_t Start, size_t N = npos) const {
    Start = Start < Length ? Start : Length;
    return StringRef(Data + Start, N < Length - Start ? N : Length - Start);
  }
  StringRef drop_front(size_t N = 1) const { return substr(N); }
  StringRef drop_back(size_t N = 1) const { return substr(0, Length - N); }

  bool getAsInteger(unsigned Radix, unsigned long long &Result) const;
  bool getAsInteger(unsigned Radix, long long &Result) const;
};

inline bool operator==(StringRef LHS, StringRef RHS) { return LHS.equals(RHS); }
inline bool operator!=(StringRef LHS, StringRef RHS) { return !(LHS == RHS); }

bool consumeUnsignedInteger(StringRef &Str, unsigned Radix, unsigned long long &Result);
bool consumeSignedInteger(StringRef &Str, unsigned Radix, long long &Result);

} // namespace llvm

#endif // LLVM_ADT_STRINGREF_H
