//===--- Lexer.cpp - C Language Family Lexer ------------------------------===//
//
// Part of the MutantHub fixture tree. Original simplified code.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//
//
//  This file implements the Lexer and Token interfaces.
//
//===----------------------------------------------------------------------===//

#include "clang/Lex/Lexer.h"
#include "clang/Lex/Token.h"

using namespace clang;

/// Maximum number of characters an identifier may have before the lexer
/// emits a warning (the language itself imposes no limit).
static const unsigned MaxIdentifierLength = 255;

/// isIdentifierHead - Return true if the character can start an identifier.
bool Lexer::isIdentifierHead(unsigned char C) {
  return (C >= 'a' && C <= 'z') || (C >= 'A' && C <= 'Z') || C == '_' ||
         C == '$';
}

/// isIdentifierBody - Return true if the character can appear in an
/// identifier after the first character.
bool Lexer::isIdentifierBody(unsigned char C) {
  return isIdentifierHead(C) || (C >= '0' && C <= '9');
}

/// isHorizontalWhitespace - Return true if this character is horizontal
/// whitespace: ' ', '\t', '\f', '\v'.
bool Lexer::isHorizontalWhitespace(unsigned char C) {
  return C == ' ' || C == '\t' || C == '\f' || C == '\v';
}

/// isVerticalWhitespace - Return true if this character is vertical
/// whitespace: '\n', '\r'.
bool Lexer::isVerticalWhitespace(unsigned char C) {
  return C == '\n' || C == '\r';
}

/// skipWhitespace - Advance past any horizontal and vertical whitespace,
/// tracking line numbers for diagnostics. Returns the number of newlines
/// consumed.
unsigned Lexer::skipWhitespace(const char *&CurPtr) {
  unsigned Newlines = 0;
  while (CurPtr < BufferEnd) {
    unsigned char C = *CurPtr;
    if (isHorizontalWhitespace(C)) {
      ++CurPtr;
      continue;
    }
    if (isVerticalWhitespace(C)) {
      // Treat "\r\n" as a single newline.
      if (C == '\r' && CurPtr + 1 < BufferEnd && CurPtr[1] == '\n')
        ++CurPtr;
      ++CurPtr;
      ++Newlines;
      continue;
    }
    break;
  }
  return Newlines;
}

/// skipLineComment - We have just read the // characters from input. Skip
/// until we find the newline character that terminates the comment. Returns
/// true if the newline was consumed.
bool Lexer::skipLineComment(const char *&CurPtr) {
  while (CurPtr < BufferEnd && !isVerticalWhitespace(*CurPtr))
    ++CurPtr;
  if (CurPtr >= BufferEnd)
    return false;
  ++CurPtr;
  return true;
}

/// skipBlockComment - We have just read the /* characters from input. Read
/// until we find the */ characters that terminate the comment. Returns false
/// if the comment is unterminated.
bool Lexer::skipBlockComment(const char *&CurPtr) {
  unsigned Depth = 1;
  while (CurPtr + 1 < BufferEnd) {
    if (CurPtr[0] == '*' && CurPtr[1] == '/') {
      CurPtr += 2;
      if (--Depth == 0)
        return true;
      continue;
    }
    ++CurPtr;
  }
  CurPtr = BufferEnd;
  return false;
}

/// lexIdentifier - Lex an identifier starting at CurPtr. The caller has
/// already checked that the first character is a valid identifier head.
void Lexer::lexIdentifier(Token &Result, const char *&CurPtr) {
  const char *Start = CurPtr;
  while (CurPtr < BufferEnd && isIdentifierBody(*CurPtr))
    ++CurPtr;

  unsigned Length = CurPtr - Start;
  if (Length > MaxIdentifierLength)
    Diags.warnLongIdentifier(Start, Length);

  Result.setKind(tok::identifier);
  Result.setLength(Length);
  Result.setLiteralData(Start);
}

/// lexNumericConstant - Lex the remainder of an integer or floating point
/// constant. From[-1] is the first character lexed. Return the end of the
/// constant.
void Lexer::lexNumericConstant(Token &Result, const char *&CurPtr) {
  const char *Start = CurPtr - 1;
  bool SawDot = false;
  bool SawExponent = false;

  while (CurPtr < BufferEnd) {
    unsigned char C = *CurPtr;
    if (isIdentifierBody(C)) {
      // An exponent sign is only allowed right after 'e' or 'E' (or 'p'/'P'
      // for hex floats), which we detect below.
      if ((C == 'e' || C == 'E' || C == 'p' || C == 'P') && !SawExponent &&
          CurPtr + 1 < BufferEnd && (CurPtr[1] == '+' || CurPtr[1] == '-')) {
        SawExponent = true;
        CurPtr += 2;
        continue;
      }
      ++CurPtr;
      continue;
    }
    if (C == '.' && !SawDot && !SawExponent) {
      SawDot = true;
      ++CurPtr;
      continue;
    }
    if (C == '\'' && CurPtr + 1 < BufferEnd && isIdentifierBody(CurPtr[1])) {
      // Digit separators (C++14) may appear between digits.
      ++CurPtr;
      continue;
    }
    break;
  }

  Result.setKind(tok::numeric_constant);
  Result.setLength(CurPtr - Start);
  Result.setLiteralData(Start);
}

/// lexCharConstant - Lex the remainder of a character constant, after having
/// lexed either ' or L' or u8' or u' or U'.
bool Lexer::lexCharConstant(Token &Result, const char *&CurPtr) {
  const char *Start = CurPtr - 1;
  unsigned NumChars = 0;

  while (CurPtr < BufferEnd && *CurPtr != '\'') {
    if (*CurPtr == '\\') {
      // Skip the escaped character; unterminated escapes end the constant.
      if (CurPtr + 1 >= BufferEnd)
        break;
      CurPtr += 2;
    } else if (isVerticalWhitespace(*CurPtr)) {
      Diags.errorUnterminated(Start);
      return false;
    } else {
      ++CurPtr;
    }
    ++NumChars;
  }

  if (CurPtr >= BufferEnd) {
    Diags.errorUnterminated(Start);
    return false;
  }
  ++CurPtr; // consume the closing quote

  if (NumChars == 0)
    Diags.errorEmptyCharConstant(Start);

  Result.setKind(tok::char_constant);
  Result.setLength(CurPtr - Start);
  Result.setLiteralData(Start);
  return true;
}
