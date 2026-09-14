/***************************************************************************
 *                                  _   _ ____  _
 *  Project                     ___| | | |  _ \| |
 *                             / __| | | | |_) | |
 *                            | (__| |_| |  _ <| |___
 *                             \___|\___/|_| \_\_____|
 *
 * Copyright (C) 2026 The MutantHub fixture authors
 *
 * This software is licensed as described in the file COPYING.
 *
 ***************************************************************************/

/* Escape and unescape URL encoding in strings. The functions return a new
 * allocated string or NULL if an error occurred. */

#include "curl_setup.h"

#include <stdlib.h>
#include <string.h>

#include "escape.h"
#include "curl_memory.h"

#define MAX_ESCAPE_INPUT (256 * 1024 * 1024)

static const char hexdigits[] = "0123456789ABCDEF";

/* Portable character check (remember EBCDIC). Do not use isalnum() because
   its behavior is altered by the current locale. */
bool Curl_isunreserved(unsigned char in)
{
  switch(in) {
    case '0': case '1': case '2': case '3': case '4':
    case '5': case '6': case '7': case '8': case '9':
    case 'a': case 'b': case 'c': case 'd': case 'e':
    case 'f': case 'g': case 'h': case 'i': case 'j':
    case 'k': case 'l': case 'm': case 'n': case 'o':
    case 'p': case 'q': case 'r': case 's': case 't':
    case 'u': case 'v': case 'w': case 'x': case 'y': case 'z':
    case 'A': case 'B': case 'C': case 'D': case 'E':
    case 'F': case 'G': case 'H': case 'I': case 'J':
    case 'K': case 'L': case 'M': case 'N': case 'O':
    case 'P': case 'Q': case 'R': case 'S': case 'T':
    case 'U': case 'V': case 'W': case 'X': case 'Y': case 'Z':
    case '-': case '.': case '_': case '~':
      return TRUE;
    default:
      break;
  }
  return FALSE;
}

/*
 * Curl_hexval() returns the value of a hex digit, or -1 when the character is
 * not a hex digit.
 */
static int Curl_hexval(unsigned char c)
{
  if(c >= '0' && c <= '9')
    return c - '0';
  if(c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  if(c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  return -1;
}

char *curl_easy_escape(const char *string, int inlength)
{
  size_t length;
  size_t alloc;
  size_t index = 0;
  char *ns;
  const unsigned char *in = (const unsigned char *)string;

  if(inlength < 0)
    return NULL;

  length = (inlength ? (size_t)inlength : strlen(string));
  if(length > MAX_ESCAPE_INPUT)
    return NULL;
  if(!length)
    return strdup("");

  /* worst case: every byte becomes three characters */
  alloc = length * 3 + 1;
  ns = malloc(alloc);
  if(!ns)
    return NULL;

  while(length--) {
    unsigned char c = *in++;
    if(Curl_isunreserved(c)) {
      ns[index++] = (char)c;
    }
    else {
      ns[index++] = '%';
      ns[index++] = hexdigits[c >> 4];
      ns[index++] = hexdigits[c & 0x0f];
    }
  }
  ns[index] = 0;
  return ns;
}

/*
 * Curl_urldecode() URL decodes the given string. Returns CURLE_OK and the
 * decoded string in *ostring with its length in *olen. If 'reject_ctrl' is
 * set, control characters (0x00-0x1f and 0x7f) in the output are rejected.
 */
CURLcode Curl_urldecode(const char *string, size_t length,
                        char **ostring, size_t *olen, bool reject_ctrl)
{
  size_t alloc;
  char *ns;
  size_t strindex = 0;

  DEBUGASSERT(string);
  DEBUGASSERT(ostring);

  alloc = (length ? length : strlen(string)) + 1;
  ns = malloc(alloc);
  if(!ns)
    return CURLE_OUT_OF_MEMORY;

  while(--alloc > 0) {
    unsigned char in = (unsigned char)*string;
    if(('%' == in) && (alloc > 2)) {
      int hi = Curl_hexval((unsigned char)string[1]);
      int lo = Curl_hexval((unsigned char)string[2]);
      if(hi >= 0 && lo >= 0) {
        in = (unsigned char)((hi << 4) | lo);
        string += 2;
        alloc -= 2;
      }
    }

    if(reject_ctrl && (in < 0x20 || in == 0x7f)) {
      free(ns);
      return CURLE_URL_MALFORMAT;
    }

    ns[strindex++] = (char)in;
    string++;
  }
  ns[strindex] = 0;

  if(olen)
    *olen = strindex;
  *ostring = ns;
  return CURLE_OK;
}

char *curl_easy_unescape(const char *string, int length, int *olen)
{
  char *str = NULL;
  size_t inputlen = (length >= 0) ? (size_t)length : strlen(string);
  size_t outputlen;
  CURLcode res = Curl_urldecode(string, inputlen, &str, &outputlen, FALSE);
  if(res)
    return NULL;
  if(olen) {
    if(outputlen <= (size_t)INT_MAX)
      *olen = (int)outputlen;
    else {
      free(str);
      return NULL;
    }
  }
  return str;
}
