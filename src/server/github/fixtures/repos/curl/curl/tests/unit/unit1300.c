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
#include "curlcheck.h"

#include "url.h"
#include "escape.h"
#include "parsedate.h"

static CURLcode unit_setup(void)
{
  return CURLE_OK;
}

static void unit_stop(void)
{
}

UNITTEST_START
{
  unsigned short port = 0;
  char scheme[64];
  time_t t;

  fail_unless(Curl_parse_scheme("https://example.com/", scheme,
                                sizeof(scheme)) == 8, "scheme length");
  fail_unless(strcmp(scheme, "https") == 0, "scheme lowercased");
  fail_unless(Curl_parse_scheme("1http://x", scheme, sizeof(scheme)) == 0,
              "scheme must start with a letter");

  fail_unless(Curl_parse_port("8080", &port, NULL) == CURLUE_OK, "port ok");
  fail_unless(port == 8080, "port value");
  fail_unless(Curl_parse_port("65536", &port, NULL) == CURLUE_BAD_PORT_NUMBER,
              "port too large");

  fail_unless(parsedate("Sun, 06 Nov 1994 08:49:37 GMT", &t) == PARSEDATE_OK,
              "rfc1123 date");
  fail_unless(t == 784111777, "epoch value");
}
UNITTEST_STOP
