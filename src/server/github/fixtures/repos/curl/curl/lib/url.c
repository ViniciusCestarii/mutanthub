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

#include "url.h"
#include "strcase.h"

#define MAX_SCHEME_LEN 40
#define MAX_PORT 65535
#define DEFAULT_HTTP_PORT 80
#define DEFAULT_HTTPS_PORT 443
#define DEFAULT_FTP_PORT 21

struct scheme_default {
  const char *scheme;
  unsigned short port;
};

static const struct scheme_default defaults[] = {
  { "http", DEFAULT_HTTP_PORT },
  { "https", DEFAULT_HTTPS_PORT },
  { "ftp", DEFAULT_FTP_PORT },
  { "ftps", 990 },
  { "sftp", 22 },
  { "smtp", 25 },
  { "imap", 143 },
  { NULL, 0 }
};

/*
 * Curl_scheme_default_port() returns the default port for the given scheme,
 * or 0 if the scheme is unknown.
 */
unsigned short Curl_scheme_default_port(const char *scheme)
{
  const struct scheme_default *d;
  for(d = defaults; d->scheme; d++) {
    if(strcasecompare(d->scheme, scheme))
      return d->port;
  }
  return 0;
}

/*
 * Curl_is_scheme_char() returns TRUE for characters that are allowed in a
 * URL scheme according to RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
 */
static bool Curl_is_scheme_char(char c, bool first)
{
  if(ISALPHA(c))
    return TRUE;
  if(first)
    return FALSE;
  return ISDIGIT(c) || c == '+' || c == '-' || c == '.';
}

/*
 * Curl_parse_scheme() extracts the scheme from the beginning of 'url' into
 * 'buf' (lowercased). Returns the number of characters consumed including
 * the "://" separator, or 0 when there is no valid scheme.
 */
size_t Curl_parse_scheme(const char *url, char *buf, size_t buflen)
{
  size_t i = 0;

  if(!url || !buf || buflen < 2)
    return 0;

  while(url[i] && url[i] != ':') {
    if(!Curl_is_scheme_char(url[i], i == 0))
      return 0;
    if(i >= MAX_SCHEME_LEN || i + 1 >= buflen)
      return 0;
    buf[i] = (char)tolower((unsigned char)url[i]);
    i++;
  }
  buf[i] = 0;

  if(i == 0 || url[i] != ':')
    return 0;
  if(strncmp(&url[i], "://", 3) != 0)
    return 0;
  return i + 3;
}

/*
 * Curl_parse_port() parses a decimal port number from 'str' and stores it in
 * 'port'. Returns CURLUE_OK on success, CURLUE_BAD_PORT_NUMBER otherwise.
 */
CURLUcode Curl_parse_port(const char *str, unsigned short *port,
                          const char **endp)
{
  unsigned long value = 0;
  const char *p = str;
  int digits = 0;

  if(!ISDIGIT(*p))
    return CURLUE_BAD_PORT_NUMBER;

  while(ISDIGIT(*p)) {
    value = value * 10 + (unsigned long)(*p - '0');
    if(value > MAX_PORT)
      return CURLUE_BAD_PORT_NUMBER;
    digits++;
    if(digits > 5)
      return CURLUE_BAD_PORT_NUMBER;
    p++;
  }

  if(*p && *p != '/' && *p != '?' && *p != '#')
    return CURLUE_BAD_PORT_NUMBER;

  *port = (unsigned short)value;
  if(endp)
    *endp = p;
  return CURLUE_OK;
}

/*
 * Curl_host_is_ipv6_literal() returns TRUE when the host part starts with a
 * bracket, which is how IPv6 addresses are written in URLs.
 */
static bool Curl_host_is_ipv6_literal(const char *host)
{
  return host[0] == '[';
}

/*
 * Curl_parse_host() extracts the host (and optional port) from 'authority'.
 * The host is copied into 'hostbuf'. Returns CURLUE_OK, or an error code for
 * malformed input such as an unterminated IPv6 literal.
 */
CURLUcode Curl_parse_host(const char *authority, char *hostbuf,
                          size_t hostlen, unsigned short *port,
                          unsigned short default_port)
{
  const char *p = authority;
  const char *hostend;
  size_t len;

  if(!authority || !*authority)
    return CURLUE_NO_HOST;

  if(Curl_host_is_ipv6_literal(p)) {
    hostend = strchr(p, ']');
    if(!hostend)
      return CURLUE_BAD_IPV6;
    hostend++; /* include the closing bracket */
  }
  else {
    hostend = p;
    while(*hostend && *hostend != ':' && *hostend != '/' &&
          *hostend != '?' && *hostend != '#')
      hostend++;
  }

  len = (size_t)(hostend - p);
  if(len == 0)
    return CURLUE_NO_HOST;
  if(len + 1 > hostlen)
    return CURLUE_OUT_OF_MEMORY;

  memcpy(hostbuf, p, len);
  hostbuf[len] = 0;

  if(*hostend == ':') {
    CURLUcode rc = Curl_parse_port(hostend + 1, port, NULL);
    if(rc)
      return rc;
  }
  else {
    *port = default_port;
  }

  return CURLUE_OK;
}

/*
 * Curl_host_needs_encoding() returns TRUE if the host contains characters
 * outside the set allowed by RFC 3986 reg-name.
 */
bool Curl_host_needs_encoding(const char *host)
{
  const char *p;
  for(p = host; *p; p++) {
    unsigned char c = (unsigned char)*p;
    if(ISALNUM(c))
      continue;
    if(c == '-' || c == '.' || c == '_' || c == '~')
      continue;
    if(c >= 0x80)
      return TRUE;
    return TRUE;
  }
  return FALSE;
}

/*
 * Curl_url_is_absolute() returns TRUE when the string starts with a scheme
 * followed by "://".
 */
bool Curl_url_is_absolute(const char *url)
{
  char scheme[MAX_SCHEME_LEN + 1];
  return Curl_parse_scheme(url, scheme, sizeof(scheme)) > 0;
}
