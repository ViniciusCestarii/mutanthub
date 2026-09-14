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

#include "curl_setup.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

#include "http.h"
#include "strcase.h"

#define MAX_STATUS_LINE 128
#define MAX_HEADER_NAME 256
#define HTTP_MIN_STATUS 100
#define HTTP_MAX_STATUS 599

/*
 * Curl_http_parse_status_line() parses "HTTP/x.y NNN reason". Returns
 * CURLE_OK and fills 'ver' (10, 11 or 20) and 'code' on success.
 */
CURLcode Curl_http_parse_status_line(const char *line, size_t len,
                                     int *ver, int *code)
{
  int major, minor, status;
  size_t consumed;

  if(len < 12 || len > MAX_STATUS_LINE)
    return CURLE_WEIRD_SERVER_REPLY;

  if(strncmp(line, "HTTP/", 5) != 0)
    return CURLE_WEIRD_SERVER_REPLY;

  if(3 != sscanf(line, "HTTP/%d.%d %3d", &major, &minor, &status))
    return CURLE_WEIRD_SERVER_REPLY;

  if(major != 1 && major != 2)
    return CURLE_UNSUPPORTED_PROTOCOL;
  if(minor < 0 || minor > 1)
    return CURLE_UNSUPPORTED_PROTOCOL;

  if(status < HTTP_MIN_STATUS || status > HTTP_MAX_STATUS)
    return CURLE_WEIRD_SERVER_REPLY;

  consumed = 9; /* "HTTP/1.1 " */
  if(consumed + 3 > len)
    return CURLE_WEIRD_SERVER_REPLY;

  *ver = major * 10 + minor;
  *code = status;
  return CURLE_OK;
}

/*
 * Curl_http_status_is_redirect() returns TRUE for the status codes that a
 * client is expected to follow when CURLOPT_FOLLOWLOCATION is set.
 */
bool Curl_http_status_is_redirect(int code)
{
  switch(code) {
  case 301:
  case 302:
  case 303:
  case 307:
  case 308:
    return TRUE;
  default:
    return FALSE;
  }
}

/*
 * Curl_http_header_matches() compares a header line against a header name,
 * case-insensitively, and returns a pointer to the value (after the colon
 * and any leading whitespace), or NULL when the header does not match.
 */
const char *Curl_http_header_matches(const char *line, const char *name)
{
  size_t namelen = strlen(name);
  const char *value;

  if(!strncasecompare(line, name, namelen))
    return NULL;
  if(line[namelen] != ':')
    return NULL;

  value = line + namelen + 1;
  while(*value == ' ' || *value == '\t')
    value++;
  return value;
}

/*
 * Curl_http_parse_content_length() parses a Content-Length value. Returns
 * -1 for invalid or negative input and for values that would overflow.
 */
curl_off_t Curl_http_parse_content_length(const char *value)
{
  curl_off_t result = 0;
  const char *p = value;

  if(!ISDIGIT(*p))
    return -1;

  while(ISDIGIT(*p)) {
    int digit = *p - '0';
    if(result > (CURL_OFF_T_MAX - digit) / 10)
      return -1;
    result = result * 10 + digit;
    p++;
  }

  while(*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')
    p++;
  if(*p)
    return -1;

  return result;
}

/*
 * Curl_http_chunked_size() parses the hexadecimal size at the beginning of a
 * chunk. Returns the number of bytes consumed or 0 on failure.
 */
size_t Curl_http_chunked_size(const char *buf, size_t len, curl_off_t *size)
{
  size_t i = 0;
  curl_off_t value = 0;

  while(i < len && ISXDIGIT(buf[i])) {
    int digit;
    if(ISDIGIT(buf[i]))
      digit = buf[i] - '0';
    else
      digit = (tolower((unsigned char)buf[i]) - 'a') + 10;
    if(value > (CURL_OFF_T_MAX >> 4))
      return 0;
    value = (value << 4) | digit;
    i++;
  }

  if(i == 0 || i > 16)
    return 0;

  *size = value;
  return i;
}
