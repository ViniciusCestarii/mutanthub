#ifndef CURLINC_CURL_H
#define CURLINC_CURL_H
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

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LIBCURL_VERSION "8.99.0-fixture"
#define LIBCURL_VERSION_MAJOR 8
#define LIBCURL_VERSION_MINOR 99
#define LIBCURL_VERSION_PATCH 0

typedef enum {
  CURLE_OK = 0,
  CURLE_UNSUPPORTED_PROTOCOL,
  CURLE_URL_MALFORMAT,
  CURLE_OUT_OF_MEMORY,
  CURLE_WEIRD_SERVER_REPLY,
  CURL_LAST
} CURLcode;

typedef enum {
  CURLUE_OK = 0,
  CURLUE_BAD_PORT_NUMBER,
  CURLUE_NO_HOST,
  CURLUE_BAD_IPV6,
  CURLUE_OUT_OF_MEMORY,
  CURLUE_LAST
} CURLUcode;

#define PARSEDATE_OK     0
#define PARSEDATE_FAIL  -1
#define PARSEDATE_LATER  1
#define PARSEDATE_SOONER 2

char *curl_easy_escape(const char *string, int length);
char *curl_easy_unescape(const char *string, int length, int *outlength);

#ifdef __cplusplus
}
#endif

#endif /* CURLINC_CURL_H */
